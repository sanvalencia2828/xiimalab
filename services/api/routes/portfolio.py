"""
Portfolio Generator API — Genera portafolio profesional desde datos del usuario
"""
from __future__ import annotations

import os
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Hackathon, UserNeuroProfile, UserAchievement

log = logging.getLogger("xiima.routes.portfolio")
router = APIRouter()


class SkillDetail(BaseModel):
    name: str
    level: int
    category: str
    years_experience: Optional[int] = None
    projects_count: int = 0


class HackathonDetail(BaseModel):
    id: str
    title: str
    prize_pool: int
    date: str
    role: str = "Participant"
    skills_used: list[str]


class AchievementDetail(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    earned_at: str
    category: str


class CognitiveProfile(BaseModel):
    dominant_category: str
    strengths: list[str]
    neuroplasticity: float
    learning_style: str


class PortfolioData(BaseModel):
    wallet_address: str
    generated_at: str
    summary: str
    total_skills: int
    total_hackathons: int
    total_achievements: int
    skills: list[SkillDetail]
    hackathons: list[HackathonDetail]
    achievements: list[AchievementDetail]
    cognitive_profile: Optional[CognitiveProfile]
    market_position: dict
    recommendations: list[str]


class PortfolioResponse(BaseModel):
    portfolio: PortfolioData
    export_formats: list[str]


@router.get("/{wallet_address}", response_model=PortfolioResponse)
async def get_portfolio(
    wallet_address: str,
    include_private: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    """
    Genera un portafolio profesional completo desde los datos del usuario.
    """
    today = datetime.now().date()
    
    # Obtener perfil neuro
    result = await db.execute(
        select(UserNeuroProfile).where(UserNeuroProfile.wallet_address == wallet_address)
    )
    user_profile = result.scalar_one_or_none()
    
    # Obtener skills — TODO: HackathonSkill model not yet implemented
    # result = await db.execute(
    #     select(HackathonSkill).where(HackathonSkill.wallet_address == wallet_address)
    # )
    # user_skills = result.scalars().all()
    user_skills = []
    
    # Obtener hackathons del usuario
    result = await db.execute(
        select(Hackathon).where(
            Hackathon.participants.any(wallet_address=wallet_address)
        )
    )
    user_hackathons = result.scalars().all()
    
    # Obtener achievements
    result = await db.execute(
        select(UserAchievement).where(UserAchievement.wallet_address == wallet_address)
    )
    user_achievements = result.scalars().all()
    
    # Construir datos del portafolio
    skills = [
        SkillDetail(
            name=s.name,
            level=s.level or 50,
            category=s.category or "general",
            projects_count=0
        )
        for s in user_skills
    ]
    
    hackathons = [
        HackathonDetail(
            id=h.id,
            title=h.title,
            prize_pool=h.prize_pool,
            date=h.deadline,
            skills_used=h.tags or []
        )
        for h in user_hackathons
    ]
    
    achievements = [
        AchievementDetail(
            id=a.id,
            title=a.title or "Achievement",
            description=a.description or "",
            icon=a.icon or "🏆",
            earned_at=a.earned_at.isoformat() if a.earned_at else today.isoformat(),
            category=a.category or "general"
        )
        for a in user_achievements
    ]
    
    # Perfil cognitivo
    cognitive_profile = None
    if user_profile:
        dominant = user_profile.dominant_category or "executive"
        learning_styles = {
            "memory": "Visual-Espacial",
            "attention": "Analítico",
            "executive": "Estratégico",
            "language": "Comunicativo",
            "visuospatial": "Creativo",
            "motor": "Práctico",
            "metacognition": "Reflexivo"
        }
        cognitive_profile = CognitiveProfile(
            dominant_category=dominant,
            strengths=user_profile.cognitive_strengths or [],
            neuroplasticity=user_profile.neuroplasticity_score or 0.5,
            learning_style=learning_styles.get(dominant, "Versátil")
        )
    
    # Posición en el mercado
    total_hackathons = await db.execute(select(func.count(Hackathon.id)))
    total_hackathons_count = total_hackathons.scalar() or 0
    
    market_position = {
        "percentile": min(100, int(len(hackathons) / max(total_hackathons_count, 1) * 100)),
        "hackathons_won": sum(1 for h in hackathons if h.prize_pool > 0),
        "total_earnings": sum(h.prize_pool for h in hackathons),
        "skill_diversity": len(set(s.category for s in skills)),
    }
    
    # Generar resumen
    summary_parts = []
    if skills:
        top_skills = sorted(skills, key=lambda x: x.level, reverse=True)[:3]
        summary_parts.append(f"Desarrollador con {len(skills)} habilidades técnicas, destacando en {', '.join(s.name for s in top_skills)}.")
    if hackathons:
        summary_parts.append(f"Participante en {len(hackathons)} hackathons con ${sum(h.prize_pool for h in hackathons)} en premios.")
    if cognitive_profile:
        summary_parts.append(f"Perfil cognitivo dominante: {cognitive_profile.learning_style}.")
    
    summary = " ".join(summary_parts) if summary_parts else "Perfil de desarrollador en construcción."
    
    # Recomendaciones
    recommendations = []
    if len(skills) < 5:
        recommendations.append("Expande tu perfil con más skills para aumentar visibilidad")
    if not hackathons:
        recommendations.append("Participa en tu primer hackathon para empezar a construir tu historial")
    if cognitive_profile and cognitive_profile.neuroplasticity < 0.6:
        recommendations.append(" Trabaja en mejorar tu neuroplasticidad con práctica consistente")
    if market_position["skill_diversity"] < 3:
        recommendations.append("Diversifica tus habilidades en diferentes categorías")
    
    portfolio = PortfolioData(
        wallet_address=wallet_address,
        generated_at=datetime.now().isoformat(),
        summary=summary,
        total_skills=len(skills),
        total_hackathons=len(hackathons),
        total_achievements=len(achievements),
        skills=skills,
        hackathons=hackathons,
        achievements=achievements,
        cognitive_profile=cognitive_profile,
        market_position=market_position,
        recommendations=recommendations
    )
    
    return PortfolioResponse(
        portfolio=portfolio,
        export_formats=["json", "markdown", "pdf"]
    )


@router.get("/{wallet_address}/markdown")
async def get_portfolio_markdown(
    wallet_address: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Genera portafolio en formato Markdown para GitHub/README.
    """
    portfolio_response = await get_portfolio(wallet_address, False, db)
    portfolio = portfolio_response.portfolio
    
    md = f"""# 👨‍💻 Perfil de Desarrollador

**Wallet:** `{portfolio.wallet_address}`

## 📊 Resumen
{portfolio.summary}

## 🛠️ Skills ({portfolio.total_skills})
"""
    for skill in sorted(portfolio.skills, key=lambda x: x.level, reverse=True):
        level_bar = "█" * (skill.level // 10) + "░" * (10 - skill.level // 10)
        md += f"- **{skill.name}** [{level_bar}] {skill.level}%\n"
    
    md += f"""
## 🏆 Hackathons ({portfolio.total_hackathons})
"""
    for h in portfolio.hackathons:
        md += f"- **{h.title}** - ${h.prize_pool} ({h.date})\n"
    
    if portfolio.achievements:
        md += f"""
## 🎖️ Logros ({portfolio.total_achievements})
"""
        for a in portfolio.achievements:
            md += f"- {a.icon} **{a.title}** - {a.description}\n"
    
    if portfolio.cognitive_profile:
        cp = portfolio.cognitive_profile
        md += f"""
## 🧠 Perfil Neuropsicológico
- **Categoría dominante:** {cp.dominant_category}
- **Neuroplasticidad:** {int(cp.neuroplasticity * 100)}%
- **Estilo de aprendizaje:** {cp.learning_style}
- **Fortalezas:** {', '.join(cp.strengths) if cp.strengths else 'En desarrollo'}
"""
    
    md += f"""
---
*Generado por Xiimalab - {datetime.now().strftime('%Y-%m-%d')}*
"""
    
    return {"markdown": md, "filename": "xiimalab-profile.md"}


@router.get("/{wallet_address}/badge")
async def get_skill_badge(
    wallet_address: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Genera un SVG badge con el nivel de skill más alto del usuario.
    """
    # TODO: HackathonSkill model not yet implemented
    # result = await db.execute(
    #     select(HackathonSkill)
    #     .where(HackathonSkill.wallet_address == wallet_address)
    #     .order_by(HackathonSkill.level.desc())
    #     .limit(1)
    # )
    # top_skill = result.scalar_one_or_none()
    top_skill = None
    
    if not top_skill:
        return {
            "error": "No skills found",
            "badge_url": None
        }
    
    # Generar URL para badge (usando shields.io)
    badge_url = f"https://img.shields.io/badge/{top_skill.name}-{top_skill.level}%25-brightgreen?style=for-the-badge"
    
    return {
        "skill": top_skill.name,
        "level": top_skill.level,
        "badge_url": badge_url,
        "markdown": f"![{top_skill.name}]({badge_url})"
    }
