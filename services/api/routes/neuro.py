"""
NeuroTracker Router — FastAPI
============================
Endpoints para el sistema de tracking neuropsicológico:
- Perfil cognitivo del usuario
- Paths de aprendizaje personalizados
- Recomendaciones basadas en demanda de mercado
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Hackathon, UserAchievement
from neuro_tracker import (
    NeuroSkillEngine,
    NeuroLearningPath,
    UserNeuroProfile,
    SkillMetrics,
    CognitiveCategory,
    SKILL_COGNITIVE_MAP,
    get_neuro_engine,
)

log = logging.getLogger("xiima.routes.neuro")
router = APIRouter()


# ─────────────────────────────────────────────
# Request/Response Models
# ─────────────────────────────────────────────
class SkillProgress(BaseModel):
    skill_name: str
    practice_hours: float = 0.0
    mastery_level: float = 0.0
    streak_days: int = 0


class UserSkillsUpdate(BaseModel):
    wallet_address: str
    skills: list[SkillProgress]
    dominant_category: Optional[str] = None


class SkillRecommendation(BaseModel):
    skill: str
    priority_score: float
    market_demand: float
    weeks_to_mastery: int
    cognitive_load: float
    plasticity_index: float
    daily_minutes: int
    category: str
    reasoning: str


class LearningPathResponse(BaseModel):
    user_id: str
    target_skills: list[str]
    optimized_sequence: list[SkillRecommendation]
    cognitive_gaps: list[str]
    daily_focus: Optional[str]
    daily_minutes: int
    estimated_total_weeks: int
    neuroplasticity_score: float
    generated_at: str


class SkillMarketAnalysis(BaseModel):
    skill: str
    category: str
    market_demand: float
    avg_prize: int
    opportunity_count: int
    cognitive_load: float
    plasticity_index: float
    transfer_potential: float


class MarketAnalysisResponse(BaseModel):
    total_skills: int
    total_opportunities: int
    top_skills_by_demand: list[SkillMarketAnalysis]
    top_skills_by_prize: list[SkillMarketAnalysis]
    skills_by_category: dict[str, list[str]]
    generated_at: str


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────
@router.get("/market-analysis", response_model=MarketAnalysisResponse)
async def get_market_analysis(
    db: AsyncSession = Depends(get_db),
):
    """
    Analiza el mercado de skills basándose en hackathons activos.
    Retorna las skills más demandadas con perfil cognitivo.
    """
    engine = get_neuro_engine()
    
    # Obtener todos los hackathons
    result = await db.execute(select(Hackathon))
    hackathons = result.scalars().all()
    
    hackathon_dicts = [
        {
            "id": h.id,
            "title": h.title,
            "tags": h.tags or [],
            "prize_pool": h.prize_pool,
        }
        for h in hackathons
    ]
    
    # Analizar mercado
    market_data = engine.analyze_market_data(hackathon_dicts)
    
    # Crear análisis por skill
    skill_analyses = []
    for skill_name, data in market_data.items():
        skill_lower = skill_name.lower()
        cognitive_profile = SKILL_COGNITIVE_MAP.get(skill_lower, {})
        
        skill_analyses.append(SkillMarketAnalysis(
            skill=skill_name,
            category=cognitive_profile.get("category", CognitiveCategory.EXECUTIVE).value,
            market_demand=data.get("market_demand", 0),
            avg_prize=data.get("avg_prize", 0),
            opportunity_count=data.get("opportunity_count", 0),
            cognitive_load=cognitive_profile.get("cognitive_load", 0.5),
            plasticity_index=cognitive_profile.get("plasticity_index", 0.5),
            transfer_potential=cognitive_profile.get("transfer_potential", 0.5),
        ))
    
    # Ordenar por diferentes criterios
    by_demand = sorted(skill_analyses, key=lambda x: x.market_demand, reverse=True)[:15]
    by_prize = sorted(skill_analyses, key=lambda x: x.avg_prize, reverse=True)[:15]
    
    # Agrupar por categoría
    by_category: dict[str, list[str]] = {}
    for s in skill_analyses:
        cat = s.category
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(s.skill)
    
    return MarketAnalysisResponse(
        total_skills=len(skill_analyses),
        total_opportunities=sum(s.opportunity_count for s in skill_analyses),
        top_skills_by_demand=by_demand,
        top_skills_by_prize=by_prize,
        skills_by_category=by_category,
        generated_at=datetime.now().isoformat(),
    )


@router.get("/learning-path/{wallet_address}", response_model=LearningPathResponse)
async def get_learning_path(
    wallet_address: str,
    target_skills: str = Query(..., description="Comma-separated list of target skills"),
    available_minutes: int = Query(default=90, description="Daily available minutes"),
    db: AsyncSession = Depends(get_db),
):
    """
    Genera un camino de aprendizaje personalizado.
    
    Usa:
    - Perfil neuropsicológico del usuario
    - Demanda de mercado de skills
    - Objetivos del usuario
    """
    engine = get_neuro_engine()
    
    # Parsear skills objetivo
    target_list = [s.strip().lower() for s in target_skills.split(",")]
    
    # Obtener datos de mercado
    result = await db.execute(select(Hackathon))
    hackathons = result.scalars().all()
    
    hackathon_dicts = [
        {
            "id": h.id,
            "title": h.title,
            "tags": h.tags or [],
            "prize_pool": h.prize_pool,
        }
        for h in hackathons
    ]
    market_data = engine.analyze_market_data(hackathon_dicts)
    
    # Crear perfil de usuario (simplificado)
    user_profile = UserNeuroProfile(
        wallet_address=wallet_address,
        dominant_category=CognitiveCategory.EXECUTIVE,
    )
    
    # Generar path
    path = engine.generate_learning_path(
        user_profile=user_profile,
        target_skills=target_list,
        market_data=market_data,
        available_time_daily=available_minutes,
    )
    
    # Calcular neuroplasticidad
    neuro_score = engine.calculate_neuroplasticity(user_profile, market_data)
    
    # Convertir a response
    recommendations = []
    for skill_data in path.optimized_sequence:
        skill_lower = skill_data["skill"].lower()
        cognitive_profile = SKILL_COGNITIVE_MAP.get(skill_lower, {})
        
        recommendations.append(SkillRecommendation(
            skill=skill_data["skill"],
            priority_score=skill_data["priority_score"],
            market_demand=skill_data["market_demand"],
            weeks_to_mastery=skill_data["weeks_to_mastery"],
            cognitive_load=skill_data["cognitive_load"],
            plasticity_index=skill_data["plasticity_index"],
            daily_minutes=skill_data["daily_minutes"],
            category=cognitive_profile.get("category", CognitiveCategory.EXECUTIVE).value,
            reasoning=_generate_skill_reasoning(skill_data, market_data.get(skill_lower, {})),
        ))
    
    # Estimar tiempo total
    total_weeks = max(
        sum(r.weeks_to_mastery for r in recommendations) // len(recommendations)
        if recommendations else 0,
        sum(r.weeks_to_mastery for r in recommendations)
    )
    
    return LearningPathResponse(
        user_id=wallet_address,
        target_skills=target_list,
        optimized_sequence=recommendations,
        cognitive_gaps=[c.value for c in path.cognitive_gaps],
        daily_focus=path.daily_focus,
        daily_minutes=path.daily_minutes,
        estimated_total_weeks=total_weeks,
        neuroplasticity_score=neuro_score,
        generated_at=datetime.now().isoformat(),
    )


@router.get("/cognitive-profile")
async def get_cognitive_profile():
    """
    Retorna el mapa de categorías cognitivas y su relación con skills.
    """
    categories = {}
    for category in CognitiveCategory:
        categories[category.value] = {
            "description": _get_category_description(category),
            "related_skills": [
                s for s, d in SKILL_COGNITIVE_MAP.items()
                if d.get("category") == category
            ],
            "learning_tips": _get_category_learning_tips(category),
        }
    
    return {
        "categories": categories,
        "skill_map": {
            skill: {
                "category": data.get("category", CognitiveCategory.EXECUTIVE).value,
                "cognitive_load": data.get("cognitive_load", 0.5),
                "plasticity_index": data.get("plasticity_index", 0.5),
                "transfer_potential": data.get("transfer_potential", 0.5),
                "related_cognitive": [c.value for c in data.get("related_cognitive", [])],
            }
            for skill, data in SKILL_COGNITIVE_MAP.items()
        },
    }


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
def _generate_skill_reasoning(skill_data: dict, market_data: dict) -> str:
    """Genera texto explicativo para una skill."""
    parts = []
    
    if skill_data["priority_score"] >= 80:
        parts.append("Alta prioridad para tu perfil")
    elif skill_data["priority_score"] >= 60:
        parts.append("Buena opción de desarrollo")
    
    if market_data.get("opportunity_count", 0) >= 5:
        parts.append(f"{market_data['opportunity_count']} hackathons lo requieren")
    
    if skill_data["cognitive_load"] > 0.7:
        parts.append("Requiere alta concentración")
    elif skill_data["cognitive_load"] < 0.4:
        parts.append("Skill de entrada ideal")
    
    if skill_data["plasticity_index"] >= 0.7:
        parts.append("Aprendizaje rápido posible")
    elif skill_data["plasticity_index"] < 0.4:
        parts.append("Requiere práctica sostenida")
    
    return " · ".join(parts) if parts else "Considera esta skill para tu desarrollo"


def _get_category_description(category: CognitiveCategory) -> str:
    """Retorna descripción de categoría cognitiva."""
    descriptions = {
        CognitiveCategory.MEMORY: "Retención y manipulación de información. Usado para recordar APIs, patrones y conceptos.",
        CognitiveCategory.ATTENTION: "Enfoque selectivo y sostenida. Crítico para debugging y código complejo.",
        CognitiveCategory.EXECUTIVE: "Planificación y toma de decisiones. Esencial para arquitectura y arquitectura de sistemas.",
        CognitiveCategory.LANGUAGE: "Comprensión y producción verbal. Importante para documentación y comunicación técnica.",
        CognitiveCategory.VISUOSPATIAL: "Procesamiento espacial. Relevante para frontend, UI/UX y visualización de datos.",
        CognitiveCategory.MOTOR: "Coordinación y velocidad motora. Afecta velocidad de escritura de código.",
        CognitiveCategory.METACOGNITION: "Conciencia del propio proceso de aprendizaje. Clave para mejora continua.",
    }
    return descriptions.get(category, "")


def _get_category_learning_tips(category: CognitiveCategory) -> list[str]:
    """Retorna tips de aprendizaje por categoría."""
    tips = {
        CognitiveCategory.MEMORY: [
            "Usa tarjetas de memoria (Anki)",
            "Practica con ejercicios de repetición espaciada",
            "Crea notas mentales y diagramas",
        ],
        CognitiveCategory.ATTENTION: [
            "Usa técnica Pomodoro (25 min focus, 5 min break)",
            "Elimina distracciones durante sesiones de código",
            "Trabaja en bloques de tiempo dedicados",
        ],
        CognitiveCategory.EXECUTIVE: [
            "Planifica antes de programar",
            "Usa metodologías como TDD",
            "Revisa y refactoriza regularmente",
        ],
        CognitiveCategory.LANGUAGE: [
            "Lee documentación en inglés",
            "Escribe blogs técnicos",
            "Participa en code reviews",
        ],
        CognitiveCategory.VISUOSPATIAL: [
            "Usa herramientas visuales (diagrams.net)",
            "Practica con proyectos de UI",
            "Estudia patrones de diseño visual",
        ],
        CognitiveCategory.MOTOR: [
            "Practica touch typing",
            "Usa atajos de teclado",
            "Repite ejercicios de código regularmente",
        ],
        CognitiveCategory.METACOGNITION: [
            "Mantén un journal de aprendizaje",
            "Reflexiona después de cada sesión",
            "Ajusta estrategias según resultados",
        ],
    }
    return tips.get(category, [])
