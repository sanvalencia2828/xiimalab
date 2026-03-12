"""
engine/staking_manager.py
─────────────────────────────────────────────────────────────────────────────
Motor de Proof of Skill — DeEd / Xiimalab
Integra Stellar Blockchain con el backend de Supabase/PostgreSQL para:

  1. Crear un Claimable Balance en Stellar cuando se detecta una compra en Hotmart.
  2. Liberar automáticamente los fondos al estudiante cuando alcanza 10 imágenes
     procesadas en AURA o aplica a una hackatón.
  3. Registrar todo en PostgreSQL para auditoría.

Flujo de vida del escrow:
  pending  → Orden de Hotmart recibida, aún sin balance en Stellar
  active   → Claimable Balance creado en Stellar (balance_id asignado)
  released → Milestone alcanzado, fondos enviados al estudiante
  refunded → Reembolso por inactividad (>180 días)

Dependencias:
  pip install stellar-sdk asyncpg python-dotenv
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import asyncpg
from dotenv import load_dotenv

# Stellar SDK
from stellar_sdk import (
    Asset,
    Claimant,
    Keypair,
    Network,
    Server,
    TransactionBuilder,
)
from stellar_sdk.operation import (
    ClaimClaimableBalance,
    CreateClaimableBalance,
    Payment,
)
from stellar_sdk.exceptions import NotFoundError

load_dotenv()

# ─────────────────────────────────────────────
# Configuración de entorno
# ─────────────────────────────────────────────
DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql://xiima:secret@localhost:5432/xiimalab"
)

# Stellar Testnet por defecto; cambiar a STELLAR_NETWORK=mainnet en producción
STELLAR_NETWORK: str = os.environ.get("STELLAR_NETWORK", "testnet")
STELLAR_HORIZON_URL: str = (
    "https://horizon-testnet.stellar.org"
    if STELLAR_NETWORK == "testnet"
    else "https://horizon.stellar.org"
)
NETWORK_PASSPHRASE: str = (
    Network.TESTNET_NETWORK_PASSPHRASE
    if STELLAR_NETWORK == "testnet"
    else Network.PUBLIC_NETWORK_PASSPHRASE
)

# Keypair de la plataforma (distribuidor de fondos)
PLATFORM_SECRET_KEY: str = os.environ.get("STELLAR_SECRET_KEY", "")
PLATFORM_KEYPAIR: Optional[Keypair] = (
    Keypair.from_secret(PLATFORM_SECRET_KEY) if PLATFORM_SECRET_KEY else None
)

# Días de gracia antes de reembolso automático
ESCROW_TIMEOUT_DAYS: int = int(os.environ.get("ESCROW_TIMEOUT_DAYS", "180"))

# Imágenes AURA requeridas para liberar el escrow
AURA_IMAGES_MILESTONE: int = int(os.environ.get("AURA_IMAGES_MILESTONE", "10"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("xiima.staking")


# ─────────────────────────────────────────────
# Helpers de base de datos
# ─────────────────────────────────────────────
async def _get_conn() -> asyncpg.Connection:
    """Devuelve una conexión asyncpg al pool."""
    return await asyncpg.connect(DATABASE_URL)


async def get_or_create_skills_progress(conn: asyncpg.Connection, user_id: str) -> asyncpg.Record:
    """Devuelve (o crea) el registro de progreso del usuario."""
    row = await conn.fetchrow(
        "SELECT * FROM user_skills_progress WHERE user_id = $1", user_id
    )
    if not row:
        await conn.execute(
            """
            INSERT INTO user_skills_progress (user_id)
            VALUES ($1)
            ON CONFLICT (user_id) DO NOTHING
            """,
            user_id,
        )
        row = await conn.fetchrow(
            "SELECT * FROM user_skills_progress WHERE user_id = $1", user_id
        )
    return row


# ─────────────────────────────────────────────
# Stellar helpers
# ─────────────────────────────────────────────
def _get_server() -> Server:
    return Server(horizon_url=STELLAR_HORIZON_URL)


def _assert_platform_keypair() -> Keypair:
    if not PLATFORM_KEYPAIR:
        raise EnvironmentError(
            "STELLAR_SECRET_KEY no está configurado. "
            "Agrega la clave secreta de la cuenta de la plataforma al .env"
        )
    return PLATFORM_KEYPAIR


def _load_platform_account(server: Server, keypair: Keypair):
    """Carga la cuenta de la plataforma desde Horizon."""
    return server.load_account(keypair.public_key)


# ─────────────────────────────────────────────
# 1. Crear Claimable Balance (cuando llega orden de Hotmart)
# ─────────────────────────────────────────────
async def create_staking_escrow(
    user_id: str,
    user_stellar_pubkey: str,
    hotmart_order_id: str,
    amount_xlm: Decimal,
    course_id: Optional[str] = None,
) -> dict:
    """
    Crea un Claimable Balance en Stellar y registra el escrow en PostgreSQL.

    El estudiante es claimant incondicional (puede reclamar una vez que el
    API confirme el milestone). La plataforma es claimant de respaldo con
    un predicado temporal de ESCROW_TIMEOUT_DAYS días.

    Returns:
        dict con balance_id, escrow_id y status.
    """
    kp = _assert_platform_keypair()
    server = _get_server()
    asset = Asset.native()  # XLM

    log.info(
        f"Creando escrow — user={user_id} order={hotmart_order_id} "
        f"amount={amount_xlm} XLM pubkey={user_stellar_pubkey[:8]}..."
    )

    # Claimants:
    # - Estudiante: incondicional (la API controla el acceso al balance_id)
    # - Plataforma: reclamable si el estudiante no completa en X días
    student_claimant = Claimant(destination=user_stellar_pubkey)
    platform_claimant = Claimant(
        destination=kp.public_key,
        predicate=Claimant.predicate_not(
            Claimant.predicate_before_relative_time(
                seconds=ESCROW_TIMEOUT_DAYS * 24 * 3600
            )
        ),
    )

    platform_account = _load_platform_account(server, kp)

    tx = (
        TransactionBuilder(
            source_account=platform_account,
            network_passphrase=NETWORK_PASSPHRASE,
            base_fee=100,
        )
        .append_operation(
            CreateClaimableBalance(
                asset=asset,
                amount=str(amount_xlm),
                claimants=[student_claimant, platform_claimant],
            )
        )
        .set_timeout(30)
        .build()
    )
    tx.sign(kp)

    response = server.submit_transaction(tx)
    balance_id: str = response["id"] if "id" in response else _extract_balance_id(response)

    log.info(f"✅ Claimable Balance creado — balance_id={balance_id}")

    # Persistir en base de datos
    conn = await _get_conn()
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO educational_escrows
                (user_id, user_stellar_pubkey, hotmart_order_id, course_id,
                 amount_xlm, stellar_balance_id, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'active')
            ON CONFLICT (hotmart_order_id) DO UPDATE SET
                stellar_balance_id = EXCLUDED.stellar_balance_id,
                status             = 'active',
                updated_at         = NOW()
            RETURNING id, stellar_balance_id, status
            """,
            user_id,
            user_stellar_pubkey,
            hotmart_order_id,
            course_id,
            amount_xlm,
            balance_id,
        )
    finally:
        await conn.close()

    return {
        "escrow_id": row["id"],
        "balance_id": row["stellar_balance_id"],
        "status": row["status"],
        "amount_xlm": float(amount_xlm),
        "network": STELLAR_NETWORK,
    }


