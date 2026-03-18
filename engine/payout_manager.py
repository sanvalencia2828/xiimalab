"""
engine/payout_manager.py
─────────────────────────────────────────────────────────────────────────────
Payout Oracle — El Sistema Circulatorio de Xiimalab DeEd

Única pieza del sistema con acceso directo a la Hot Wallet de tesorería.

Arquitectura dual de escucha:
  ┌─────────────────────────────────────────────────┐
  │  Supabase Realtime (WebSocket)                  │ ← Trigger inmediato
  │  user_skills_progress → is_completed = TRUE     │
  └─────────────────────────┬───────────────────────┘
                            │
  ┌─────────────────────────▼───────────────────────┐
  │  Fallback Polling (asyncpg, cada 30s)           │ ← Captura eventos perdidos
  │  Busca active/failed_retry con retry < MAX      │
  └─────────────────────────┬───────────────────────┘
                            │
  ┌─────────────────────────▼───────────────────────┐
  │  Validación de Identidad Blockchain             │
  │  1. Verifica educational_escrows (DB)           │
  │  2. Verifica Claimable Balance en Horizon       │
  └─────────────────────────┬───────────────────────┘
                            │
  ┌─────────────────────────▼───────────────────────┐
  │  Ejecución Stellar                              │
  │  • Intento A: ClaimClaimableBalance (plataforma)│
  │  • Intento B: Payment directo al estudiante     │
  └─────────────────────────┬───────────────────────┘
                            │
  ┌─────────────────────────▼───────────────────────┐
  │  Registro de Auditoría                          │
  │  ✅ status='released' + transaction_hash        │
  │  ❌ status='failed_retry' + payout_error        │
  └─────────────────────────────────────────────────┘

Nota sobre Stellar Mechanics:
  ClaimClaimableBalance solo puede ser firmado por el CLAIMANT del balance.
  En nuestro diseño hay dos claimants:
    - Estudiante: claimant incondicional (puede reclamar siempre)
    - Plataforma: claimant condicional (puede reclamar después de ESCROW_TIMEOUT_DAYS)

  Para pago INMEDIATO al completar milestone:
    → La plataforma envía un Payment directo al estudiante (op más simple y robusta)
    → Si el balance_id corresponde a la plataforma como claimant incondicional,
      se ejecuta ClaimClaimableBalance primero (fondos vuelven a tesorería),
      luego Payment al estudiante.

Env vars requeridas (leer de .env — NUNCA hardcoded):
  STELLAR_PLATFORM_SECRET   ← Hot wallet de tesorería (PROTEGER)
  SUPABASE_URL              ← URL del proyecto Supabase
  SUPABASE_SERVICE_KEY      ← Service Role Key (full access, NO la anon key)
  DATABASE_URL              ← PostgreSQL directo (asyncpg)
  STELLAR_NETWORK           ← testnet | mainnet (default: testnet)
  MAX_RETRIES               ← intentos antes de marcar como failed_permanent (default: 3)
  POLL_INTERVAL_SEC         ← segundos entre polls de fallback (default: 30)
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from decimal import Decimal
from typing import Optional

import asyncpg
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# Config — solo desde env, nunca hardcoded
# ─────────────────────────────────────────────
STELLAR_PLATFORM_SECRET = os.environ.get("STELLAR_PLATFORM_SECRET", "")
STELLAR_NETWORK         = os.environ.get("STELLAR_NETWORK", "testnet")
DATABASE_URL            = os.environ.get("DATABASE_URL", "postgresql://xiima:secret@db:5432/xiimalab")
SUPABASE_URL            = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY    = os.environ.get("SUPABASE_SERVICE_KEY", "")
MAX_RETRIES             = int(os.environ.get("MAX_RETRIES", "3"))
POLL_INTERVAL_SEC       = int(os.environ.get("POLL_INTERVAL_SEC", "30"))

HORIZON_URL = (
    "https://horizon-testnet.stellar.org"
    if STELLAR_NETWORK == "testnet"
    else "https://horizon.stellar.org"
)

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("xiima.payout_oracle")

# ─────────────────────────────────────────────
# Importar Stellar SDK (lazy para no crashear si falta)
# ─────────────────────────────────────────────
try:
    from stellar_sdk import (
        Asset, Keypair, Network, Server, TransactionBuilder,
    )
    from stellar_sdk.operation import ClaimClaimableBalance, Payment
    from stellar_sdk.exceptions import NotFoundError, BaseHorizonError
    STELLAR_AVAILABLE = True
except ImportError:
    log.critical("stellar-sdk no instalado. Ejecuta: pip install stellar-sdk>=10.0.0")
    STELLAR_AVAILABLE = False


# ══════════════════════════════════════════════════════════════════
# PASO 1 — Escucha de Eventos: Supabase Realtime
# ══════════════════════════════════════════════════════════════════

async def start_realtime_listener(event_queue: asyncio.Queue) -> None:
    """
    Se suscribe a cambios en user_skills_progress via Supabase Realtime.
    Cuando is_completed cambia a TRUE, encola el user_id para procesamiento.

    Si supabase-py no está disponible, esta función es silenciosa y
    el fallback de polling cubre el caso.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        log.warning(
            "Realtime deshabilitado — SUPABASE_URL o SUPABASE_SERVICE_KEY no configuradas. "
            "Solo fallback de polling activo."
        )
        return

    try:
        from supabase import acreate_client  # supabase-py v2 async
    except ImportError:
        log.warning("supabase-py no instalado. Realtime deshabilitado. Solo polling activo.")
        return

    try:
        client  = await acreate_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        channel = client.channel("payout-oracle")

        def on_change(payload: dict) -> None:
            """Callback de Realtime — evalúa si is_completed pasó a TRUE."""
            try:
                new_record = payload.get("new", {}) or {}
                old_record = payload.get("old", {}) or {}

                # Solo disparar cuando is_completed cambia FALSE→TRUE
                was_false = not old_record.get("is_completed", False)
                is_now_true = new_record.get("is_completed", False)

                if was_false and is_now_true:
                    user_id = new_record.get("user_id")
                    if user_id:
                        log.info(f"🔔 Realtime: is_completed=TRUE detectado para {user_id}")
                        asyncio.get_event_loop().call_soon_threadsafe(
                            event_queue.put_nowait, user_id
                        )
            except Exception as exc:
                log.error(f"on_change error: {exc}")

        (
            channel
            .on_postgres_changes(
                event="UPDATE",
                schema="public",
                table="user_skills_progress",
                callback=on_change,
            )
        )

        await channel.subscribe()
        log.info("✅ Supabase Realtime activo — escuchando user_skills_progress")

        # Mantener la conexión abierta indefinidamente
        await asyncio.Event().wait()

    except Exception as exc:
        log.error(f"Realtime connection error: {exc} — Polling cubrirá los eventos.")


