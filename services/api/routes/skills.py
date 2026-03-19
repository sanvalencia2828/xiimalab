"""
Skills router — market demand analytics + user skills management
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import SkillDemand
from schemas import SkillDemandRead

log = logging.getLogger("xiima.routes.skills")
router = APIRouter()


@router.get("/market", response_model=list[SkillDemandRead])
async def list_skill_demands(db: AsyncSession = Depends(get_db)):
    """Return all skill vs market demand records ordered by market_demand descending."""
    result = await db.execute(
        select(SkillDemand).order_by(SkillDemand.market_demand.desc())
    )
    return result.scalars().all()


# ─────────────────────────────────────────────
# User Skills Management
# ─────────────────────────────────────────────
class SkillInput(BaseModel):
    name: str
    level: int = 30
    category: str = "technical"
    market_demand: float = 50.0
    years_experience: float = 0.0
    last_used: Optional[str] = None


class UserSkillsUpdate(BaseModel):
    wallet_address: str
    skills: list[SkillInput]


@router.get("/user/{wallet_address}")
async def get_user_skills(
    wallet_address: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Obtiene las skills de un usuario desde UserNeuroProfile.
    """
    from models import UserNeuroProfile
    
    result = await db.execute(
        select(UserNeuroProfile).where(
            UserNeuroProfile.wallet_address == wallet_address
        )
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {"wallet_address": wallet_address, "skills": []}
    
    skills_progress = profile.skills_progress or {}
    
    return {
        "wallet_address": wallet_address,
        "skills": [
            {
                "name": name,
                "level": data.get("mastery", 30),
                "category": data.get("category", "technical"),
                "market_demand": data.get("market_demand", 50),
                "years_experience": data.get("years", 0),
                "last_used": data.get("last_practiced"),
            }
            for name, data in skills_progress.items()
        ]
    }


@router.post("/user/")
async def update_user_skills(
    payload: UserSkillsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Actualiza las skills de un usuario en PostgreSQL.
    """
    from models import UserNeuroProfile
    
    result = await db.execute(
        select(UserNeuroProfile).where(
            UserNeuroProfile.wallet_address == payload.wallet_address
        )
    )
    profile = result.scalar_one_or_none()
    
    skills_progress = {}
    for skill in payload.skills:
        skills_progress[skill.name.lower()] = {
            "mastery": skill.level,
            "category": skill.category,
            "market_demand": skill.market_demand,
            "years": skill.years_experience,
            "hours": skill.level * 2,
            "streak": 0,
            "last_practiced": skill.last_used or datetime.now().isoformat()[:7],
        }
    
    if profile:
        profile.skills_progress = skills_progress
        profile.target_skills = [s.name for s in payload.skills]
        profile.updated_at = datetime.now()
    else:
        profile = UserNeuroProfile(
            wallet_address=payload.wallet_address,
            skills_progress=skills_progress,
            target_skills=[s.name for s in payload.skills],
            dominant_category="executive",
            cognitive_strengths=["executive", "memory"],
        )
        db.add(profile)
    
    await db.commit()
    
    log.info(f"Updated skills for {payload.wallet_address}: {len(payload.skills)} skills")
    
    return {
        "success": True,
        "wallet_address": payload.wallet_address,
        "skills_count": len(payload.skills),
    }


@router.post("/user/{wallet_address}/practice")
async def log_practice_session(
    wallet_address: str,
    skill_name: str,
    minutes: int,
    db: AsyncSession = Depends(get_db),
):
    """Registra sesión de práctica y actualiza mastery."""
    from models import UserNeuroProfile
    
    result = await db.execute(
        select(UserNeuroProfile).where(
            UserNeuroProfile.wallet_address == wallet_address
        )
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    skills_progress = profile.skills_progress or {}
    
    if skill_name.lower() not in skills_progress:
        skills_progress[skill_name.lower()] = {
            "mastery": 10, "hours": 0, "streak": 0,
            "last_practiced": datetime.now().date().isoformat(),
        }
    
    skill_data = skills_progress[skill_name.lower()]
    new_hours = (minutes / 60) + skill_data.get("hours", 0)
    skill_data["hours"] = new_hours
    
    # Calcular streak
    last_practiced = skill_data.get("last_practiced")
    if last_practiced:
        try:
            last_date = datetime.strptime(last_practiced, "%Y-%m-%d").date()
            days_diff = (datetime.now().date() - last_date).days
            skill_data["streak"] = (skill_data.get("streak", 0) + 1) if days_diff == 1 else 1
        except (ValueError, TypeError):
            skill_data["streak"] = 1
    else:
        skill_data["streak"] = 1
    
    # Actualizar mastery
    new_mastery = min(100, int(new_hours * 2))
    skill_data["mastery"] = new_mastery
    skill_data["last_practiced"] = datetime.now().date().isoformat()
    
    skills_progress[skill_name.lower()] = skill_data
    profile.skills_progress = skills_progress
    profile.total_hours_learned = sum(s.get("hours", 0) for s in skills_progress.values())
    
    await db.commit()
    
    return {
        "skill": skill_name,
        "minutes": minutes,
        "new_mastery": new_mastery,
        "new_streak": skill_data["streak"],
        "total_hours": new_hours,
    }
