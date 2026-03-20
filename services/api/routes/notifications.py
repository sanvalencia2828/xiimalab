"""
Notifications Router — FastAPI
============================
Endpoints para notificaciones de hackathons.
"""
from __future__ import annotations

import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from notification_service import get_user_notifications, NotificationService
from notification_service import record_recommendation_feedback, get_feedback_history, adjust_recommendation_weights
from notification_service import get_neuro_profile_recommendations

log = logging.getLogger("xiima.routes.notifications")
router = APIRouter()


class NotificationResponse(BaseModel):
    wallet_address: str
    new_notifications: int
    urgent_deadlines: int
    high_match_opportunities: int
    pending: list[dict]
    generated_at: str


class FeedbackRequest(BaseModel):
    hackathon_id: str
    feedback_type: str  # accepted, rejected, ignored


class FeedbackHistoryResponse(BaseModel):
    wallet_address: str
    feedback_history: list[dict]
    adjusted_weights: dict


class RecommendationResponse(BaseModel):
    wallet_address: str
    recommendations: list[dict]
    generated_at: str


class NotificationStreamResponse(BaseModel):
    notification_id: int
    notification_type: str
    message: str
    hackathon_id: Optional[str]
    created_at: str


@router.get("/{wallet_address}", response_model=NotificationResponse)
async def get_notifications(
    wallet_address: str,
    check_new: bool = Query(default=True, description="Verificar y crear nuevas notificaciones"),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene notificaciones para un usuario.

    Si check_new=True, verifica hackathons urgentes y oportunidades de alto match.
    """
    if check_new:
        service = NotificationService(db)
        await service.check_urgent_hackathons(wallet_address, days_threshold=7)
        await service.check_high_match_opportunities(wallet_address, min_match_score=80)

    result = await get_user_notifications(wallet_address, db)
    return NotificationResponse(**result)


@router.post("/{wallet_address}/mark-read")
async def mark_notifications_read(
    wallet_address: str,
    notification_ids: list[int],
    db: AsyncSession = Depends(get_db),
):
    """Marca notificaciones como leídas."""
    service = NotificationService(db)
    count = await service.mark_as_sent(notification_ids)
    return {"marked_count": count}


@router.get("/count/{wallet_address}")
async def get_notification_count(
    wallet_address: str,
    db: AsyncSession = Depends(get_db),
):
    """Obtiene el conteo de notificaciones no leídas."""
    result = await get_user_notifications(wallet_address, db)
    return {
        "wallet_address": wallet_address,
        "unread_count": len(result["pending"]),
        "urgent_count": result["urgent_deadlines"],
        "high_match_count": result["high_match_opportunities"]
    }


@router.get("/{wallet_address}/recommendations", response_model=RecommendationResponse)
async def get_recommendations(
    wallet_address: str,
    limit: int = Query(default=10, description="Número máximo de recomendaciones"),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene recomendaciones personalizadas basadas en el perfil neuropsicológico."""
    recommendations = await get_neuro_profile_recommendations(wallet_address, db, limit)
    return RecommendationResponse(
        wallet_address=wallet_address,
        recommendations=recommendations,
        generated_at=datetime.now().isoformat()
    )


@router.post("/{wallet_address}/feedback")
async def submit_feedback(
    wallet_address: str,
    feedback: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """Registra el feedback del usuario sobre una recomendación."""
    success = await record_recommendation_feedback(
        wallet_address,
        feedback.hackathon_id,
        feedback.feedback_type,
        db
    )
    return {"success": success, "message": "Feedback registrado" if success else "Error registrando feedback"}


@router.get("/{wallet_address}/feedback-history", response_model=FeedbackHistoryResponse)
async def get_user_feedback_history(
    wallet_address: str,
    limit: int = Query(default=50, description="Número máximo de registros"),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene el historial de feedback del usuario."""
    feedback_history = await get_feedback_history(wallet_address, db, limit)
    adjusted_weights = await adjust_recommendation_weights(wallet_address, db)
    return FeedbackHistoryResponse(
        wallet_address=wallet_address,
        feedback_history=feedback_history,
        adjusted_weights=adjusted_weights
    )


# Nuevo endpoint para streaming de notificaciones en tiempo real
@router.get("/{wallet_address}/stream")
async def stream_user_notifications(
    wallet_address: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    SSE endpoint para notificaciones personalizadas del usuario en tiempo real.

    Ejemplo de uso en JavaScript:
        const es = new EventSource('/notifications/{wallet_address}/stream');
        es.addEventListener('notification', (e) => {
            const data = JSON.parse(e.data);
            console.log('Nueva notificación:', data.message);
        });
    """
    from fastapi.responses import StreamingResponse
    import json
    import asyncio

    async def notification_stream():
        """Generador SSE: emite notificaciones personalizadas al usuario."""
        # Aquí se podría implementar una suscripción a un canal Redis específico del usuario
        # Por ahora, simulamos un stream básico
        try:
            yield f"event: connected\ndata: {{\"status\": \"connected\", \"wallet\": \"{wallet_address}\"}}\n\n"

            # Este sería el punto donde conectaríamos a un canal Redis específico del usuario
            # para recibir notificaciones personalizadas en tiempo real

            # Por ahora, solo mantenemos la conexión viva
            while True:
                if await request.is_disconnected():
                    break
                # Heartbeat cada 30 segundos
                await asyncio.sleep(30)
                yield f"event: heartbeat\ndata: {{\"timestamp\": \"{datetime.now().isoformat()}\"}}\n\n"

        except asyncio.CancelledError:
            log.info(f"Cliente SSE desconectado para wallet: {wallet_address}")
        finally:
            log.info(f"Stream de notificaciones cerrado para wallet: {wallet_address}")

    return StreamingResponse(
        notification_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",     # Nginx: deshabilitar buffering
            "Connection": "keep-alive",
        },
    )