# ══════════════════════════════════════════════════════════════════
# PASO 2 — Validación de Identidad Blockchain
# ══════════════════════════════════════════════════════════════════

async def fetch_active_escrow(conn: asyncpg.Connection, user_id: str) -> Optional[asyncpg.Record]:
    """
    Busca el escrow activo (o failed_retry con reintentos disponibles)
    para el usuario en educational_escrows.
    """
    return await conn.fetchrow(
        """
        SELECT id, user_stellar_pubkey, stellar_balance_id,
               amount_xlm, hotmart_order_id, retry_count
        FROM educational_escrows
        WHERE user_id    = $1
          AND status     IN ('active', 'failed_retry')
          AND retry_count < $2
        ORDER BY created_at ASC
        LIMIT 1
        """,
        user_id,
        MAX_RETRIES,
    )


def verify_claimable_balance_on_horizon(balance_id: str) -> dict:
    """
    Consulta Horizon para confirmar que el Claimable Balance existe
    y no ha sido reclamado.

    Returns:
        {"exists": bool, "amount": str, "claimants": list, "error": str|None}
    """
    if not STELLAR_AVAILABLE:
        return {"exists": False, "amount": "0", "claimants": [], "error": "stellar-sdk no disponible"}

    try:
        server  = Server(horizon_url=HORIZON_URL)
        balance = server.claimable_balances().claimable_balance(balance_id).call()
        claimants = [c["destination"] for c in balance.get("claimants", [])]
        amount    = balance.get("amount", "0")
        log.info(
            f"  Horizon CB: id={balance_id[:20]}...  "
            f"amount={amount} XLM  "
            f"claimants={claimants}"
        )
        return {"exists": True, "amount": amount, "claimants": claimants, "error": None}

    except NotFoundError:
        return {"exists": False, "amount": "0", "claimants": [], "error": "Balance no encontrado en Stellar"}
    except Exception as exc:
        return {"exists": False, "amount": "0", "claimants": [], "error": str(exc)}


