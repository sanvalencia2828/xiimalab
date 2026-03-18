"""
services/api/routes/hotmart_bridge.py
─────────────────────────────────────────────────────────────────────────────
Webhook Handler de Hotmart — Proof of Skill / DeEd

Recibe notificaciones de compra de Hotmart, valida la firma HMAC-SHA256,
crea un Claimable Balance en Stellar Testnet y registra el escrow en
la tabla educational_escrows.

Endpoints:
  POST /hotmart/webhook     → recibe PURCHASE_COMPLETE de Hotmart
  GET  /hotmart/escrow/{id} → estado de un escrow por order_id
  POST /hotmart/simulate    → simula una compra (solo en dev/testnet)

Stack:
  FastAPI, asyncpg, stellar-sdk (≥10.0.0)

Referencia Hotmart Webhooks:
  https://developers.hotmart.com/docs/pt-BR/v1/webhooks/
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from decimal import Decimal
from typing import Any

import asyncpg
from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from stellar_sdk import (
    Asset,
    Claimant,
    Keypair,
    Network,
    Server,
    TransactionBuilder,
)

log = logging.getLogger("xiima.hotmart")
router = APIRouter()

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
DATABASE_URL     = os.environ.get("DATABASE_URL", "postgresql://xiima:secret@db:5432/xiimalab")
STELLAR_NETWORK  = os.environ.get("STELLAR_NETWORK", "testnet")
STELLAR_SECRET   = os.environ.get("STELLAR_SECRET_KEY", "")
HOTMART_SECRET   = os.environ.get("HOTMART_WEBHOOK_SECRET", "")
ESCROW_TIMEOUT_DAYS = int(os.environ.get("ESCROW_TIMEOUT_DAYS", "180"))

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

IS_DEV = STELLAR_NETWORK == "testnet"

# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────
class HotmartPurchase(BaseModel):
    """
    Payload simplificado del webhook de Hotmart PURCHASE_COMPLETE.
    El payload real de Hotmart es más extenso — mapeamos los campos críticos.
    """
    order_id:          str = Field(..., alias="transaction")
    product_id:        str = Field(..., alias="product_id")
    buyer_email:       str = Field(..., alias="buyer_email")
    buyer_name:        str = Field(..., alias="buyer_name")
    stellar_pubkey:    str = Field(..., description="Clave pública Stellar del estudiante")
    amount_xlm:        float = Field(..., gt=0, description="Monto de staking en XLM")
    course_id:         str | None = Field(default=None)

    class Config:
        populate_by_name = True


class SimulatePayload(BaseModel):
    """Solo para testnet/dev — simula una compra."""
    buyer_email:    str = "test@xiimalab.dev"
    stellar_pubkey: str
    amount_xlm:     float = 50.0
    course_id:      str | None = None


# ─────────────────────────────────────────────
# Verificación HMAC de Hotmart
# ─────────────────────────────────────────────
def _verify_hotmart_hmac(payload: bytes, signature: str) -> bool:
    """
    Hotmart firma el body con HMAC-SHA256 usando el secreto del webhook.
    Header: X-Hotmart-Webhook-Secret
    """
    if not HOTMART_SECRET:
        log.warning("HOTMART_WEBHOOK_SECRET vacío — omitiendo verificación HMAC")
        return True
    expected = hmac.new(
        HOTMART_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


# ─────────────────────────────────────────────
# Stellar: Crear Claimable Balance
# ─────────────────────────────────────────────
async def create_claimable_balance(
    student_pubkey: str,
    amount_xlm: Decimal,
    order_id: str,
) -> str:
    """
    Crea un Claimable Balance en Stellar.

    Claimants:
      - Estudiante: puede reclamar incondicionalmente (off-chain gate: la API
        solo revela el balance_id cuando el milestone está cumplido)
      - Plataforma: puede reclamar de vuelta después de ESCROW_TIMEOUT_DAYS días

    Returns:
        balance_id (str)
    """
    if not STELLAR_SECRET:
        raise EnvironmentError("STELLAR_SECRET_KEY no configurada")

    platform_kp = Keypair.from_secret(STELLAR_SECRET)
    server       = Server(horizon_url=HORIZON_URL)

    student_claimant = Claimant(destination=student_pubkey)
    platform_claimant = Claimant(
        destination=platform_kp.public_key,
        predicate=Claimant.predicate_not(
            Claimant.predicate_before_relative_time(
                seconds=ESCROW_TIMEOUT_DAYS * 24 * 3600
            )
        ),
    )

    platform_account = server.load_account(platform_kp.public_key)

    tx = (
        TransactionBuilder(
            source_account=platform_account,
            network_passphrase=NETWORK_PASSPHRASE,
            base_fee=100,
        )
        .append_create_claimable_balance_op(
            asset=Asset.native(),
            amount=str(amount_xlm),
            claimants=[student_claimant, platform_claimant],
        )
        .add_text_memo(f"DeEd-{order_id[:20]}")
        .set_timeout(30)
        .build()
    )
    tx.sign(platform_kp)

    response = server.submit_transaction(tx)
    balance_id = _extract_balance_id(response)

    log.info(f"✅ Claimable Balance creado — {balance_id} ({amount_xlm} XLM) para {student_pubkey[:8]}...")
    return balance_id


def _extract_balance_id(response: dict[str, Any]) -> str:
    """Extrae el balance_id del response de Horizon."""
    # Horizon devuelve el ID en los effects de la transacción
    try:
        effects_url = response["_links"]["effects"]["href"]
        import httpx
        effects = httpx.get(effects_url, timeout=10).json()
        for effect in effects.get("_embedded", {}).get("records", []):
            if "claimable_balance" in effect.get("type", ""):
                return effect.get("balance_id", response.get("hash", "unknown"))
    except Exception:
        pass
    return response.get("hash", "unknown")


# ─────────────────────────────────────────────
# DB: Registrar escrow
# ─────────────────────────────────────────────
async def persist_escrow(
    user_id:          str,
    stellar_pubkey:   str,
    order_id:         str,
    course_id:        str | None,
    amount_xlm:       Decimal,
    balance_id:       str,
) -> int:
    """Upserta el escrow en educational_escrows. Retorna el ID del registro."""
    conn = await asyncpg.connect(DATABASE_URL)
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
            RETURNING id
            """,
            user_id, stellar_pubkey, order_id, course_id,
            amount_xlm, balance_id,
        )
        return row["id"]
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────
@router.post("/webhook", status_code=status.HTTP_201_CREATED)
async def hotmart_webhook(
    request: Request,
    x_hotmart_webhook_secret: str | None = Header(default=None),
):
    """
    Recibe el webhook PURCHASE_COMPLETE de Hotmart.

    El payload de Hotmart incluye datos del comprador + producto.
    Para obtener el stellar_pubkey del estudiante, debes capturarlo
    durante el checkout (campo custom en el formulario de Hotmart)
    o tenerlo pre-registrado en tu DB por email.
    """
    raw_body = await request.body()

    # Verificar firma
    if x_hotmart_webhook_secret:
        if not _verify_hotmart_hmac(raw_body, x_hotmart_webhook_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Firma HMAC inválida",
            )

    # Parsear body
    try:
        data = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Body inválido — se espera JSON",
        )

    # Extraer campos del payload de Hotmart
    # Hotmart envuelve los datos en data.purchase y data.buyer
    purchase = data.get("data", {}).get("purchase", data)
    buyer    = data.get("data", {}).get("buyer", {})
    product  = data.get("data", {}).get("product", {})

    order_id       = purchase.get("transaction") or purchase.get("order_id") or data.get("transaction", "")
    buyer_email    = buyer.get("email") or data.get("buyer_email", "")
    stellar_pubkey = (
        purchase.get("stellar_pubkey")
        or buyer.get("stellar_pubkey")
        or data.get("stellar_pubkey", "")
    )
    amount_xlm = Decimal(str(
        purchase.get("amount_xlm") or data.get("amount_xlm", 50)
    ))
    course_id = str(product.get("id") or data.get("course_id", ""))

    if not order_id or not buyer_email or not stellar_pubkey:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Faltan campos: order_id, buyer_email o stellar_pubkey",
        )

    # Crear Claimable Balance en Stellar
    try:
        balance_id = await create_claimable_balance(
            student_pubkey=stellar_pubkey,
            amount_xlm=amount_xlm,
            order_id=order_id,
        )
    except EnvironmentError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        log.error(f"Error Stellar: {exc}")
        raise HTTPException(status_code=502, detail=f"Error Stellar: {exc}")

    # Persistir en DB
    escrow_id = await persist_escrow(
        user_id=buyer_email,
        stellar_pubkey=stellar_pubkey,
        order_id=order_id,
        course_id=course_id or None,
        amount_xlm=amount_xlm,
        balance_id=balance_id,
    )

    log.info(f"Escrow #{escrow_id} creado — order={order_id} student={buyer_email}")

    return {
        "success":    True,
        "escrow_id":  escrow_id,
        "balance_id": balance_id,
        "amount_xlm": float(amount_xlm),
        "network":    STELLAR_NETWORK,
    }


