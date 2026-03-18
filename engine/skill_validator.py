"""
engine/skill_validator.py
─────────────────────────────────────────────────────────────────────────────
Skill Validator — El Vigilante de Proof of Skill

Ciclo de vida:
  1. Vigila user_skills_progress WHERE is_completed = TRUE
     AND validator_processed_at IS NULL (no procesado aún)
  2. Busca en educational_escrows el stellar_balance_id con status = 'active'
     para ese usuario
  3. Ejecuta ClaimClaimableBalance en Stellar Testnet:
     - La cuenta de la plataforma (tesorería) reclama su propio claimable balance
     - Luego envía el monto al estudiante via Payment
  4. Si la transacción es exitosa:
     - educational_escrows.status → 'released'
     - user_skills_progress.validator_processed_at → NOW()
     - Log detallado con tx_hash y montos

Nota sobre Stellar Mechanics:
  Los Claimable Balances en Stellar solo pueden ser reclamados por sus claimants.
  La plataforma es el "source" que creó el CB y también está listada como claimant
  de respaldo (sin restricción de tiempo para permitir liberación manual).
  Flujo: platform.ClaimCB → fondos vuelven a la cuenta plataforma → Payment → estudiante.

Ejecución:
  python skill_validator.py          → corre el watcher cada 60s
  VALIDATOR_INTERVAL_SEC=30 python skill_validator.py  → intervalo personalizado

Docker: servicio skill-validator en docker-compose.yml
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import asyncpg
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from stellar_sdk import (
    Asset,
    Keypair,
    Network,
    Server,
    TransactionBuilder,
)
from stellar_sdk.operation import ClaimClaimableBalance, Payment
from stellar_sdk.exceptions import NotFoundError, BaseHorizonError

load_dotenv()

# ─────────────────────────────────────────────
# Configuración
# ─────────────────────────────────────────────
DATABASE_URL         = os.environ.get("DATABASE_URL", "postgresql://xiima:secret@db:5432/xiimalab")
STELLAR_NETWORK      = os.environ.get("STELLAR_NETWORK", "testnet")
STELLAR_SECRET_KEY   = os.environ.get("STELLAR_SECRET_KEY", "")
VALIDATOR_INTERVAL   = int(os.environ.get("VALIDATOR_INTERVAL_SEC", "60"))

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

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("xiima.validator")


# ─────────────────────────────────────────────
# 1. Consulta: estudiantes con milestone completado
# ─────────────────────────────────────────────
async def fetch_pending_releases(conn: asyncpg.Connection) -> list[asyncpg.Record]:
    """
    Retorna filas de user_skills_progress donde:
      - is_completed = TRUE   (frontend marcó el milestone)
      - validator_processed_at IS NULL  (aún no procesado por este validador)
    """
    return await conn.fetch(
        """
        SELECT usp.user_id,
               usp.aura_images_processed,
               usp.hackathon_applications,
               usp.total_milestones_reached,
               ee.id            AS escrow_id,
               ee.stellar_balance_id,
               ee.user_stellar_pubkey,
               ee.amount_xlm,
               ee.hotmart_order_id
        FROM user_skills_progress usp
        JOIN educational_escrows ee
          ON ee.user_id = usp.user_id
         AND ee.status  = 'active'
        WHERE usp.is_completed         = TRUE
          AND usp.validator_processed_at IS NULL
        ORDER BY usp.updated_at ASC
        """
    )


# ─────────────────────────────────────────────
# 2. Stellar: ClaimClaimableBalance + Payment
# ─────────────────────────────────────────────
async def claim_and_release(
    balance_id: str,
    student_pubkey: str,
    amount_xlm: Decimal,
    escrow_id: int,
) -> dict:
    """
    Paso 1 — ClaimClaimableBalance:
      La cuenta de la plataforma reclama el balance (los fondos vuelven a la tesorería).

    Paso 2 — Payment:
      La tesorería envía los fondos al estudiante.

    Si el balance_id ya fue reclamado o no existe, saltamos al Payment directo.

    Returns:
        {"success": True, "claim_tx": str, "payment_tx": str}
        {"success": False, "error": str}
    """
    if not STELLAR_SECRET_KEY:
        return {"success": False, "error": "STELLAR_SECRET_KEY no configurada en .env"}

    platform_kp = Keypair.from_secret(STELLAR_SECRET_KEY)
    server      = Server(horizon_url=HORIZON_URL)

    claim_tx_hash   : Optional[str] = None
    payment_tx_hash : Optional[str] = None

    # ── Paso 1: ClaimClaimableBalance ────────────────────
    try:
        log.info(f"  [escrow #{escrow_id}] ClaimClaimableBalance → {balance_id[:20]}...")
        platform_account = server.load_account(platform_kp.public_key)

        claim_tx = (
            TransactionBuilder(
                source_account=platform_account,
                network_passphrase=NETWORK_PASSPHRASE,
                base_fee=100,
            )
            .append_operation(
                ClaimClaimableBalance(balance_id=balance_id)
            )
            .add_text_memo(f"claim-{escrow_id}")
            .set_timeout(30)
            .build()
        )
        claim_tx.sign(platform_kp)
        claim_response  = server.submit_transaction(claim_tx)
        claim_tx_hash   = claim_response.get("hash")
        log.info(f"  [escrow #{escrow_id}] ✅ CB reclamado — tx: {claim_tx_hash}")

    except NotFoundError:
        log.warning(
            f"  [escrow #{escrow_id}] CB {balance_id[:20]}... no encontrado en Stellar "
            f"(ya reclamado o expirado) — continuando con Payment directo"
        )
    except BaseHorizonError as exc:
        result_codes = getattr(exc, "extras", {}) or {}
        log.warning(
            f"  [escrow #{escrow_id}] CB claim falló ({exc}) — "
            f"result_codes={result_codes} — continuando con Payment directo"
        )
    except Exception as exc:
        log.error(f"  [escrow #{escrow_id}] Error inesperado en ClaimCB: {exc}")
        # No abortamos — intentamos Payment de todas formas

    # ── Paso 2: Payment al estudiante ────────────────────
    try:
        log.info(
            f"  [escrow #{escrow_id}] Payment → {student_pubkey[:8]}... "
            f"({amount_xlm} XLM)"
        )
        # Recargar cuenta por si el balance cambió tras el claim
        platform_account = server.load_account(platform_kp.public_key)

        payment_tx = (
            TransactionBuilder(
                source_account=platform_account,
                network_passphrase=NETWORK_PASSPHRASE,
                base_fee=100,
            )
            .append_operation(
                Payment(
                    destination=student_pubkey,
                    asset=Asset.native(),
                    amount=str(amount_xlm),
                )
            )
            .add_text_memo(f"DeEd PoS #{escrow_id}")
            .set_timeout(30)
            .build()
        )
        payment_tx.sign(platform_kp)
        payment_response = server.submit_transaction(payment_tx)
        payment_tx_hash  = payment_response.get("hash")
        log.info(
            f"  [escrow #{escrow_id}] ✅ Payment enviado — tx: {payment_tx_hash}"
        )

        return {
            "success":    True,
            "claim_tx":   claim_tx_hash,
            "payment_tx": payment_tx_hash,
        }

    except BaseHorizonError as exc:
        err = str(exc)
        log.error(f"  [escrow #{escrow_id}] ❌ Payment falló: {err}")
        return {"success": False, "error": err}

    except Exception as exc:
        log.error(f"  [escrow #{escrow_id}] ❌ Error inesperado en Payment: {exc}")
        return {"success": False, "error": str(exc)}


# ─────────────────────────────────────────────
# 3. Cerrar el ciclo en PostgreSQL
# ─────────────────────────────────────────────
async def mark_released(
    conn: asyncpg.Connection,
    escrow_id: int,
    user_id: str,
    claim_tx: Optional[str],
    payment_tx: Optional[str],
) -> None:
    """
    Actualiza educational_escrows.status → 'released'
    y user_skills_progress.validator_processed_at → NOW().
    """
    async with conn.transaction():
        await conn.execute(
            """
            UPDATE educational_escrows
            SET status               = 'released',
                milestone_type       = 'is_completed_flag',
                milestone_reached_at = NOW(),
                updated_at           = NOW()
            WHERE id = $1
            """,
            escrow_id,
        )
        await conn.execute(
            """
            UPDATE user_skills_progress
            SET validator_processed_at  = NOW(),
                total_milestones_reached = total_milestones_reached + 1,
                updated_at               = NOW()
            WHERE user_id = $1
            """,
            user_id,
        )

    log.info(
        f"  [escrow #{escrow_id}] DB actualizado → status=released  "
        f"claim_tx={claim_tx or 'N/A'}  payment_tx={payment_tx or 'N/A'}"
    )


async def mark_failed(
    conn: asyncpg.Connection,
    user_id: str,
    error: str,
) -> None:
    """Marca el registro como intentado para no re-procesarlo en bucle."""
    await conn.execute(
        """
        UPDATE user_skills_progress
        SET validator_processed_at = NOW(),
            updated_at             = NOW()
        WHERE user_id = $1
        """,
        user_id,
    )
    log.error(f"  user={user_id} marcado con error para evitar bucle: {error}")


# ─────────────────────────────────────────────
# 4. Job principal — El Vigilante
# ─────────────────────────────────────────────
async def validator_job() -> None:
    """
    Consulta periódica de milestones completados y libera los fondos.
    Diseñado para ser robusto: un fallo individual no detiene el batch.
    """
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        pending = await fetch_pending_releases(conn)

        if not pending:
            log.debug("Vigilante: sin releases pendientes.")
            return

        log.info(f"🔍 Vigilante: {len(pending)} release(s) pendiente(s)")

        for row in pending:
            user_id      = row["user_id"]
            escrow_id    = row["escrow_id"]
            balance_id   = row["stellar_balance_id"] or ""
            student_pk   = row["user_stellar_pubkey"]
            amount_xlm   = Decimal(str(row["amount_xlm"]))
            order_id     = row["hotmart_order_id"]

            log.info(
                f"▶  Procesando: user={user_id}  "
                f"escrow=#{escrow_id}  "
                f"order={order_id}  "
                f"amount={amount_xlm} XLM"
            )

            result = await claim_and_release(
                balance_id=balance_id,
                student_pubkey=student_pk,
                amount_xlm=amount_xlm,
                escrow_id=escrow_id,
            )

            if result["success"]:
                await mark_released(
                    conn,
                    escrow_id=escrow_id,
                    user_id=user_id,
                    claim_tx=result.get("claim_tx"),
                    payment_tx=result.get("payment_tx"),
                )
                log.info(
                    f"🎉 ¡FONDOS LIBERADOS! "
                    f"user={user_id}  "
                    f"amount={amount_xlm} XLM  "
                    f"→  {student_pk[:12]}..."
                )
            else:
                await mark_failed(conn, user_id, result.get("error", "unknown"))

    except asyncpg.PostgresError as exc:
        log.error(f"DB error en validator_job: {exc}")
    except Exception as exc:
        log.exception(f"Error inesperado en validator_job: {exc}")
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
async def main() -> None:
    log.info("=" * 60)
    log.info("  Skill Validator — El Vigilante de Proof of Skill")
    log.info(f"  Red Stellar : {STELLAR_NETWORK.upper()}")
    log.info(f"  Intervalo   : {VALIDATOR_INTERVAL}s")
    log.info(f"  Cuenta      : {Keypair.from_secret(STELLAR_SECRET_KEY).public_key[:20]}..." if STELLAR_SECRET_KEY else "  ⚠️  STELLAR_SECRET_KEY no configurada")
    log.info("=" * 60)

    # Ejecución inmediata al arrancar
    await validator_job()

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        validator_job,
        trigger="interval",
        seconds=VALIDATOR_INTERVAL,
        id="skill_validator",
        max_instances=1,          # evitar ejecuciones paralelas
        misfire_grace_time=30,
    )
    scheduler.start()
    log.info(f"⏰ Scheduler activo — próxima ejecución en {VALIDATOR_INTERVAL}s")

    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        log.info("Skill Validator detenido")


if __name__ == "__main__":
    asyncio.run(main())