# ══════════════════════════════════════════════════════════════════
# PASO 3 — Ejecución del Pago en Stellar
# ══════════════════════════════════════════════════════════════════

def execute_payout(
    student_pubkey: str,
    balance_id: str,
    amount_xlm: Decimal,
    escrow_id: int,
) -> dict:
    """
    Construye, firma y envía la transacción de pago en Stellar.

    Estrategia:
      1. Si el Claimable Balance existe y la plataforma es claimant:
         → ClaimClaimableBalance (fondos vuelven a tesorería)
         → Payment al estudiante
      2. Si el CB no existe (ya reclamado, o no era para plataforma):
         → Payment directo al estudiante desde tesorería

    La transacción es firmada por STELLAR_PLATFORM_SECRET (fee payer = plataforma).

    Returns:
        {
          "success": bool,
          "transaction_hash": str | None,
          "operations": list[str],
          "error": str | None
        }
    """
    if not STELLAR_AVAILABLE:
        return {"success": False, "transaction_hash": None, "operations": [], "error": "stellar-sdk no disponible"}

    if not STELLAR_PLATFORM_SECRET:
        return {"success": False, "transaction_hash": None, "operations": [], "error": "STELLAR_PLATFORM_SECRET no configurada"}

    platform_kp = Keypair.from_secret(STELLAR_PLATFORM_SECRET)
    server      = Server(horizon_url=HORIZON_URL)
    passphrase  = (
        Network.TESTNET_NETWORK_PASSPHRASE
        if STELLAR_NETWORK == "testnet"
        else Network.PUBLIC_NETWORK_PASSPHRASE
    )

    operations_used = []

    try:
        platform_account = server.load_account(platform_kp.public_key)

        # ── Verificar si la plataforma puede reclamar el CB ──
        cb_info = verify_claimable_balance_on_horizon(balance_id) if balance_id else {"exists": False}
        platform_is_claimant = (
            cb_info["exists"] and
            platform_kp.public_key in cb_info.get("claimants", [])
        )

        builder = TransactionBuilder(
            source_account=platform_account,
            network_passphrase=passphrase,
            base_fee=100,
        )
        builder.add_text_memo(f"DeEd PoS release #{escrow_id}")
        builder.set_timeout(30)

        # ── Estrategia A: ClaimCB (plataforma es claimant) + Payment ──
        if platform_is_claimant and balance_id:
            log.info(f"  [escrow #{escrow_id}] Estrategia A: ClaimCB + Payment")
            builder.append_operation(ClaimClaimableBalance(balance_id=balance_id))
            operations_used.append("ClaimClaimableBalance")

        # ── Estrategia B (siempre): Payment directo al estudiante ──
        log.info(
            f"  [escrow #{escrow_id}] Payment → {student_pubkey[:12]}...  "
            f"({amount_xlm} XLM)"
        )
        builder.append_operation(
            Payment(
                destination=student_pubkey,
                asset=Asset.native(),
                amount=str(amount_xlm),
            )
        )
        operations_used.append("Payment")

        # ── Firmar y enviar ──
        tx = builder.build()
        tx.sign(platform_kp)

        response = server.submit_transaction(tx)
        tx_hash  = response.get("hash")

        log.info(
            f"  [escrow #{escrow_id}] ✅ TX enviada  "
            f"hash={tx_hash}  "
            f"ops={operations_used}"
        )
        return {
            "success":          True,
            "transaction_hash": tx_hash,
            "operations":       operations_used,
            "error":            None,
        }

    except BaseHorizonError as exc:
        result_codes = getattr(exc, "extras", {}) or {}
        error_msg    = f"HorizonError: {exc}  codes={result_codes}"
        log.error(f"  [escrow #{escrow_id}] ❌ Stellar failed: {error_msg}")
        return {"success": False, "transaction_hash": None, "operations": operations_used, "error": error_msg}

    except Exception as exc:
        error_msg = f"Unexpected: {exc}"
        log.error(f"  [escrow #{escrow_id}] ❌ Error inesperado: {error_msg}")
        return {"success": False, "transaction_hash": None, "operations": operations_used, "error": error_msg}


