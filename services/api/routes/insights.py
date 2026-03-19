"""
Insights router — Análisis y priorización de hackathons con perfil neuropsicológico
"""
from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Hackathon, UserNeuroProfile
from neuro_tracker import SKILL_COGNITIVE_MAP, NeuroSkillEngine

log = logging.getLogger("xiima.routes.insights")
router = APIRouter()


class PriorityHackathon(BaseModel):
    id: str
    title: str
    prize_pool: int
    tags: list[str]
    deadline: str
    match_score: int
    days_until_deadline: int
    urgency_score: float
    value_score: float
    total_priority: float
    reasoning: str


class TagInsight(BaseModel):
    tag: str
    count: int
    percentage: float
    avg_match_score: float
    trend: str


class MarketInsights(BaseModel):
    total_hackathons: int
    avg_prize_pool: int
    avg_match_score: float
    top_tags: list[TagInsight]
    urgent_hackathons: int
    high_value_hackathons: int
    recommended_actions: list[str]
    prioritized_hackathons: list[PriorityHackathon]


class PrioritiesResponse(BaseModel):
    insights: MarketInsights
    generated_at: str


@router.get("/priorities", response_model=PrioritiesResponse)
async def get_priorities(
    days_window: int = Query(default=30, description="Días hacia adelante para calcular urgencia"),
    min_prize: int = Query(default=0, description="Prize mínimo en USD"),
    db: AsyncSession = Depends(get_db),
):
    """
    Análisis completo de hackathons para priorización.
    
    Scoring:
    - urgency_score: 0-100 basado en días hasta deadline
    - value_score: 0-100 basado en prize pool
    - match_score: ya calculado (skills del usuario vs requerimientos)
    - total_priority: promedio ponderado de los anteriores
    """
    today = datetime.now().date()
    cutoff = (today + timedelta(days=days_window)).isoformat()
    
    result = await db.execute(
        select(Hackathon).where(
            Hackathon.deadline >= today.isoformat()
        ).order_by(Hackathon.deadline.asc())
    )
    hackathons = result.scalars().all()
    
    if not hackathons:
        return PrioritiesResponse(
            insights=MarketInsights(
                total_hackathons=0,
                avg_prize_pool=0,
                avg_match_score=0,
                top_tags=[],
                urgent_hackathons=0,
                high_value_hackathons=0,
                recommended_actions=["No hay hackathons activos. Espera el próximo scrape."],
                prioritized_hackathons=[]
            ),
            generated_at=datetime.now().isoformat()
        )
    
    # Análisis de tags
    all_tags: list[str] = []
    for h in hackathons:
        all_tags.extend(h.tags if h.tags else [])
    tag_counts = Counter(all_tags)
    total_tag_mentions = sum(tag_counts.values())
    
    # Calcular insights por tag
    tag_match_scores: dict[str, list[int]] = {}
    for h in hackathons:
        if h.tags:
            for tag in h.tags:
                if tag not in tag_match_scores:
                    tag_match_scores[tag] = []
                tag_match_scores[tag].append(h.match_score)
    
    top_tags = []
    for tag, count in tag_counts.most_common(10):
        avg_score = sum(tag_match_scores.get(tag, [0])) / len(tag_match_scores.get(tag, [1]))
        trend = "rising" if count > 2 else "stable"
        top_tags.append(TagInsight(
            tag=tag,
            count=count,
            percentage=round(count / total_tag_mentions * 100, 1) if total_tag_mentions else 0,
            avg_match_score=round(avg_score, 1),
            trend=trend
        ))
    
    # Calcular métricas generales
    total_prizes = sum(h.prize_pool for h in hackathons)
    total_match = sum(h.match_score for h in hackathons)
    avg_prize = total_prizes // len(hackathons)
    avg_match = total_match // len(hackathons)
    
    # Clasificar hackathons
    urgent = 0
    high_value = 0
    prioritized = []
    
    max_prize = max(h.prize_pool for h in hackathons) or 1
    
    for h in hackathons:
        try:
            deadline_date = datetime.strptime(h.deadline, "%Y-%m-%d").date()
            days_left = (deadline_date - today).days
        except (ValueError, TypeError):
            days_left = 90
        
        # urgency: más puntos cuanto más cerca
        if days_left <= 3:
            urgency = 100
        elif days_left <= 7:
            urgency = 80
        elif days_left <= 14:
            urgency = 60
        elif days_left <= 30:
            urgency = 40
        else:
            urgency = 20
        
        # value: basado en prize pool relativo
        value = min(100, (h.prize_pool / max_prize * 100)) if max_prize > 0 else 0
        
        # total priority: combinación ponderada
        # match_score tiene peso 0.4 (es personalizado al usuario)
        # urgency tiene peso 0.3 (tiempo)
        # value tiene peso 0.3 (premio)
        total_priority = (
            h.match_score * 0.4 +
            urgency * 0.3 +
            value * 0.3
        )
        
        if days_left <= 7:
            urgent += 1
        if h.prize_pool >= avg_prize * 2:
            high_value += 1
        
        # Generar reasoning
        reasons = []
        if h.match_score >= 70:
            reasons.append(f"Alto match ({h.match_score}%)")
        if days_left <= 7:
            reasons.append("¡Urgente!")
        elif days_left <= 14:
            reasons.append("Próximo a cerrar")
        if h.prize_pool >= 10000:
            reasons.append(f"Premio alto (${h.prize_pool:,})")
        if len(h.tags) >= 3:
            reasons.append(f"{len(h.tags)} tecnologías")
        
        prioritized.append(PriorityHackathon(
            id=h.id,
            title=h.title,
            prize_pool=h.prize_pool,
            tags=h.tags or [],
            deadline=h.deadline,
            match_score=h.match_score,
            days_until_deadline=days_left,
            urgency_score=urgency,
            value_score=value,
            total_priority=round(total_priority, 1),
            reasoning=" · ".join(reasons) if reasons else "Considera aplicar"
        ))
    
    # Ordenar por prioridad total
    prioritized.sort(key=lambda x: x.total_priority, reverse=True)
    
    # Generar acciones recomendadas
    actions = []
    if urgent > 0:
        actions.append(f"{urgent} hackathon(s) cierran esta semana - ¡aplica YA!")
    if high_value > 0:
        actions.append(f"{high_value} hackathon(s) con premios superiores al promedio")
    if top_tags:
        top = top_tags[0]
        actions.append(f"'{top.tag}' es la tecnología más demandada ({top.count} hackathons)")
    if avg_match >= 60:
        actions.append("Tu perfil tiene alto match - es buen momento para aplicar")
    elif avg_match >= 40:
        actions.append("Desarrolla habilidades en tags de alta demanda para mejorar match")
    else:
        actions.append("Actualiza tu perfil con más skills para aumentar match scores")
    
    insights = MarketInsights(
        total_hackathons=len(hackathons),
        avg_prize_pool=avg_prize,
        avg_match_score=avg_match,
        top_tags=top_tags[:8],
        urgent_hackathons=urgent,
        high_value_hackathons=high_value,
        recommended_actions=actions,
        prioritized_hackathons=prioritized[:10]
    )
    
    return PrioritiesResponse(
        insights=insights,
        generated_at=datetime.now().isoformat()
    )


