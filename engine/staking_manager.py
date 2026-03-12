"""
engine/staking_manager.py
─────────────────────────────────────────────────────────────────────────────
Motor de Proof of Skill — Liberación automática de escrows

Responsabilidades:
  1. Monitorear user_skills_progress para detectar milestones completados
  2. Liberar automáticamente el Claimable Balance (payment a estudiante)
  3. Actualizar educational_escrows con milestone_type y released status
  4. Exponerse como módulo importable por FastAPI y como proceso standalone

Flujo de vida del escrow:
  pending  → orden Hotmart recibida, sin balance en Stellar
  active   → Claimable Balance creado en Stellar
  released → milestone alcanzado, pago enviado al estudiante
  refunded → inactividad > ESCROW_TIMEOUT_DAYS días

Milestones válidos:
  - aura_images:             procesó >= AURA_IMAGES_MILESTONE imágenes en AURA
  - hackathon_application:   aplicó a al menos 1 hackatón

Dependencias:
  asyncpg >= 0.29.0
  stellar-sdk >= 10.0.0
  apscheduler >= 3.10.0
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
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

from stellar_sdk import Asset, Keypair, Network, Server, TransactionBuilder

load_dotenv()

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
DATABASE_URL         = os.environ.get("DATABASE_URL", "postgresql://xiima:secret@db:5432/xiimalab")
STELLAR_NETWORK      = os.environ.get("STELLAR_NETWORK", "testnet")
STELLAR_SECRET_KEY   = os.environ.get("STELLAR_SECRET_KEY", "")
AURA_IMAGES_MILESTONE = int(os.environ.get("AURA_IMAGES_MILESTONE", "10"))
ESCROW_TIMEOUT_DAYS  = int(os.environ.get("ESCROW_TIMEOUT_DAYS", "180"))
MONITOR_INTERVAL_SEC = int(os.environ.get("STAKING_MONITOR_INTERVAL_SEC", "60"))

HORIZON_URL = (
    "https://horizon-testnet.stellar.org"
    if STELLAR_NETWORK == "testnet"
    else "https://horizon.stellar.org"
)
NETWORK_PASSPHRASE = (
    Network.TESTNET_NETWORK_PASSPHRASE
    if STELLAR_NETWORK == "testnet"
    else Network.PUBLIC_NETWORK_PASSPHRASE
)

log = logging.getLogger("xiima.staking")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)


# ─────────────────────────────────────────────
# DB helpers
# ─────────────────────────────────────────────
async def _connect() -> asyncpg.Connection:
    return await asyncpg.connect(DATABASE_URL)


async def get_or_create_skills_progress(
    conn: asyncpg.Connection, user_id: str
) -> asyncpg.Record:
    """Devuelve o crea el registro de progreso del usuario."""
    row = await conn.fetchrow(
        "SELECT * FROM user_skills_progress WHERE user_id = $1", user_id
    )
    if not row:
        await conn.execute(
            "INSERT INTO user_skills_progress (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
            user_id,
        )
        row = await conn.fetchrow(
            "SELECT * FROM user_skills_progress WHERE user_id = $1", user_id
        )
    return row


# ─────────────────────────────────────────────
# Stellar: pago directo al estudiante
# ─────────────────────────────────────────────
async def _send_payment(
    destination: str,
    amount_xlm: Decimal,
    memo: str = "DeEd Proof of Skill",
) -> dict:
    """
    Envía XLM desde la cuenta de la plataforma al estudiante.
    Más simple que hacer claim del Claimable Balance (evita requerir firma del estudiante).
    """
    if not STELLAR_SECRET_KEY:
        return {"success": False, "error": "STELLAR_SECRET_KEY no configurada"}

    try:
        kp      = Keypair.from_secret(STELLAR_SECRET_KEY)
        server  = Server(horizon_url=HORIZON_URL)
        account = server.load_account(kp.public_key)

        tx = (
            TransactionBuilder(
                source_account=account,
                network_passphrase=NETWORK_PASSPHRASE,
                base_fee=100,
            )
            .append_payment_op(
                destination=destination,
                asset=Asset.native(),
                amount=str(amount_xlm),
            )
            .add_text_memo(memo[:28])
            .set_timeout(30)
            .build()
        )
        tx.sign(kp)
        response = server.submit_transaction(tx)
        return {"success": True, "tx_hash": response.get("hash")}

    except Exception as exc:
        log.error(f"Error pago Stellar → {destination[:8]}...: {exc}")
        return {"success": False, "error": str(exc)}


# ─────────────────────────────────────────────
# Core: liberar escrows para un usuario
# ─────────────────────────────────────────────
async def release_escrows_for_user(
    conn: asyncpg.Connection,
    user_id: str,
    milestone_type: str,
) -> list[dict]:
    """
    Busca todos los escrows 'active' del usuario, envía el pago Stellar
    y actualiza el estado a 'released'.

    Returns:
        Lista de escrows liberados con tx_hash.
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
        return []

    released = []
    for escrow in escrows:
        result = await _send_payment(
            destination=escrow["user_stellar_pubkey"],
            amount_xlm=Decimal(str(escrow["amount_xlm"])),
            memo=f"PoS:{milestone_type[:20]}",
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
            await conn.execute(
                """
                UPDATE user_skills_progress
                SET total_milestones_reached = total_milestones_reached + 1
                WHERE user_id = $1
                """,
                user_id,
            )
            log.info(
                f"✅ Escrow #{escrow['id']} liberado — "
                f"tx={result.get('tx_hash', 'N/A')} milestone={milestone_type}"
            )
            released.append({
                "escrow_id":     escrow["id"],
                "amount_xlm":    float(escrow["amount_xlm"]),
                "tx_hash":       result.get("tx_hash"),
                "milestone_type": milestone_type,
            })
        else:
            log.error(f"❌ Error liberando escrow #{escrow['id']}: {result.get('error')}")

    return released


# ─────────────────────────────────────────────
# Registro de actividad AURA
# ─────────────────────────────────────────────
async def record_aura_image(user_id: str, image_count: int = 1) -> dict:
    """
    Incrementa el contador de imágenes AURA.
    Si alcanza AURA_IMAGES_MILESTONE, libera automáticamente el escrow.
    """
    conn = await _connect()
    try:
        progress  = await get_or_create_skills_progress(conn, user_id)
        new_count = progress["aura_images_processed"] + image_count

        await conn.execute(
            """
            UPDATE user_skills_progress
            SET aura_images_processed = $2,
                last_activity_at      = NOW()
            WHERE user_id = $1
            """,
            user_id, new_count,
        )

        milestone_reached = new_count >= AURA_IMAGES_MILESTONE
        released: list[dict] = []

        if milestone_reached:
            released = await release_escrows_for_user(conn, user_id, "aura_images")

        return {
            "user_id":              user_id,
            "aura_images_processed": new_count,
            "milestone_required":   AURA_IMAGES_MILESTONE,
            "milestone_reached":    milestone_reached,
            "released_escrows":     released,
        }
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# Registro de aplicación a hackatón
# ─────────────────────────────────────────────
async def record_hackathon_application(
    user_id: str,
    hackathon_id: str,
    hackathon_title: str,
    source: str = "dorahacks",
) -> dict:
    """
    Registra la aplicación del usuario a una hackatón y libera el escrow.
    Cualquier aplicación cuenta como Proof of Skill de portafolio.
    """
    conn = await _connect()
    try:
        progress     = await get_or_create_skills_progress(conn, user_id)
        applications = json.loads(progress["hackathon_applications"] or "[]")

        already = any(a.get("hackathon_id") == hackathon_id for a in applications)
        if not already:
            applications.append({
                "hackathon_id":  hackathon_id,
                "title":         hackathon_title,
                "source":        source,
                "applied_at":    datetime.now(timezone.utc).isoformat(),
            })
            await conn.execute(
                """
                UPDATE user_skills_progress
                SET hackathon_applications = $2::jsonb,
                    last_activity_at       = NOW()
                WHERE user_id = $1
                """,
                user_id, json.dumps(applications),
            )

        released = await release_escrows_for_user(conn, user_id, "hackathon_application")

        return {
            "user_id":              user_id,
            "hackathon_applied":    hackathon_id,
            "total_applications":   len(applications),
            "already_registered":   already,
            "released_escrows":     released,
        }
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# Estado del usuario
# ─────────────────────────────────────────────
async def get_user_escrow_status(user_id: str) -> dict:
    """Devuelve escrows y progreso de habilidades del usuario."""
    conn = await _connect()
    try:
        escrows  = await conn.fetch(
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
                "aura_images_processed":   progress["aura_images_processed"],
                "hackathon_applications":  json.loads(progress["hackathon_applications"] or "[]"),
                "total_milestones_reached": progress["total_milestones_reached"],
                "aura_milestone_required": AURA_IMAGES_MILESTONE,
            },
        }
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# Monitor automático — job periódico
# ─────────────────────────────────────────────
async def _monitor_job() -> None:
    """
    Revisa periódicamente todos los usuarios con escrows 'active'
    y comprueba si alguno ya alcanzó el milestone pero el escrow
    no se liberó (por ejemplo, si el webhook falló).

    Condición de liberación automática:
      - aura_images_processed >= AURA_IMAGES_MILESTONE, o
      - hackathon_applications contiene al menos 1 entrada
    """
    conn = await _connect()
    try:
        # Usuarios con escrows activos
        users = await conn.fetch(
            """
            SELECT DISTINCT user_id
            FROM educational_escrows
            WHERE status = 'active'
            """
        )

        for row in users:
            uid      = row["user_id"]
            progress = await get_or_create_skills_progress(conn, uid)

            images   = progress["aura_images_processed"]
            hackathons = json.loads(progress["hackathon_applications"] or "[]")

            if images >= AURA_IMAGES_MILESTONE:
                released = await release_escrows_for_user(conn, uid, "aura_images")
                if released:
                    log.info(f"[monitor] {uid} — AURA milestone alcanzado, {len(released)} escrow(s) liberado(s)")

            elif len(hackathons) >= 1:
                released = await release_escrows_for_user(conn, uid, "hackathon_application")
                if released:
                    log.info(f"[monitor] {uid} — Hackathon milestone, {len(released)} escrow(s) liberado(s)")

    except Exception as exc:
        log.error(f"[monitor] Error: {exc}", exc_info=True)
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# Entry point standalone (Docker service)
# ─────────────────────────────────────────────
async def main() -> None:
    """Corre el monitor como proceso independiente con APScheduler."""
    log.info(f"🔍 Staking Monitor iniciado — intervalo: {MONITOR_INTERVAL_SEC}s")

    # Ejecución inmediata al arrancar
    await _monitor_job()

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _monitor_job,
        "interval",
        seconds=MONITOR_INTERVAL_SEC,
        id="staking_monitor",
        max_instances=1,
    )
    scheduler.start()

    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        log.info("Staking Monitor detenido")


if __name__ == "__main__":
    asyncio.run(main())
