"""
routes/staking.py
─────────────────────────────────────────────────────────────────────────────
Proof of Skill — Endpoints de recompensas

POST /staking/hotmart-webhook    → Recibe compra de Hotmart, crea escrow
POST /staking/aura-milestone     → Registra imagen procesada en AURA
POST /staking/hackathon-apply    → Registra aplicación a hackatón
GET  /staking/status/{user_id}   → Estado de escrows y progreso
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db

# Importamos el motor de staking
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parents[3] / "engine"))
from staking_manager import (
    create_staking_escrow,
    record_aura_image,
    record_hackathon_application,
    get_user_escrow_status,
)

log = logging.getLogger("xiima.routes.staking")
router = APIRouter()

HOTMART_WEBHOOK_SECRET: str = os.environ.get("HOTMART_WEBHOOK_SECRET", "")


# ─────────────────────────────────────────────
# Schemas de entrada
# ─────────────────────────────────────────────
class HotmartWebhookPayload(BaseModel):
    """Payload simplificado del webhook de Hotmart."""
    order_id: str = Field(..., description="ID único de la orden")
    product_id: str = Field(..., description="ID del producto en Hotmart")
    buyer_email: str
    buyer_name: str
    stellar_pubkey: str = Field(..., description="Clave pública Stellar del estudiante")
    amount_xlm: float = Field(..., gt=0, description="Monto de reembolso en XLM")
    course_id: str | None = None


class AuraMilestonePayload(BaseModel):
    user_id: str
    images_processed: int = Field(default=1, ge=1)


class HackathonApplyPayload(BaseModel):
    user_id: str
    hackathon_id: str
    hackathon_title: str
    source: str = "dorahacks"


# ─────────────────────────────────────────────
# Verificación de firma Hotmart (HMAC-SHA256)
# ─────────────────────────────────────────────
def _verify_hotmart_signature(payload: bytes, signature: str) -> bool:
    """Verifica la firma HMAC del webhook de Hotmart."""
    if not HOTMART_WEBHOOK_SECRET:
        log.warning("HOTMART_WEBHOOK_SECRET no configurado — omitiendo verificación")
        return True
    expected = hmac.new(
        HOTMART_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────
@router.post("/hotmart-webhook", status_code=status.HTTP_201_CREATED)
async def hotmart_webhook(
    payload: HotmartWebhookPayload,
    x_hotmart_signature: str | None = Header(default=None),
):
    """
    Recibe una notificación de compra de Hotmart y crea el Claimable
    Balance en Stellar para el estudiante.
    """
    # Verificación de firma (opcional si está configurada)
    if x_hotmart_signature and not _verify_hotmart_signature(
        payload.model_dump_json().encode(), x_hotmart_signature
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firma de webhook inválida",
        )

    try:
        result = await create_staking_escrow(
            user_id=payload.buyer_email,
            user_stellar_pubkey=payload.stellar_pubkey,
            hotmart_order_id=payload.order_id,
            amount_xlm=Decimal(str(payload.amount_xlm)),
            course_id=payload.course_id,
        )
        log.info(
            f"Escrow creado — order={payload.order_id} "
            f"student={payload.buyer_email} balance={result['balance_id']}"
        )
        return {"success": True, **result}

    except Exception as exc:
        log.error(f"Error creando escrow: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creando Claimable Balance: {exc}",
        )


@router.post("/aura-milestone")
async def aura_milestone(payload: AuraMilestonePayload):
    """
    Notifica que el usuario procesó N imágenes en AURA.
    Si acumula >= 10 imágenes, libera automáticamente el staking.
    """
    try:
        result = await record_aura_image(
            user_id=payload.user_id,
            image_count=payload.images_processed,
        )
        return {"success": True, **result}
    except Exception as exc:
        log.error(f"Error en milestone AURA: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post("/hackathon-apply")
async def hackathon_apply(payload: HackathonApplyPayload):
    """
    Registra que el usuario aplicó a una hackatón (scraped de DoraHacks/Devpost).
    Esto libera el staking como Proof of Skill de portafolio.
    """
    try:
        result = await record_hackathon_application(
            user_id=payload.user_id,
            hackathon_id=payload.hackathon_id,
            hackathon_title=payload.hackathon_title,
            source=payload.source,
        )
        return {"success": True, **result}
    except Exception as exc:
        log.error(f"Error en hackathon apply: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.get("/status/{user_id}")
async def escrow_status(user_id: str):
    """
    Devuelve el estado de todos los escrows y el progreso de habilidades
    del usuario (imágenes AURA + hackatones aplicados).
    """
    try:
        return await get_user_escrow_status(user_id)
    except Exception as exc:
        log.error(f"Error consultando estado: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