@router.get("/tag-analysis")
async def analyze_tags(
    db: AsyncSession = Depends(get_db),
):
    """
    Análisis detallado de tags del mercado.
    Útil para decidir qué habilidades desarrollar.
    """
    result = await db.execute(select(Hackathon))
    hackathons = result.scalars().all()
    
    all_tags: list[str] = []
    tag_hackathons: dict[str, list] = {}
    
    for h in hackathons:
        if h.tags:
            for tag in h.tags:
                all_tags.append(tag)
                if tag not in tag_hackathons:
                    tag_hackathons[tag] = {"count": 0, "total_prize": 0, "total_match": 0}
                tag_hackathons[tag]["count"] += 1
                tag_hackathons[tag]["total_prize"] += h.prize_pool
                tag_hackathons[tag]["total_match"] += h.match_score
    
    tag_analysis = []
    for tag, data in tag_hackathons.items():
        count = data["count"]
        avg_prize = data["total_prize"] // count if count else 0
        avg_match = data["total_match"] // count if count else 0
        tag_analysis.append({
            "tag": tag,
            "count": count,
            "avg_prize": avg_prize,
            "avg_match": avg_match,
            "demand_score": round(count * 0.6 + avg_match * 0.4, 1)
        })
    
    tag_analysis.sort(key=lambda x: x["demand_score"], reverse=True)
    
    return {
        "total_tags": len(tag_hackathons),
        "total_mentions": len(all_tags),
        "tag_analysis": tag_analysis[:15],
        "generated_at": datetime.now().isoformat()
    }