# ══════════════════════════════════════════════════════════════════
# PASO 4 — Registro de Auditoría
# ══════════════════════════════════════════════════════════════════

async def record_payout_success(
    conn: asyncpg.Connection,
    escrow_id: int,
    user_id: str,
    tx_hash: str,
) -> None:
    """Cierra el ciclo: status='released' + transaction_hash en DB."""
    async with conn.transaction():
        await conn.execute(
            """
            UPDATE educational_escrows
            SET status               = 'released',
                transaction_hash     = $1,
                milestone_reached_at = NOW(),
                payout_error         = NULL,
                updated_at           = NOW()
            WHERE id = $2
            """,
            tx_hash, escrow_id,
        )
        await conn.execute(
            """
            UPDATE user_skills_progress
            SET validator_processed_at  = NOW(),
                total_milestones_reached = total_milestones_reached + 1,
                updated_at              = NOW()
            WHERE user_id = $1
            """,
            user_id,
        )
    log.info(
        f"  [escrow #{escrow_id}] DB actualizado → "
        f"status=released  tx_hash={tx_hash}"
    )


async def record_payout_failure(
    conn: asyncpg.Connection,
    escrow_id: int,
    user_id: str,
    error: str,
    retry_count: int,
) -> None:
    """
    Marca como failed_retry (si quedan intentos) o failed_permanent.
    Emite log CRÍTICO para alerta inmediata.
    """
    next_count  = retry_count + 1
    next_status = "failed_retry" if next_count < MAX_RETRIES else "failed_permanent"

    await conn.execute(
        """
        UPDATE educational_escrows
        SET status      = $1,
            payout_error = $2,
            retry_count  = $3,
            updated_at   = NOW()
        WHERE id = $4
        """,
        next_status, error[:1000], next_count, escrow_id,
    )

    if next_status == "failed_permanent":
        log.critical(
            f"🚨 PAGO PERMANENTEMENTE FALLIDO  "
            f"escrow=#{escrow_id}  user={user_id}  "
            f"intentos={next_count}/{MAX_RETRIES}  "
            f"error={error[:200]}"
        )
    else:
        log.error(
            f"  [escrow #{escrow_id}] ❌ Reintento {next_count}/{MAX_RETRIES}  "
            f"error={error[:200]}"
        )


# ══════════════════════════════════════════════════════════════════
# Orquestador principal — procesa un user_id
# ══════════════════════════════════════════════════════════════════

async def process_payout(user_id: str) -> None:
    """
    Pipeline completo para un estudiante:
    validación → Stellar → auditoría.
    """
    log.info(f"▶ Procesando payout: user={user_id}")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # 1. Buscar escrow activo en DB
        escrow = await fetch_active_escrow(conn, user_id)
        if not escrow:
            log.info(f"  user={user_id} sin escrow activo — omitiendo")
            return

        escrow_id   = escrow["id"]
        balance_id  = escrow["stellar_balance_id"] or ""
        student_pk  = escrow["user_stellar_pubkey"]
        amount_xlm  = Decimal(str(escrow["amount_xlm"]))
        retry_count = escrow["retry_count"]

        log.info(
            f"  Escrow #{escrow_id}  "
            f"order={escrow['hotmart_order_id']}  "
            f"amount={amount_xlm} XLM  "
            f"student={student_pk[:12]}...  "
            f"retry={retry_count}"
        )

        # 2. Ejecutar pago en Stellar (bloqueante — corre en executor)
        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            execute_payout,
            student_pk, balance_id, amount_xlm, escrow_id,
        )

        # 3. Registrar resultado
        if result["success"]:
            await record_payout_success(
                conn,
                escrow_id=escrow_id,
                user_id=user_id,
                tx_hash=result["transaction_hash"],
            )
            log.info(
                f"🎉 PAGO LIBERADO  "
                f"user={user_id}  "
                f"amount={amount_xlm} XLM  "
                f"→ {student_pk[:20]}...  "
                f"tx={result['transaction_hash']}"
            )
        else:
            await record_payout_failure(
                conn,
                escrow_id=escrow_id,
                user_id=user_id,
                error=result["error"] or "unknown",
                retry_count=retry_count,
            )

    except asyncpg.PostgresError as exc:
        log.error(f"DB error para user={user_id}: {exc}")
    except Exception as exc:
        log.exception(f"Error inesperado en process_payout({user_id}): {exc}")
    finally:
        await conn.close()


