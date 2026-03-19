"""
Notification Service — Xiimalab
==============================
Sistema de notificaciones push para hackathons urgentes y oportunidades.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Hackathon, HackathonNotification, UserNeuroProfile

log = logging.getLogger("xiima.notifications")

URGENCY_THRESHOLDS = {
    "critical": 3,   # días
    "urgent": 7,     # días
    "soon": 14,     # días
}

NOTIFICATION_TYPES = {
    "deadline_urgent": "Deadline próximo",
    "high_match": "Alto match con tu perfil",
    "high_prize": "Premio alto disponible",
    "new_opportunity": "Nueva oportunidad",
}


class NotificationService:
    """Servicio de notificaciones para hackathons."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_urgent_hackathons(
        self,
        wallet_address: str,
        days_threshold: int = 7
    ) -> list[HackathonNotification]:
        """
        Verifica hackathons que cierran pronto y no han sido notificados.
        
        Args:
            wallet_address: Dirección del usuario
            days_threshold: Días antes del deadline para notificar
            
        Returns:
            Lista de notificaciones pendientes
        """
        today = datetime.now().date()
        threshold_date = (today + timedelta(days=days_threshold)).isoformat()
        today_str = today.isoformat()

        # Obtener hackathons próximos a cerrar
        result = await self.db.execute(
            select(Hackathon).where(
                and_(
                    Hackathon.deadline >= today_str,
                    Hackathon.deadline <= threshold_date
                )
            ).order_by(Hackathon.deadline.asc())
        )
        hackathons = result.scalars().all()

        notifications = []
        for hackathon in hackathons:
            # Verificar si ya se notificó
            existing = await self.db.execute(
                select(HackathonNotification).where(
                    and_(
                        HackathonNotification.wallet_address == wallet_address,
                        HackathonNotification.hackathon_id == hackathon.id,
                        HackathonNotification.notification_type == "urgency",
                        HackathonNotification.is_sent == True
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue  # Ya notificado

            # Calcular días restantes
            try:
                deadline = datetime.strptime(hackathon.deadline, "%Y-%m-%d").date()
                days_left = (deadline - today).days
            except (ValueError, TypeError):
                days_left = 99

            # Crear notificación
            if days_left <= 3:
                urgency_level = "CRÍTICO"
                emoji = "🚨"
            elif days_left <= 7:
                urgency_level = "URGENTE"
                emoji = "🔥"
            else:
                urgency_level = "PRÓXIMO"
                emoji = "⏰"

            notification = HackathonNotification(
                wallet_address=wallet_address,
                hackathon_id=hackathon.id,
                notification_type="urgency",
                message=f"{emoji} {urgency_level}: '{hackathon.title}' cierra en {days_left} día(s). Premio: ${hackathon.prize_pool:,}"
            )
            self.db.add(notification)
            notifications.append(notification)

        await self.db.commit()
        return notifications

    async def check_high_match_opportunities(
        self,
        wallet_address: str,
        min_match_score: int = 80
    ) -> list[HackathonNotification]:
        """
        Notifica hackathons con alto match para el usuario.
        """
        # Obtener perfil del usuario
        result = await self.db.execute(
            select(UserNeuroProfile).where(
                UserNeuroProfile.wallet_address == wallet_address
            )
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            return []

        # Obtener hackathons con alto match score
        result = await self.db.execute(
            select(Hackathon).where(
                Hackathon.match_score >= min_match_score
            ).order_by(Hackathon.match_score.desc()).limit(10)
        )
        hackathons = result.scalars().all()

        notifications = []
        for hackathon in hackathons:
            # Verificar si ya se notificó
            existing = await self.db.execute(
                select(HackathonNotification).where(
                    and_(
                        HackathonNotification.wallet_address == wallet_address,
                        HackathonNotification.hackathon_id == hackathon.id,
                        HackathonNotification.notification_type == "high_match"
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue

            notification = HackathonNotification(
                wallet_address=wallet_address,
                hackathon_id=hackathon.id,
                notification_type="high_match",
                message=f"🎯 Alto match ({hackathon.match_score}%): '{hackathon.title}' - ${hackathon.prize_pool:,}"
            )
            self.db.add(notification)
            notifications.append(notification)

        await self.db.commit()
        return notifications

    async def get_pending_notifications(
        self,
        wallet_address: str,
        limit: int = 20
    ) -> list[HackathonNotification]:
        """Obtiene notificaciones pendientes para un usuario."""
        result = await self.db.execute(
            select(HackathonNotification)
            .where(
                and_(
                    HackathonNotification.wallet_address == wallet_address,
                    HackathonNotification.is_sent == False
                )
            )
            .order_by(HackathonNotification.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def mark_as_sent(self, notification_ids: list[int]) -> int:
        """Marca notificaciones como enviadas."""
        if not notification_ids:
            return 0

        from models import HackathonNotification
        from sqlalchemy import update
        
        stmt = (
            update(HackathonNotification)
            .where(HackathonNotification.id.in_(notification_ids))
            .values(is_sent=True, sent_at=datetime.now())
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount


async def get_user_notifications(
    wallet_address: str,
    db: AsyncSession
) -> dict:
    """
    Obtiene todas las notificaciones relevantes para un usuario.
    """
    service = NotificationService(db)
    
    # Verificar hackathons urgentes
    urgent = await service.check_urgent_hackathons(wallet_address)
    
    # Verificar oportunidades de alto match
    high_match = await service.check_high_match_opportunities(wallet_address)
    
    # Obtener pendientes
    pending = await service.get_pending_notifications(wallet_address)
    
    return {
        "wallet_address": wallet_address,
        "new_notifications": len(urgent) + len(high_match),
        "urgent_deadlines": len(urgent),
        "high_match_opportunities": len(high_match),
        "pending": [
            {
                "id": n.id,
                "type": n.notification_type,
                "hackathon_id": n.hackathon_id,
                "message": n.message,
                "created_at": n.created_at.isoformat() if n.created_at else None
            }
            for n in pending
        ],
        "generated_at": datetime.now().isoformat()
    }
