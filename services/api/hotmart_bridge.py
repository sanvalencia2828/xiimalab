"""
hotmart_bridge.py — Xiimalab
Webhook handler para pagos de Hotmart. Al recibir una compra aprobada,
crea un Claimable Balance en Stellar Testnet y registra el escrow en Supabase.

Flujo:
  1. Hotmart POST → verificar firma HMAC-SHA256
  2. Extraer product_id → mapear a skill_tag
  3. Crear Claimable Balance (fondos custodied on-chain)
  4. INSERT en educational_escrows
"""

import hashlib
import hmac
import json
import logging
import os
from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Header, HTTPException, Request
from stellar_sdk import (
    Asset,
    Claimant,
    ClaimPredicate,
    Keypair,
    Network,
    Server,
    TransactionBuilder,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# ─── Configuración ────────────────────────────────────────────────────────────

HOTMART_SECRET = os.environ.get("HOTMART_WEBHOOK_SECRET", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")  # asyncpg-compatible
STELLAR_PLATFORM_SECRET = os.environ.get("STELLAR_PLATFORM_SECRET_KEY", "")
STELLAR_HORIZON = "https://horizon-testnet.stellar.org"
STELLAR_NETWORK = Network.TESTNET_NETWORK_PASSPHRASE

# Mapeo product_id de Hotmart → (skill_tag, días de ventana del curso, monto XLM de reembolso)
PRODUCT_MAP: dict[str, dict] = {
    "aura_ia_v1":      {"skill_tag": "diseño_ia",       "window_days": 30, "xlm_amount": "50"},
    "blockchain_dev":  {"skill_tag": "blockchain_dev",  "window_days": 45, "xlm_amount": "80"},
    "ai_engineering":  {"skill_tag": "ai_engineering",  "window_days": 60, "xlm_amount": "100"},
}


# ─── Verificación de firma ─────────────────────────────────────────────────────

def _verify_hotmart_signature(payload: bytes, signature: str) -> bool:
    """
    Hotmart firma el body con HMAC-SHA256 usando el secret del dashboard.
    El header llega como: X-Hotmart-Signature: sha256=<hex>
    """
    expected = hmac.new(
        HOTMART_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    received = signature.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)


# ─── Lógica de Stellar ────────────────────────────────────────────────────────

def _build_claimable_balance(
    buyer_stellar_address: str,
    xlm_amount: str,
    window_days: int,
) -> str:
    """
    Crea un Claimable Balance en Stellar Testnet.

    Predicado:
      - El comprador puede reclamar el reembolso SOLO DESPUÉS de
        window_days (tiempo mínimo para completar el curso).
      - La plataforma recupera los fondos si no se reclaman en 1 año.

    Retorna el balance_id para guardar en DB.
    """
    platform_keypair = Keypair.from_secret(STELLAR_PLATFORM_SECRET)
    server = Server(STELLAR_HORIZON)
    account = server.load_account(platform_keypair.public_key)

    # Predicado del comprador: puede reclamar después de window_days
    seconds_window = window_days * 86_400
    buyer_predicate = ClaimPredicate.predicate_not(
        ClaimPredicate.predicate_before_relative_time(seconds_window)
    )

    # Predicado de recuperación de la plataforma: después de 365 días
    platform_predicate = ClaimPredicate.predicate_not(
        ClaimPredicate.predicate_before_relative_time(365 * 86_400)
    )

    claimants = [
        Claimant(destination=buyer_stellar_address, predicate=buyer_predicate),
        Claimant(destination=platform_keypair.public_key, predicate=platform_predicate),
    ]

    tx = (
        TransactionBuilder(
            source_account=account,
            network_passphrase=STELLAR_NETWORK,
            base_fee=100,
        )
        .append_create_claimable_balance_op(
            asset=Asset.native(),
            amount=xlm_amount,
            claimants=claimants,
        )
        .set_timeout(30)
        .build()
    )
    tx.sign(platform_keypair)
    response = server.submit_transaction(tx)

    # El balance_id se deriva del hash de la transacción
    # Horizon devuelve los efectos; lo extraemos del ledger
    balance_id = _extract_balance_id(response)
    return balance_id


def _extract_balance_id(horizon_response: dict) -> str:
    """
    Extrae el claimable_balance_id de la respuesta de Horizon.
    Horizon incluye el balance_id en result_xdr o en los efectos del ledger.
    Usamos el hash de la tx como fallback identificador único.
    """
    # Horizon v2: el resultado XDR contiene el ID tras el decode.
    # Para simplificar, usamos el hash de la transacción como referencia
    # y recuperamos el real con una consulta extra si se necesita.
    return horizon_response.get("hash", "unknown")


# ─── Handler principal ────────────────────────────────────────────────────────

@router.post("/hotmart")
async def hotmart_webhook(
    request: Request,
    x_hotmart_signature: str = Header(alias="X-Hotmart-Signature", default=""),
):
    payload = await request.body()

    # 1. Verificar firma
    if not _verify_hotmart_signature(payload, x_hotmart_signature):
        logger.warning("Hotmart webhook: firma inválida")
        raise HTTPException(status_code=401, detail="Firma inválida")

    body = json.loads(payload)

    # 2. Filtrar solo compras aprobadas
    event = body.get("event", "")
    if event != "PURCHASE_APPROVED":
        return {"status": "ignored", "event": event}

    data = body.get("data", {})
    purchase = data.get("purchase", {})
    buyer = data.get("buyer", {})
    product = data.get("product", {})

    product_id: str = str(product.get("id", ""))
    hotmart_transaction_id: str = purchase.get("transaction", "")
    buyer_email: str = buyer.get("email", "")
    buyer_wallet: str = buyer.get("extra_fields", {}).get("stellar_address", "")

    skill_config = PRODUCT_MAP.get(product_id)
    if not skill_config:
        logger.info("Producto %s no mapeado — ignorando", product_id)
        return {"status": "ignored", "reason": "product_not_mapped"}

    if not buyer_wallet:
        logger.warning("Comprador %s no tiene stellar_address en extra_fields", buyer_email)
        raise HTTPException(status_code=422, detail="stellar_address requerida en extra_fields")

    # 3. Crear Claimable Balance en Stellar
    try:
        balance_id = _build_claimable_balance(
            buyer_stellar_address=buyer_wallet,
            xlm_amount=skill_config["xlm_amount"],
            window_days=skill_config["window_days"],
        )
    except Exception as exc:
        logger.error("Error creando escrow Stellar: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Stellar error: {exc}") from exc

    # 4. Registrar en Supabase
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(
            """
            INSERT INTO educational_escrows (
                hotmart_transaction_id,
                buyer_email,
                buyer_stellar_address,
                skill_tag,
                xlm_amount,
                stellar_balance_id,
                escrow_status,
                window_days
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
            ON CONFLICT (hotmart_transaction_id) DO NOTHING
            """,
            hotmart_transaction_id,
            buyer_email,
            buyer_wallet,
            skill_config["skill_tag"],
            Decimal(skill_config["xlm_amount"]),
            balance_id,
            skill_config["window_days"],
        )
    finally:
        await conn.close()

    logger.info(
        "Escrow creado: tx=%s skill=%s balance=%s",
        hotmart_transaction_id,
        skill_config["skill_tag"],
        balance_id,
    )

    return {
        "status": "escrow_created",
        "skill_tag": skill_config["skill_tag"],
        "stellar_balance_id": balance_id,
        "xlm_amount": skill_config["xlm_amount"],
        "claimable_after_days": skill_config["window_days"],
    }