# ══════════════════════════════════════════════════════════════════
# Fallback: polling periódico
# ══════════════════════════════════════════════════════════════════

async def fallback_polling_loop(event_queue: asyncio.Queue) -> None:
    """
    Corre cada POLL_INTERVAL_SEC segundos.
    Captura eventos que el Realtime pudo haber perdido por desconexión.
    """
    log.info(f"⏰ Fallback polling activo — intervalo: {POLL_INTERVAL_SEC}s")

    while True:
        await asyncio.sleep(POLL_INTERVAL_SEC)
        try:
            conn = await asyncpg.connect(DATABASE_URL)
            try:
                rows = await conn.fetch(
                    """
                    SELECT usp.user_id
                    FROM user_skills_progress usp
                    JOIN educational_escrows ee
                      ON ee.user_id   = usp.user_id
                     AND ee.status    IN ('active', 'failed_retry')
                     AND ee.retry_count < $1
                    WHERE usp.is_completed         = TRUE
                      AND usp.validator_processed_at IS NULL
                    """,
                    MAX_RETRIES,
                )
            finally:
                await conn.close()

            for row in rows:
                uid = row["user_id"]
                log.info(f"🔄 Polling detectó pendiente: {uid}")
                await event_queue.put(uid)

        except asyncpg.PostgresError as exc:
            log.error(f"Polling DB error: {exc}")
        except Exception as exc:
            log.warning(f"Polling loop error: {exc}")


# ══════════════════════════════════════════════════════════════════
# Consumer de la cola de eventos
# ══════════════════════════════════════════════════════════════════

async def event_consumer(event_queue: asyncio.Queue) -> None:
    """
    Consume user_ids de la cola y procesa los pagos secuencialmente.
    Evita procesar el mismo user_id dos veces concurrentemente.
    """
    in_flight: set[str] = set()

    while True:
        user_id = await event_queue.get()
        try:
            if user_id in in_flight:
                log.debug(f"Ya procesando {user_id} — descartando duplicado")
                continue
            in_flight.add(user_id)
            await process_payout(user_id)
        finally:
            in_flight.discard(user_id)
            event_queue.task_done()


# ══════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════

async def main() -> None:
    log.info("=" * 65)
    log.info("  Payout Oracle — Xiimalab DeEd")
    log.info(f"  Red Stellar  : {STELLAR_NETWORK.upper()}")
    log.info(f"  Horizon URL  : {HORIZON_URL}")
    log.info(f"  Max Retries  : {MAX_RETRIES}")
    log.info(f"  Poll Interval: {POLL_INTERVAL_SEC}s")
    if STELLAR_PLATFORM_SECRET:
        try:
            from stellar_sdk import Keypair as KP
            pub = KP.from_secret(STELLAR_PLATFORM_SECRET).public_key
            log.info(f"  Hot Wallet   : {pub[:20]}...")
        except Exception:
            log.info("  Hot Wallet   : configurada (no se pudo leer pubkey)")
    else:
        log.warning("  ⚠️  STELLAR_PLATFORM_SECRET no configurada — pagos deshabilitados")
    if SUPABASE_URL:
        log.info(f"  Supabase     : {SUPABASE_URL[:40]}...")
    else:
        log.warning("  Supabase Realtime: deshabilitado (SUPABASE_URL no configurada)")
    log.info("=" * 65)

    event_queue: asyncio.Queue[str] = asyncio.Queue()

    await asyncio.gather(
        start_realtime_listener(event_queue),   # WebSocket Supabase
        fallback_polling_loop(event_queue),     # Polling de respaldo
        event_consumer(event_queue),            # Procesador de pagos
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Payout Oracle detenido por el usuario")
    except Exception as exc:
        log.critical(f"Fatal: {exc}", exc_info=True)
        sys.exit(1)