def _extract_balance_id(response: dict) -> str:
    """Extrae el balance_id del resultado de la transacción Stellar."""
    try:
        effects = response.get("_embedded", {}).get("records", [])
        for effect in effects:
            if effect.get("type") == "claimable_balance_created":
                return effect["balance_id"]
    except Exception:
        pass
    # Fallback: hash de la transacción
    return response.get("hash", "unknown")


# ─────────────────────────────────────────────
# 2. Registrar imagen procesada en AURA
# ─────────────────────────────────────────────
async def record_aura_image(user_id: str, image_count: int = 1) -> dict:
    """
    Incrementa el contador de imágenes AURA del usuario.
    Si alcanza el milestone, dispara la liberación del escrow.

    Returns:
        dict con progreso actualizado y si se liberó el escrow.
    """
    conn = await _get_conn()
    try:
        progress = await get_or_create_skills_progress(conn, user_id)
        new_count = progress["aura_images_processed"] + image_count

        await conn.execute(
            """
            UPDATE user_skills_progress
            SET aura_images_processed = $2,
                last_activity_at      = NOW()
            WHERE user_id = $1
            """,
            user_id,
            new_count,
        )

        log.info(
            f"AURA update — user={user_id} images={new_count}/{AURA_IMAGES_MILESTONE}"
        )

        milestone_reached = new_count >= AURA_IMAGES_MILESTONE
        released_escrows: list[dict] = []

        if milestone_reached:
            released_escrows = await _release_escrows_for_user(
                conn, user_id, milestone_type="aura_images"
            )

        return {
            "user_id": user_id,
            "aura_images_processed": new_count,
            "milestone_required": AURA_IMAGES_MILESTONE,
            "milestone_reached": milestone_reached,
            "released_escrows": released_escrows,
        }
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# 3. Registrar aplicación a hackatón (portfolio milestone)
# ─────────────────────────────────────────────
async def record_hackathon_application(
    user_id: str,
    hackathon_id: str,
    hackathon_title: str,
    source: str = "dorahacks",
) -> dict:
    """
    Registra que el usuario aplicó a una hackatón.
    Esto cuenta como milestone válido para liberar el staking.

    Returns:
        dict con progreso actualizado y escrows liberados.
    """
    conn = await _get_conn()
    try:
        progress = await get_or_create_skills_progress(conn, user_id)

        # Verificar que no haya aplicado ya a esta misma hackatón
        applications: list = json.loads(progress["hackathon_applications"] or "[]")
        already_applied = any(a.get("hackathon_id") == hackathon_id for a in applications)

        if not already_applied:
            applications.append(
                {
                    "hackathon_id": hackathon_id,
                    "title": hackathon_title,
                    "source": source,
                    "applied_at": datetime.now(timezone.utc).isoformat(),
                }
            )

            await conn.execute(
                """
                UPDATE user_skills_progress
                SET hackathon_applications = $2::jsonb,
                    last_activity_at       = NOW()
                WHERE user_id = $1
                """,
                user_id,
                json.dumps(applications),
            )

            log.info(
                f"Hackathon application — user={user_id} hackathon={hackathon_id} ({hackathon_title})"
            )

        # Cualquier aplicación a hackatón libera el escrow (Proof of Skill)
        released_escrows = await _release_escrows_for_user(
            conn, user_id, milestone_type="hackathon_application"
        )

        return {
            "user_id": user_id,
            "hackathon_applied": hackathon_id,
            "total_applications": len(applications),
            "already_registered": already_applied,
            "released_escrows": released_escrows,
        }
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# 4. Lógica interna de liberación de fondos
# ─────────────────────────────────────────────
async def _release_escrows_for_user(
    conn: asyncpg.Connection,
    user_id: str,
    milestone_type: str,
) -> list[dict]:
    """
    Busca todos los escrows 'active' del usuario y los libera en Stellar.
    Registra milestone_type y milestone_reached_at en la BD.
    """
    escrows = await conn.fetch(
        """
        SELECT id, stellar_balance_id, user_stellar_pubkey, amount_xlm
        FROM educational_escrows
        WHERE user_id = $1 AND status = 'active'
        """,
        user_id,
    )

    if not escrows:
        log.info(f"No hay escrows activos para user={user_id}")
        return []

    released = []
    for escrow in escrows:
        result = await _send_payment_to_student(
            destination=escrow["user_stellar_pubkey"],
            amount_xlm=Decimal(str(escrow["amount_xlm"])),
            memo=f"DeEd PoS milestone:{milestone_type}",
        )

        if result["success"]:
            await conn.execute(
                """
                UPDATE educational_escrows
                SET status               = 'released',
                    milestone_type       = $2,
                    milestone_reached_at = NOW(),
                    updated_at           = NOW()
                WHERE id = $1
                """,
                escrow["id"],
                milestone_type,
            )

            # Incrementar contador de milestones en progreso
            await conn.execute(
                """
                UPDATE user_skills_progress
                SET total_milestones_reached = total_milestones_reached + 1
                WHERE user_id = $1
                """,
                user_id,
            )

            log.info(
                f"✅ Escrow liberado — escrow_id={escrow['id']} "
                f"tx={result.get('tx_hash', 'N/A')} milestone={milestone_type}"
            )
            released.append(
                {
                    "escrow_id": escrow["id"],
                    "amount_xlm": float(escrow["amount_xlm"]),
                    "tx_hash": result.get("tx_hash"),
                    "milestone_type": milestone_type,
                }
            )
        else:
            log.error(
                f"❌ Error liberando escrow {escrow['id']}: {result.get('error')}"
            )

    return released


