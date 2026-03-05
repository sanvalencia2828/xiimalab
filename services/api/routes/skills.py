"""
Skills router — market demand analytics
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import SkillDemand
from schemas import SkillDemandRead

router = APIRouter()


@router.get("/market", response_model=list[SkillDemandRead])
async def list_skill_demands(db: AsyncSession = Depends(get_db)):
    """Return all skill vs market demand records ordered by market_demand descending."""
    result = await db.execute(
        select(SkillDemand).order_by(SkillDemand.market_demand.desc())
    )
    return result.scalars().all()
