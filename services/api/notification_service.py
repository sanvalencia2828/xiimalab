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

            # Calcular afinidad cognitiva para personalizar el mensaje
            cognitive_affinity = 0
            if profile and hackathon.tags:
                from routes.insights import calculate_cognitive_affinity
                cognitive_affinity = calculate_cognitive_affinity(profile, hackathon.tags)

            # Personalizar mensaje basado en el perfil neuropsicológico
            if cognitive_affinity > 70:
                message_suffix = " 🔍 Perfecto para tu perfil cognitivo"
            elif cognitive_affinity > 50:
                message_suffix = " 🧠 Buen alineamiento cognitivo"
            else:
                message_suffix = ""

            notification = HackathonNotification(
                wallet_address=wallet_address,
                hackathon_id=hackathon.id,
                notification_type="high_match",
                message=f"🎯 Alto match ({hackathon.match_score}%): '{hackathon.title}' - ${hackathon.prize_pool:,}{message_suffix}"
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


async def get_neuro_profile_recommendations(
    wallet_address: str,
    db: AsyncSession,
    limit: int = 10
) -> list[dict]:
    """
    Obtiene recomendaciones personalizadas basadas en el perfil neuropsicológico del usuario.

    Args:
        wallet_address: Dirección del usuario
        db: Sesión de base de datos
        limit: Número máximo de recomendaciones

    Returns:
        Lista de recomendaciones personalizadas
    """
    # Obtener perfil del usuario
    result = await db.execute(
        select(UserNeuroProfile).where(
            UserNeuroProfile.wallet_address == wallet_address
        )
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return []

    # Obtener todos los hackathons activos
    today = datetime.now().date()
    result = await db.execute(
        select(Hackathon).where(
            Hackathon.deadline >= today.isoformat()
        ).order_by(Hackathon.deadline.asc())
    )
    hackathons = result.scalars().all()

    # Calcular puntuaciones personalizadas
    recommendations = []
    for hackathon in hackathons:
        # Calcular afinidad cognitiva
        cognitive_affinity = 0
        if profile and hackathon.tags:
            from routes.insights import calculate_cognitive_affinity
            cognitive_affinity = calculate_cognitive_affinity(profile, hackathon.tags)

        # Calcular match personalizado
        personalized_match = hackathon.match_score
        if profile and profile.skills_progress:
            user_skills = list(profile.skills_progress.keys())
            if user_skills and hackathon.tags:
                h_tags_lower = [t.lower() for t in hackathon.tags]
                user_skills_lower = [s.lower() for s in user_skills]
                overlap = set(h_tags_lower) & set(user_skills_lower)

                # Bônus por categoría cognitiva
                category_bonus = 0
                strengths = profile.cognitive_strengths or []
                for tag in (hackathon.tags or []):
                    tag_lower = tag.lower()
                    if tag_lower in SKILL_COGNITIVE_MAP:
                        if SKILL_COGNITIVE_MAP[tag_lower].get("category", "").value in strengths:
                            category_bonus += 10

                personalized_match = min(100, (len(overlap) * 20) + category_bonus + 30)

        # Calcular urgencia
        try:
            deadline_date = datetime.strptime(hackathon.deadline, "%Y-%m-%d").date()
            days_left = (deadline_date - today).days
        except (ValueError, TypeError):
            days_left = 90

        # Crear puntuación compuesta
        composite_score = (
            personalized_match * 0.4 +
            cognitive_affinity * 0.3 +
            (100 - days_left) * 0.2 +  # Invertir días para que menos días = mayor puntuación
            (hackathon.prize_pool / max(h.prize_pool for h in hackathons) * 100) * 0.1
        )

        recommendations.append({
            "hackathon_id": hackathon.id,
            "title": hackathon.title,
            "prize_pool": hackathon.prize_pool,
            "deadline": hackathon.deadline,
            "tags": hackathon.tags or [],
            "personalized_match": personalized_match,
            "cognitive_affinity": cognitive_affinity,
            "days_until_deadline": days_left,
            "composite_score": composite_score,
            "reasoning": f"Match personalizado: {personalized_match}%, Afinidad cognitiva: {cognitive_affinity}%, Días restantes: {days_left}"
        })

    # Ordenar por puntuación compuesta y limitar resultados
    recommendations.sort(key=lambda x: x["composite_score"], reverse=True)
    return recommendations[:limit]


async def record_recommendation_feedback(
    wallet_address: str,
    hackathon_id: str,
    feedback_type: str,
    db: AsyncSession
) -> bool:
    """
    Registra el feedback del usuario sobre una recomendación.

    Args:
        wallet_address: Dirección del usuario
        hackathon_id: ID del hackathon
        feedback_type: Tipo de feedback (accepted, rejected, ignored)
        db: Sesión de base de datos

    Returns:
        Boolean indicando si se registró correctamente
    """
    from models import RecommendationFeedback

    try:
        feedback = RecommendationFeedback(
            wallet_address=wallet_address,
            hackathon_id=hackathon_id,
            feedback_type=feedback_type
        )
        db.add(feedback)
        await db.commit()
        return True
    except Exception as e:
        log.error(f"Error registrando feedback: {e}")
        await db.rollback()
        return False


async def get_feedback_history(
    wallet_address: str,
    db: AsyncSession,
    limit: int = 50
) -> list[dict]:
    """
    Obtiene el historial de feedback del usuario.

    Args:
        wallet_address: Dirección del usuario
        db: Sesión de base de datos
        limit: Número máximo de registros

    Returns:
        Lista de registros de feedback
    """
    from models import RecommendationFeedback
    from sqlalchemy import desc

    try:
        result = await db.execute(
            select(RecommendationFeedback)
            .where(RecommendationFeedback.wallet_address == wallet_address)
            .order_by(desc(RecommendationFeedback.timestamp))
            .limit(limit)
        )
        feedback_records = result.scalars().all()

        return [
            {
                "id": record.id,
                "hackathon_id": record.hackathon_id,
                "feedback_type": record.feedback_type,
                "timestamp": record.timestamp.isoformat() if record.timestamp else None
            }
            for record in feedback_records
        ]
    except Exception as e:
        log.error(f"Error obteniendo historial de feedback: {e}")
        return []


async def adjust_recommendation_weights(
    wallet_address: str,
    db: AsyncSession
) -> dict:
    """
    Ajusta los pesos de recomendación basados en el historial de feedback.

    Args:
        wallet_address: Dirección del usuario
        db: Sesión de base de datos

    Returns:
        Diccionario con los pesos ajustados
    """
    # Obtener historial de feedback
    feedback_history = await get_feedback_history(wallet_address, db, limit=100)

    if not feedback_history:
        # Valores por defecto si no hay historial
        return {
            "match_weight": 0.4,
            "urgency_weight": 0.3,
            "value_weight": 0.3
        }

    # Contar tipos de feedback
    accepted_count = sum(1 for f in feedback_history if f["feedback_type"] == "accepted")
    rejected_count = sum(1 for f in feedback_history if f["feedback_type"] == "rejected")
    total_count = len(feedback_history)

    # Calcular ratios de aceptación/rechazo
    acceptance_rate = accepted_count / total_count if total_count > 0 else 0.5
    rejection_rate = rejected_count / total_count if total_count > 0 else 0.5

    # Ajustar pesos basados en el feedback
    # Si el usuario acepta muchas recomendaciones, dar más peso al match
    # Si rechaza muchas, dar más peso a la urgencia y valor
    match_weight = 0.4 + (acceptance_rate * 0.2) - (rejection_rate * 0.1)
    urgency_weight = 0.3 + (rejection_rate * 0.1) - (acceptance_rate * 0.05)
    value_weight = 0.3 + (rejection_rate * 0.1) - (acceptance_rate * 0.05)

    # Normalizar pesos para que sumen 1.0
    total_weight = match_weight + urgency_weight + value_weight
    if total_weight > 0:
        match_weight /= total_weight
        urgency_weight /= total_weight
        value_weight /= total_weight

    return {
        "match_weight": round(match_weight, 2),
        "urgency_weight": round(urgency_weight, 2),
        "value_weight": round(value_weight, 2)
    }