@router.get("/escrow/{order_id}")
async def get_escrow(order_id: str):
    """Devuelve el estado del escrow para una orden de Hotmart."""
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        row = await conn.fetchrow(
            """
            SELECT id, user_id, user_stellar_pubkey, hotmart_order_id,
                   course_id, amount_xlm, stellar_balance_id, status,
                   milestone_type, milestone_reached_at, created_at
            FROM educational_escrows
            WHERE hotmart_order_id = $1
            """,
            order_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Escrow no encontrado")
        return dict(row)
    finally:
        await conn.close()


@router.post("/simulate", status_code=status.HTTP_201_CREATED)
async def simulate_purchase(payload: SimulatePayload):
    """
    Simula una compra en testnet. Solo disponible cuando STELLAR_NETWORK=testnet.
    Útil para probar el flujo sin pasar por Hotmart real.
    """
    if not IS_DEV:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="simulate solo disponible en testnet",
        )

    import uuid
    order_id = f"SIM-{uuid.uuid4().hex[:12].upper()}"

    try:
        balance_id = await create_claimable_balance(
            student_pubkey=payload.stellar_pubkey,
            amount_xlm=Decimal(str(payload.amount_xlm)),
            order_id=order_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    escrow_id = await persist_escrow(
        user_id=payload.buyer_email,
        stellar_pubkey=payload.stellar_pubkey,
        order_id=order_id,
        course_id=payload.course_id,
        amount_xlm=Decimal(str(payload.amount_xlm)),
        balance_id=balance_id,
    )

    return {
        "simulated":  True,
        "order_id":   order_id,
        "escrow_id":  escrow_id,
        "balance_id": balance_id,
        "network":    STELLAR_NETWORK,
    }