async def _send_payment_to_student(
    destination: str,
    amount_xlm: Decimal,
    memo: str = "DeEd Proof of Skill",
) -> dict:
    """
    Envía un pago directo desde la cuenta de la plataforma al estudiante.
    Alternativa más simple al Claimable Balance claim (evita que el estudiante
    necesite firmar la transacción de claim).
    """
    try:
        kp = _assert_platform_keypair()
        server = _get_server()
        platform_account = _load_platform_account(server, kp)

        tx = (
            TransactionBuilder(
                source_account=platform_account,
                network_passphrase=NETWORK_PASSPHRASE,
                base_fee=100,
            )
            .append_payment_op(
                destination=destination,
                asset=Asset.native(),
                amount=str(amount_xlm),
            )
            .add_text_memo(memo[:28])  # Stellar memo máx 28 bytes
            .set_timeout(30)
            .build()
        )
        tx.sign(kp)
        response = server.submit_transaction(tx)

        return {"success": True, "tx_hash": response.get("hash")}

    except Exception as exc:
        log.error(f"Error en pago Stellar: {exc}")
        return {"success": False, "error": str(exc)}


# ─────────────────────────────────────────────
# 5. Consultas de estado
# ─────────────────────────────────────────────
async def get_user_escrow_status(user_id: str) -> dict:
    """Devuelve todos los escrows y el progreso de habilidades del usuario."""
    conn = await _get_conn()
    try:
        escrows = await conn.fetch(
            """
            SELECT id, hotmart_order_id, course_id, amount_xlm,
                   stellar_balance_id, status, milestone_type,
                   milestone_reached_at, created_at
            FROM educational_escrows
            WHERE user_id = $1
            ORDER BY created_at DESC
            """,
            user_id,
        )

        progress = await get_or_create_skills_progress(conn, user_id)

        return {
            "user_id": user_id,
            "escrows": [dict(e) for e in escrows],
            "skills_progress": {
                "aura_images_processed": progress["aura_images_processed"],
                "hackathon_applications": json.loads(
                    progress["hackathon_applications"] or "[]"
                ),
                "total_milestones_reached": progress["total_milestones_reached"],
                "aura_milestone_required": AURA_IMAGES_MILESTONE,
                "last_activity_at": (
                    progress["last_activity_at"].isoformat()
                    if progress["last_activity_at"]
                    else None
                ),
            },
        }
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# CLI de prueba rápida
# ─────────────────────────────────────────────
async def _demo():
    """Ejemplo de uso en Testnet."""
    log.info("=== Demo Staking Manager — Stellar Testnet ===")

    user_id = "user_santiago_demo"
    # Genera un keypair temporal para el demo
    student_kp = Keypair.random()
    log.info(f"Student keypair: {student_kp.public_key}")

    # 1. Simular compra en Hotmart
    result = await create_staking_escrow(
        user_id=user_id,
        user_stellar_pubkey=student_kp.public_key,
        hotmart_order_id="HOTMART-TEST-001",
        amount_xlm=Decimal("50"),
        course_id=None,
    )
    log.info(f"Escrow creado: {result}")

    # 2. Simular 10 imágenes en AURA
    for i in range(1, 11):
        aura_result = await record_aura_image(user_id=user_id, image_count=1)
        log.info(f"AURA imagen #{i}: {aura_result}")
        if aura_result["milestone_reached"]:
            log.info("🎉 ¡Milestone AURA alcanzado! Fondos liberados.")
            break

    status = await get_user_escrow_status(user_id)
    log.info(f"Estado final: {json.dumps(status, default=str, indent=2)}")


if __name__ == "__main__":
    asyncio.run(_demo())