@router.get("/personalized/{wallet_address}", response_model=PrioritiesResponse)
async def get_personalized_priorities(
    wallet_address: str,
    days_window: int = Query(default=30, description="Días hacia adelante para calcular urgencia"),
    db: AsyncSession = Depends(get_db),
):
    """
    Análisis personalizado de hackathons basado en el perfil neuropsicológico del usuario.
    
    Usa:
    - Perfil cognitivo del usuario (neuroplasticidad, fortalezas)
    - Skills en las que tiene progreso
    - Objetivos de aprendizaje
    """
    today = datetime.now().date()
    engine = NeuroSkillEngine()
    
    # Obtener perfil neuro del usuario
    result = await db.execute(
        select(UserNeuroProfile).where(UserNeuroProfile.wallet_address == wallet_address)
    )
    user_profile = result.scalar_one_or_none()
    
    # Obtener hackathons
    result = await db.execute(
        select(Hackathon).where(Hackathon.deadline >= today.isoformat())
    )
    hackathons = result.scalars().all()
    
    if not hackathons:
        return PrioritiesResponse(
            insights=MarketInsights(
                total_hackathons=0,
                avg_prize_pool=0,
                avg_match_score=0,
                top_tags=[],
                urgent_hackathons=0,
                high_value_hackathons=0,
                recommended_actions=["No hay hackathons activos."],
                prioritized_hackathons=[]
            ),
            generated_at=datetime.now().isoformat()
        )
    
    # Calcular mercado
    hackathon_dicts = [{"id": h.id, "tags": h.tags or [], "prize_pool": h.prize_pool} for h in hackathons]
    market_data = engine.analyze_market_data(hackathon_dicts)
    
    # Determinar skills del usuario para match personalizado
    user_skills = []
    if user_profile and user_profile.skills_progress:
        user_skills = list(user_profile.skills_progress.keys())
    
    # Análisis de tags
    all_tags: list[str] = []
    for h in hackathons:
        all_tags.extend(h.tags if h.tags else [])
    tag_counts = Counter(all_tags)
    total_tag_mentions = sum(tag_counts.values())
    
    top_tags = []
    for tag, count in tag_counts.most_common(10):
        trend = "rising" if count > 2 else "stable"
        top_tags.append(TagInsight(
            tag=tag,
            count=count,
            percentage=round(count / total_tag_mentions * 100, 1) if total_tag_mentions else 0,
            avg_match_score=50,
            trend=trend
        ))
    
    # Clasificar hackathons con match personalizado
    urgent = 0
    high_value = 0
    prioritized = []
    max_prize = max(h.prize_pool for h in hackathons) or 1
    
    for h in hackathons:
        try:
            deadline_date = datetime.strptime(h.deadline, "%Y-%m-%d").date()
            days_left = (deadline_date - today).days
        except (ValueError, TypeError):
            days_left = 90
        
        # Match personalizado baseado en las skills del usuario
        if user_skills:
            # Calcular overlap entre skills del usuario y tags del hackathon
            h_tags_lower = [t.lower() for t in (h.tags or [])]
            user_skills_lower = [s.lower() for s in user_skills]
            overlap = set(h_tags_lower) & set(user_skills_lower)
            
            # Bônus por categoría cognitiva
            category_bonus = 0
            if user_profile:
                strengths = user_profile.cognitive_strengths or []
                for tag in (h.tags or []):
                    tag_lower = tag.lower()
                    if tag_lower in SKILL_COGNITIVE_MAP:
                        if SKILL_COGNITIVE_MAP[tag_lower].get("category", "").value in strengths:
                            category_bonus += 10
            
            personalized_match = min(100, (len(overlap) * 20) + category_bonus + 30)
        else:
            personalized_match = h.match_score
        
        # Urgency
        if days_left <= 3:
            urgency = 100
        elif days_left <= 7:
            urgency = 80
        elif days_left <= 14:
            urgency = 60
        elif days_left <= 30:
            urgency = 40
        else:
            urgency = 20
        
        # Value
        value = min(100, (h.prize_pool / max_prize * 100)) if max_prize > 0 else 0
        
        # Total priority con match personalizado
        total_priority = (
            personalized_match * 0.4 +
            urgency * 0.3 +
            value * 0.3
        )
        
        if days_left <= 7:
            urgent += 1
        if h.prize_pool >= 10000:
            high_value += 1
        
        # Generar reasoning personalizado
        reasons = []
        if personalized_match >= 70:
            reasons.append(f"¡Alto match! ({personalized_match}%)")
        elif personalized_match >= 50:
            reasons.append(f"Buen match ({personalized_match}%)")
        
        if days_left <= 3:
            reasons.append("¡CIERRA HOY!")
        elif days_left <= 7:
            reasons.append("Urgente - pocos días")
        
        if h.prize_pool >= 10000:
            reasons.append(f"Premio: ${h.prize_pool:,}")
        
        # Skills del usuario que aplican
        if user_skills:
            applying_skills = [t for t in (h.tags or []) if t.lower() in user_skills_lower]
            if applying_skills:
                reasons.append(f"Usa: {', '.join(applying_skills[:2])}")
        
        prioritized.append(PriorityHackathon(
            id=h.id,
            title=h.title,
            prize_pool=h.prize_pool,
            tags=h.tags or [],
            deadline=h.deadline,
            match_score=personalized_match,
            days_until_deadline=days_left,
            urgency_score=urgency,
            value_score=value,
            total_priority=round(total_priority, 1),
            reasoning=" · ".join(reasons) if reasons else "Considera aplicar"
        ))
    
    # Ordenar por prioridade
    prioritized.sort(key=lambda x: x.total_priority, reverse=True)
    
    # Acciones personalizadas
    actions = []
    if urgent > 0:
        actions.append(f"🔥 {urgent} hackathon(s) cierran esta semana")
    
    if personalized_match_avg := sum(p.match_score for p in prioritized[:10]) / min(len(prioritized), 10):
        if personalized_match_avg >= 70:
            actions.append("Tu perfil está MUY alineado con las oportunidades actuales")
        elif personalized_match_avg >= 50:
            actions.append("Tienes match moderado - considera desarrollar skills específicas")
        else:
            actions.append("Expande tu perfil para mejorar match scores")
    
    if high_value > 0:
        actions.append(f"💰 {high_value} hackathons con premios >$10k")
    
    avg_prize = sum(h.prize_pool for h in hackathons) // len(hackathons)
    avg_match = sum(p.match_score for p in prioritized) // len(prioritized) if prioritized else 0
    
    return PrioritiesResponse(
        insights=MarketInsights(
            total_hackathons=len(hackathons),
            avg_prize_pool=avg_prize,
            avg_match_score=avg_match,
            top_tags=top_tags[:8],
            urgent_hackathons=urgent,
            high_value_hackathons=high_value,
            recommended_actions=actions,
            prioritized_hackathons=prioritized[:10]
        ),
        generated_at=datetime.now().isoformat()
    )
