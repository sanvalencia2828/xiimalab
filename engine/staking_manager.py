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
  funded   → XLM depositado en Claimable Balance
  active   → Claimable Balance creado en Stellar y listo para ser reclamado
  released → milestone alcanzado, pago enviado al estudiante
  refunded → inactividad > ESCROW_TIMEOUT_DAYS días

Lifecycle Phases Tracking:
  - Phase 1: Enrollment (pending/funded)
  - Phase 2: Active Monitoring (active)
  - Phase 3: Milestone Achievement (released)
  - Phase 4: Completion/Timeout (refunded/released)

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


async def log_lifecycle_phase(
    conn: asyncpg.Connection,
    user_id: str,
    escrow_id: str,
    phase: str,
    details: dict = None
) -> None:
    """
    Registra una fase del ciclo de vida del escrow para seguimiento.

    Args:
        conn: Conexión a la base de datos
        user_id: ID del usuario
        escrow_id: ID del escrow
        phase: Fase del ciclo de vida ('enrollment', 'funded', 'active', 'milestone_achieved', 'completed', 'timeout')
        details: Detalles adicionales sobre la fase
    """
    try:
        await conn.execute(
            """
            INSERT INTO escrow_lifecycle_log (user_id, escrow_id, phase, details, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            """,
            user_id, escrow_id, phase, json.dumps(details) if details else None
        )
        log.info(f".lifecycle {user_id} — {phase} phase logged for escrow {escrow_id}")
    except Exception as exc:
        log.error(f"Error logging lifecycle phase for {user_id}: {exc}")


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
# Crear escrow para nuevo pago (Hotmart webhook)
# ─────────────────────────────────────────────
async def create_staking_escrow(
    user_id: str,
    user_stellar_pubkey: str,
    hotmart_order_id: str,
    amount_xlm: Decimal,
    course_id: str | None = None,
) -> dict:
    """
    Crea un nuevo escrow educativo cuando llega un pago de Hotmart.

    Args:
        user_id: ID del usuario (buyer email)
        user_stellar_pubkey: Clave pública Stellar del estudiante
        hotmart_order_id: ID único de la orden en Hotmart
        amount_xlm: Cantidad de XLM a reembolsar
        course_id: ID del curso opcional

    Returns:
        Dict con escrow_id, status, y detalles del escrow creado

    Raises:
        ValueError: Si el orden ya existe o falta información
    """
    conn = await _connect()
    try:
        # Validar entrada
        if not user_id or not user_stellar_pubkey or not hotmart_order_id:
            raise ValueError("Missing required fields: user_id, user_stellar_pubkey, hotmart_order_id")

        # Validar que el stellar public key sea válido (56 caracteres, empieza con 'G')
        if len(user_stellar_pubkey) != 56 or not user_stellar_pubkey.startswith("G"):
            raise ValueError(f"Invalid Stellar public key: {user_stellar_pubkey}")

        # Verificar que no existe ya un escrow para esta orden
        existing = await conn.fetchrow(
            "SELECT id FROM educational_escrows WHERE hotmart_order_id = $1",
            hotmart_order_id
        )
        if existing:
            raise ValueError(f"Escrow for order {hotmart_order_id} already exists")

        # Crear el escrow en estado 'pending'
        escrow_id = await conn.fetchval(
            """
            INSERT INTO educational_escrows (
                user_id, user_stellar_pubkey, hotmart_order_id, amount_xlm,
                course_id, status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
            RETURNING id
            """,
            user_id, user_stellar_pubkey, hotmart_order_id, amount_xlm, course_id
        )

        # Crear registro de progreso del usuario si no existe
        await get_or_create_skills_progress(conn, user_id)

        # Log la fase de enrollment
        await log_lifecycle_phase(
            conn,
            user_id,
            str(escrow_id),
            "enrollment",
            {
                "hotmart_order_id": hotmart_order_id,
                "amount_xlm": float(amount_xlm),
                "course_id": course_id
            }
        )

        log.info(
            f"✨ Escrow #{escrow_id} created for {user_id[:20]}... "
            f"Order={hotmart_order_id} Amount={amount_xlm} XLM"
        )

        return {
            "success": True,
            "escrow_id": escrow_id,
            "user_id": user_id,
            "status": "pending",
            "amount_xlm": float(amount_xlm),
            "balance_id": None,  # Se asignará cuando se deposite XLM
            "order_id": hotmart_order_id,
        }

    except ValueError as exc:
        log.error(f"Validation error creating escrow: {exc}")
        raise
    except Exception as exc:
        log.error(f"Error creating staking escrow: {exc}", exc_info=True)
        raise
    finally:
        await conn.close()


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
            # Log milestone achieved phase
            await log_lifecycle_phase(
                conn,
                user_id,
                escrow["id"],
                "milestone_achieved",
                {
                    "milestone_type": milestone_type,
                    "amount_xlm": float(escrow["amount_xlm"]),
                    "tx_hash": result.get("tx_hash")
                }
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


async def fund_escrow(
    conn: asyncpg.Connection,
    escrow_id: str,
    stellar_balance_id: str,
    amount_xlm: Decimal
) -> bool:
    """
    Actualiza un escrow de 'pending' a 'funded' cuando se deposita XLM en el Claimable Balance.

    Args:
        conn: Conexión a la base de datos
        escrow_id: ID del escrow
        stellar_balance_id: ID del balance en Stellar
        amount_xlm: Cantidad de XLM depositada

    Returns:
        True si se actualizó correctamente, False en caso de error
    """
    try:
        await conn.execute(
            """
            UPDATE educational_escrows
            SET status = 'funded',
                stellar_balance_id = $2,
                updated_at = NOW()
            WHERE id = $1 AND status = 'pending'
            """,
            escrow_id,
            stellar_balance_id
        )

        # Obtener user_id para logging
        escrow_record = await conn.fetchrow(
            "SELECT user_id FROM educational_escrows WHERE id = $1", escrow_id
        )
        if escrow_record:
            await log_lifecycle_phase(
                conn,
                escrow_record["user_id"],
                escrow_id,
                "funded",
                {
                    "stellar_balance_id": stellar_balance_id,
                    "amount_xlm": float(amount_xlm)
                }
            )

        log.info(f"💰 Escrow #{escrow_id} funded with {amount_xlm} XLM")
        return True
    except Exception as exc:
        log.error(f"Error funding escrow #{escrow_id}: {exc}")
        return False


async def activate_escrow(
    conn: asyncpg.Connection,
    escrow_id: str,
) -> bool:
    """
    Activa un escrow cuando está listo para ser reclamado.

    Args:
        conn: Conexión a la base de datos
        escrow_id: ID del escrow

    Returns:
        True si se actualizó correctamente, False en caso de error
    """
    try:
        await conn.execute(
            """
            UPDATE educational_escrows
            SET status = 'active',
                activated_at = NOW(),
                updated_at = NOW()
            WHERE id = $1 AND status = 'funded'
            """,
            escrow_id
        )

        # Obtener user_id para logging
        escrow_record = await conn.fetchrow(
            "SELECT user_id FROM educational_escrows WHERE id = $1", escrow_id
        )
        if escrow_record:
            await log_lifecycle_phase(
                conn,
                escrow_record["user_id"],
                escrow_id,
                "active",
                {"activated_at": datetime.now(timezone.utc).isoformat()}
            )

        log.info(f"🚀 Escrow #{escrow_id} activated and ready for claiming")
        return True
    except Exception as exc:
        log.error(f"Error activating escrow #{escrow_id}: {exc}")
        return False


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

            # Log completion phase for each released escrow
            for escrow_info in released:
                await log_lifecycle_phase(
                    conn,
                    user_id,
                    escrow_info["escrow_id"],
                    "completed",
                    {
                        "completion_reason": "aura_images_milestone",
                        "final_amount_xlm": escrow_info["amount_xlm"],
                        "tx_hash": escrow_info["tx_hash"]
                    }
                )

        # Log activity phase
        await log_lifecycle_phase(
            conn,
            user_id,
            "N/A",  # No specific escrow for general activity
            "activity_recorded",
            {
                "activity_type": "aura_image_processing",
                "image_count": image_count,
                "total_images_processed": new_count,
                "milestone_reached": milestone_reached
            }
        )

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

        # Log completion phase for each released escrow
        for escrow_info in released:
            await log_lifecycle_phase(
                conn,
                user_id,
                escrow_info["escrow_id"],
                "completed",
                {
                    "completion_reason": "hackathon_application",
                    "hackathon_id": hackathon_id,
                    "hackathon_title": hackathon_title,
                    "final_amount_xlm": escrow_info["amount_xlm"],
                    "tx_hash": escrow_info["tx_hash"]
                }
            )

        # Log activity phase
        await log_lifecycle_phase(
            conn,
            user_id,
            "N/A",  # No specific escrow for general activity
            "activity_recorded",
            {
                "activity_type": "hackathon_application",
                "hackathon_id": hackathon_id,
                "hackathon_title": hackathon_title,
                "total_applications": len(applications),
                "already_registered": already
            }
        )

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
# Manejo de reembolsos por timeout
# ─────────────────────────────────────────────
async def refund_expired_escrows(conn: asyncpg.Connection) -> list[dict]:
    """
    Reembolsa escrows que han excedido el tiempo límite de inactividad.

    Returns:
        Lista de escrows reembolsados.
    """
    try:
        # Encontrar escrows activos que han expirado
        expired_escrows = await conn.fetch(
            """
            SELECT id, user_id, stellar_balance_id, amount_xlm, user_stellar_pubkey
            FROM educational_escrows
            WHERE status = 'active'
            AND created_at < NOW() - INTERVAL '$1 days'
            """,
            ESCROW_TIMEOUT_DAYS
        )

        refunded = []
        for escrow in expired_escrows:
            # Enviar reembolso al usuario
            result = await _send_payment(
                destination=escrow["user_stellar_pubkey"],
                amount_xlm=Decimal(str(escrow["amount_xlm"])),
                memo=f"Refund: Escrow timeout ({ESCROW_TIMEOUT_DAYS} days)"
            )

            if result["success"]:
                # Actualizar estado a refunded
                await conn.execute(
                    """
                    UPDATE educational_escrows
                    SET status = 'refunded',
                        refunded_at = NOW(),
                        updated_at = NOW()
                    WHERE id = $1
                    """,
                    escrow["id"]
                )

                # Registrar fase de timeout
                await log_lifecycle_phase(
                    conn,
                    escrow["user_id"],
                    escrow["id"],
                    "timeout",
                    {
                        "reason": "escrow_expiration",
                        "timeout_days": ESCROW_TIMEOUT_DAYS,
                        "amount_xlm": float(escrow["amount_xlm"]),
                        "tx_hash": result.get("tx_hash")
                    }
                )

                log.info(f"🔄 Escrow #{escrow['id']} refunded due to timeout")
                refunded.append({
                    "escrow_id": escrow["id"],
                    "user_id": escrow["user_id"],
                    "amount_xlm": float(escrow["amount_xlm"]),
                    "tx_hash": result.get("tx_hash")
                })
            else:
                log.error(f"❌ Error refunding escrow #{escrow['id']}: {result.get('error')}")

        return refunded
    except Exception as exc:
        log.error(f"Error processing expired escrows: {exc}")
        return []


# ─────────────────────────────────────────────
# Milestone Approval Workflow (NEW)
# ─────────────────────────────────────────────

async def submit_milestone_completion(
    user_id: str,
    escrow_id: int,
    completion_proof_url: str | None = None,
) -> dict:
    """
    Student marks a milestone as completed (Phase 1 of approval workflow).

    Args:
        user_id: Student wallet address or ID
        escrow_id: ID of the escrow contract
        completion_proof_url: Optional URL to evidence (GitHub, screenshot, etc.)

    Returns:
        Milestone completion confirmation

    Raises:
        ValueError: If no pending milestones found
    """
    conn = await _connect()
    try:
        # Find first pending milestone (marked_completed_at IS NULL)
        milestone = await conn.fetchrow(
            """
            SELECT id, milestone_number
            FROM escrow_milestones
            WHERE escrow_id = $1 AND marked_completed_at IS NULL
            ORDER BY milestone_number ASC
            LIMIT 1
            """,
            escrow_id,
        )

        if not milestone:
            raise ValueError(f"No pending milestones found for escrow {escrow_id}")

        milestone_id = milestone["id"]

        # Mark milestone as completed
        await conn.execute(
            """
            UPDATE escrow_milestones
            SET marked_completed_at = NOW(),
                completion_proof_url = $2,
                updated_at = NOW()
            WHERE id = $1
            """,
            milestone_id,
            completion_proof_url,
        )

        # Log state transition
        await conn.execute(
            """
            INSERT INTO escrow_timeline (escrow_id, from_state, to_state, actor, reason, metadata)
            VALUES ($1, 'MILESTONE_UPDATES', 'MILESTONE_UPDATES', $2, 'student_submitted_milestone', $3)
            """,
            escrow_id,
            user_id,
            json.dumps({"milestone_id": milestone_id}),
        )

        log.info(
            f"✅ Milestone #{milestone_id} marked completed by {user_id[:8]}... for escrow #{escrow_id}"
        )

        return {
            "milestone_id": milestone_id,
            "status": "marked_completed",
            "marked_completed_at": datetime.now(timezone.utc).isoformat(),
        }

    finally:
        await conn.close()


async def approve_milestone(
    coach_address: str,
    escrow_id: int,
    milestone_id: int,
    approver_notes: str | None = None,
) -> dict:
    """
    Coach approves a milestone. If all milestones are approved, transitions
    the escrow to RELEASE state and triggers payment.

    Args:
        coach_address: Coach's wallet address (for audit)
        escrow_id: ID of the escrow
        milestone_id: ID of the milestone to approve
        approver_notes: Optional notes from coach

    Returns:
        Approval confirmation and escrow status

    Raises:
        ValueError: If milestone not found or not marked completed
    """
    conn = await _connect()
    try:
        # Verify milestone exists and is marked completed
        milestone = await conn.fetchrow(
            """
            SELECT id, escrow_id, marked_completed_at
            FROM escrow_milestones
            WHERE id = $1 AND escrow_id = $2
            """,
            milestone_id,
            escrow_id,
        )

        if not milestone:
            raise ValueError(f"Milestone {milestone_id} not found in escrow {escrow_id}")

        if not milestone["marked_completed_at"]:
            raise ValueError(
                f"Milestone {milestone_id} must be marked completed before approval"
            )

        # Approve the milestone
        await conn.execute(
            """
            UPDATE escrow_milestones
            SET approved_at = NOW(),
                approver_notes = $2,
                updated_at = NOW()
            WHERE id = $1
            """,
            milestone_id,
            approver_notes,
        )

        # Log approval transition
        await conn.execute(
            """
            INSERT INTO escrow_timeline (escrow_id, from_state, to_state, actor, reason, metadata)
            VALUES ($1, 'MILESTONE_UPDATES', 'APPROVAL', $2, 'coach_approved_milestone', $3)
            """,
            escrow_id,
            coach_address,
            json.dumps(
                {"milestone_id": milestone_id, "notes": approver_notes or ""}
            ),
        )

        # Check if ALL milestones are now approved
        approval_check = await conn.fetchrow(
            """
            SELECT
                el.total_milestones,
                COUNT(em.id) as approved_count
            FROM escrow_ledger el
            LEFT JOIN escrow_milestones em
                ON em.escrow_id = el.id AND em.approved_at IS NOT NULL
            WHERE el.id = $1
            GROUP BY el.id
            """,
            escrow_id,
        )

        all_approved = (
            approval_check["total_milestones"] > 0
            and approval_check["approved_count"] == approval_check["total_milestones"]
        )

        if all_approved:
            # Transition to RELEASE
            await conn.execute(
                "UPDATE escrow_ledger SET current_state = 'RELEASE' WHERE id = $1",
                escrow_id,
            )

            # Log final transition
            await conn.execute(
                """
                INSERT INTO escrow_timeline (escrow_id, from_state, to_state, actor, reason)
                VALUES ($1, 'APPROVAL', 'RELEASE', $2, 'all_milestones_approved')
                """,
                escrow_id,
                coach_address,
            )

            log.info(
                f"✅ All milestones approved for escrow #{escrow_id} — transitioning to RELEASE"
            )

        await conn.commit()

        return {
            "milestone_id": milestone_id,
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "all_milestones_approved": all_approved,
        }

    except ValueError as exc:
        await conn.close()
        raise
    except Exception as exc:
        log.error(f"Error approving milestone: {exc}")
        await conn.close()
        raise


async def reject_milestone(
    coach_address: str,
    escrow_id: int,
    milestone_id: int,
    rejection_reason: str,
    allow_resubmission: bool = True,
) -> dict:
    """
    Coach rejects a milestone with a reason.

    Args:
        coach_address: Coach's wallet address (for audit)
        escrow_id: ID of the escrow
        milestone_id: ID of the milestone to reject
        rejection_reason: Reason for rejection
        allow_resubmission: Can student resubmit?

    Returns:
        Rejection confirmation

    Raises:
        ValueError: If milestone not found
    """
    conn = await _connect()
    try:
        # Verify milestone exists
        milestone = await conn.fetchrow(
            """
            SELECT id FROM escrow_milestones
            WHERE id = $1 AND escrow_id = $2
            """,
            milestone_id,
            escrow_id,
        )

        if not milestone:
            raise ValueError(f"Milestone {milestone_id} not found")

        if allow_resubmission:
            # Reset to pending
            await conn.execute(
                """
                UPDATE escrow_milestones
                SET marked_completed_at = NULL,
                    completion_proof_url = NULL,
                    updated_at = NOW()
                WHERE id = $1
                """,
                milestone_id,
            )
        else:
            # Mark as permanently rejected
            await conn.execute(
                """
                UPDATE escrow_milestones
                SET marked_completed_at = NULL,
                    completion_proof_url = NULL,
                    approver_notes = $2,
                    updated_at = NOW()
                WHERE id = $1
                """,
                milestone_id,
                f"REJECTED: {rejection_reason}",
            )

        # Log rejection
        await conn.execute(
            """
            INSERT INTO escrow_timeline (escrow_id, from_state, to_state, actor, reason, metadata)
            VALUES ($1, 'MILESTONE_UPDATES', 'MILESTONE_UPDATES', $2, 'milestone_rejected', $3)
            """,
            escrow_id,
            coach_address,
            json.dumps(
                {
                    "milestone_id": milestone_id,
                    "reason": rejection_reason,
                    "allow_resubmission": allow_resubmission,
                }
            ),
        )

        await conn.commit()

        log.info(
            f"⚠️ Milestone #{milestone_id} rejected for escrow #{escrow_id} — resubmission={'allowed' if allow_resubmission else 'not allowed'}"
        )

        return {
            "milestone_id": milestone_id,
            "status": "rejected",
            "rejection_reason": rejection_reason,
            "allow_resubmission": allow_resubmission,
        }

    except ValueError as exc:
        await conn.close()
        raise
    except Exception as exc:
        log.error(f"Error rejecting milestone: {exc}")
        await conn.close()
        raise


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
        # Procesar reembolsos por timeout
        refunded = await refund_expired_escrows(conn)
        if refunded:
            log.info(f"[monitor] {len(refunded)} escrow(s) refunded due to timeout")

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
