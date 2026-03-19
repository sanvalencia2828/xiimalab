"""
Notifications Router — FastAPI
============================
Endpoints para notificaciones de hackathons.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
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
