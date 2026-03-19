"""
ML Recommendations router — Análisis de IA para recomendaciones personalizadas
"""
from __future__ import annotations

import os
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Hackathon, UserNeuroProfile, HackathonSkill
from neuro_tracker import NeuroSkillEngine, SKILL_COGNITIVE_MAP

log = logging.getLogger("xiima.routes.ml_recommendations")
router = APIRouter()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


class Recommendation(BaseModel):
    hackathon_id: str
    title: str
    score: float
    reason: str
    skill_gaps: list[str]
    potential_reward: float
    risk_level: str
    team_fit: str
    learning_potential: str


class MLRecommendationsResponse(BaseModel):
    recommendations: list[Recommendation]
    user_profile_summary: dict
    market_opportunities: dict
    generated_at: str
    model_used: str


class SkillGap(BaseModel):
    skill: str
    importance: float
    learning_resources: list[str]


@router.get("/recommendations/{wallet_address}", response_model=MLRecommendationsResponse)
async def get_ml_recommendations(
    wallet_address: str,
    limit: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """
    Genera recomendaciones ML-powered para hackathons usando:
    - Perfil neuropsicológico del usuario
    - Skills actuales vs demandadas
    - Análisis de gaps de habilidades
    - Predicción de éxito basada en patrones
    """
    today = datetime.now().date()
    engine = NeuroSkillEngine()
    
    # Obtener perfil neuro del usuario
    result = await db.execute(
        select(UserNeuroProfile).where(UserNeuroProfile.wallet_address == wallet_address)
    )
    user_profile = result.scalar_one_or_none()
    
    # Obtener skills del usuario
    result = await db.execute(
        select(HackathonSkill).where(HackathonSkill.wallet_address == wallet_address)
    )
    user_skills = result.scalars().all()
    
    # Obtener hackathons activos
    result = await db.execute(
        select(Hackathon).where(Hackathon.deadline >= today.isoformat())
    )
    hackathons = result.scalars().all()
    
    if not hackathons:
        return _empty_response()
    
    # Análisis del mercado
    hackathon_dicts = [
        {"id": h.id, "title": h.title, "tags": h.tags or [], "prize_pool": h.prize_pool}
        for h in hackathons
    ]
    market_data = engine.analyze_market_data(hackathon_dicts)
    
    # Skills del usuario
    user_skill_names = [s.name.lower() for s in user_skills]
    
    # Perfil cognitivo
    cognitive_strengths = user_profile.cognitive_strengths if user_profile else []
    neuroplasticity = user_profile.neuroplasticity_score if user_profile else 0.5
    
    # Generar recomendaciones
    recommendations = []
    
    for h in hackathons:
        try:
            deadline_date = datetime.strptime(h.deadline, "%Y-%m-%d").date()
            days_left = (deadline_date - today).days
        except (ValueError, TypeError):
            days_left = 90
        
        h_tags = [t.lower() for t in (h.tags or [])]
        
        # Calcular score base
        overlap = set(h_tags) & set(user_skill_names)
        base_match = len(overlap) / max(len(h_tags), 1) * 100 if h_tags else 50
        
        # Bônus por categoría cognitiva
        category_bonus = 0
        for tag in h_tags:
            if tag in SKILL_COGNITIVE_MAP:
                cat = SKILL_COGNITIVE_MAP[tag].get("category", "")
                if cat and cat.value in cognitive_strengths:
                    category_bonus += 15
        
        # Bônus por neuroplasticidad (usuarios con alta neuroplasticidad aprenden más rápido)
        neuro_bonus = (neuroplasticity - 0.5) * 40
        
        # Score final
        final_score = min(100, base_match * 0.5 + category_bonus * 0.3 + neuro_bonus * 0.2)
        
        # Identificar skill gaps
        skill_gaps = [tag for tag in h_tags if tag not in user_skill_names][:3]
        
        # Nivel de riesgo
        if days_left <= 3:
            risk = "critical"
        elif days_left <= 7:
            risk = "high"
        elif final_score >= 70:
            risk = "low"
        else:
            risk = "medium"
        
        # Potencial de recompensa
        potential_reward = h.prize_pool * (final_score / 100) if h.prize_pool else 0
        
        # Fit de equipo
        if len(h_tags) <= 2:
            team_fit = "Solo o equipo pequeño"
        elif len(user_skills) >= 5:
            team_fit = "Perfecto para tu equipo"
        else:
            team_fit = "Requiere equipo diverso"
        
        # Potencial de aprendizaje
        if skill_gaps:
            learning_potential = f"Aprende: {', '.join(skill_gaps[:2])}"
        elif final_score >= 80:
            learning_potential = "Refuerza skills existentes"
        else:
            learning_potential = "Desafiante pero achievable"
        
        # Generar razón
        if final_score >= 80:
            reason = f"¡Excelente match! {len(overlap)} skills en común + perfil cognitivo alineado"
        elif final_score >= 60:
            reason = f"Buen match ({len(overlap)} skills) - considera aprender {skill_gaps[0] if skill_gaps else 'nuevas techs'}"
        elif skill_gaps:
            reason = f"Gap de {len(skill_gaps)} skills - oportunidad de aprendizaje"
        else:
            reason = "Hackathon disponible"
        
        recommendations.append(Recommendation(
            hackathon_id=h.id,
            title=h.title,
            score=round(final_score, 1),
            reason=reason,
            skill_gaps=skill_gaps,
            potential_reward=round(potential_reward, 2),
            risk_level=risk,
            team_fit=team_fit,
            learning_potential=learning_potential
        ))
    
    # Ordenar por score
    recommendations.sort(key=lambda x: x.score, reverse=True)
    
    # Perfil resumido del usuario
    user_summary = {
        "wallet": wallet_address,
        "skills_count": len(user_skills),
        "top_skills": user_skill_names[:5],
        "neuroplasticity": round(neuroplasticity * 100, 1),
        "cognitive_strengths": cognitive_strengths,
        "profile_complete": user_profile is not None
    }
    
    # Oportunidades del mercado
    market_summary = {
        "active_hackathons": len(hackathons),
        "avg_prize_pool": sum(h.prize_pool for h in hackathons) // max(len(hackathons), 1),
        "top_tags": _get_top_tags(hackathons),
        "urgent_count": sum(1 for h in hackathons if datetime.strptime(h.deadline, "%Y-%m-%d").date() <= today + __import__('datetime').timedelta(days=7)),
        "high_value_count": sum(1 for h in hackathons if h.prize_pool >= 10000)
    }
    
    return MLRecommendationsResponse(
        recommendations=recommendations[:limit],
        user_profile_summary=user_summary,
        market_opportunities=market_summary,
        generated_at=datetime.now().isoformat(),
        model_used="rule-based-v2"
    )


@router.get("/skill-gaps/{wallet_address}")
async def get_skill_gaps_analysis(
    wallet_address: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Análisis detallado de gaps de habilidades del usuario vs el mercado.
    """
    today = datetime.now().date()
    
    # Obtener skills del usuario
    result = await db.execute(
        select(HackathonSkill).where(HackathonSkill.wallet_address == wallet_address)
    )
    user_skills = {s.name.lower(): s.level for s in result.scalars().all()}
    
    # Obtener todos los tags del mercado
    result = await db.execute(
        select(Hackathon).where(Hackathon.deadline >= today.isoformat())
    )
    hackathons = result.scalars().all()
    
    # Contar demanda de skills
    tag_demand: dict[str, int] = {}
    for h in hackathons:
        for tag in (h.tags or []):
            tag_lower = tag.lower()
            tag_demand[tag_lower] = tag_demand.get(tag_lower, 0) + 1
    
    # Análisis de gaps
    gaps = []
    for tag, demand in sorted(tag_demand.items(), key=lambda x: x[1], reverse=True):
        if tag not in user_skills:
            # Nueva skill que el mercado demanda
            gaps.append({
                "skill": tag,
                "demand_score": demand,
                "your_level": 0,
                "urgency": "high" if demand >= 3 else "medium",
                "cognitive_category": SKILL_COGNITIVE_MAP.get(tag, {}).get("category", "").value if tag in SKILL_COGNITIVE_MAP else "unknown",
                "recommended_action": "start_learning"
            })
    
    # Skills que el usuario tiene pero el mercado no demanda tanto
    oversupplied = []
    for skill, level in user_skills.items():
        demand = tag_demand.get(skill, 0)
        if demand < 2:
            oversupplied.append({
                "skill": skill,
                "your_level": level,
                "market_demand": demand,
                "recommendation": "maintain" if level >= 70 else "improve"
            })
    
    return {
        "skill_gaps": gaps[:10],
        "oversupplied_skills": oversupplied,
        "market_top_demands": list(tag_demand.keys())[:10],
        "generated_at": datetime.now().isoformat()
    }


@router.post("/ai-analysis")
async def get_ai_analysis(
    wallet_address: str,
    hackathon_id: Optional[str] = None,
    question: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Análisis de IA usando Anthropic para recomendaciones avanzadas.
    Requiere ANTHROPIC_API_KEY.
    """
    if not ANTHROPIC_API_KEY:
        return {
            "error": "AI analysis not configured",
            "message": "Set ANTHROPIC_API_KEY to enable AI-powered recommendations"
        }
    
    try:
        import httpx
        
        # Obtener datos del usuario
        result = await db.execute(
            select(UserNeuroProfile).where(UserNeuroProfile.wallet_address == wallet_address)
        )
        user_profile = result.scalar_one_or_none()
        
        result = await db.execute(
            select(HackathonSkill).where(HackathonSkill.wallet_address == wallet_address)
        )
        user_skills = [s.name for s in result.scalars().all()]
        
        # Obtener hackathon si se especificó
        hackathon = None
        if hackathon_id:
            result = await db.execute(
                select(Hackathon).where(Hackathon.id == hackathon_id)
            )
            hackathon = result.scalar_one_or_none()
        
        # Construir prompt
        profile_text = f"""
        Usuario: {wallet_address}
        Neuroplasticidad: {user_profile.neuroplasticity_score if user_profile else 0.5}
        Fortalezas cognitivas: {', '.join(user_profile.cognitive_strengths or [])}
        Skills: {', '.join(user_skills) if user_skills else 'No especificadas'}
        """
        
        hackathon_text = ""
        if hackathon:
            hackathon_text = f"""
        Hackathon a analizar:
        - Título: {hackathon.title}
        - Tags: {', '.join(hackathon.tags or [])}
        - Prize: ${hackathon.prize_pool}
        - Deadline: {hackathon.deadline}
        """
        
        question_text = question or "¿Qué hackathons me recomienda y por qué?"
        
        prompt = f"""Eres un asesor de hackathons experto para un developer.
        
        Perfil del usuario:
        {profile_text}
        
        {hackathon_text}
        
        Pregunta: {question_text}
        
        Responde en JSON con este formato:
        {{
            "summary": "resumen breve",
            "recommendations": ["lista de recomendaciones"],
            "action_items": ["pasos a seguir"],
            "reasoning": "explicación del análisis"
        }}
        """
        
        # Llamar a Claude
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 1024,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get("content", [{}])
                if content and isinstance(content, list):
                    text = content[0].get("text", "{}")
                    return json.loads(text)
            
            return {"error": "AI analysis failed", "raw_response": response.text}
            
    except Exception as e:
        log.error(f"AI analysis error: {e}")
        return {"error": str(e)}


def _empty_response() -> MLRecommendationsResponse:
    return MLRecommendationsResponse(
        recommendations=[],
        user_profile_summary={},
        market_opportunities={"active_hackathons": 0},
        generated_at=datetime.now().isoformat(),
        model_used="rule-based-v2"
    )


def _get_top_tags(hackathons: list, n: int = 5) -> list[str]:
    from collections import Counter
    all_tags = []
    for h in hackathons:
        all_tags.extend(h.tags or [])
    return [tag for tag, _ in Counter(all_tags).most_common(n)]
