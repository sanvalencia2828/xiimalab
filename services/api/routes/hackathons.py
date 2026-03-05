"""
Hackathons router — CRUD endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Hackathon
from schemas import HackathonCreate, HackathonRead

router = APIRouter()


@router.get("/", response_model=list[HackathonRead])
async def list_hackathons(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Return paginated hackathons ordered by match_score descending."""
    result = await db.execute(
        select(Hackathon)
        .order_by(Hackathon.match_score.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


@router.get("/{hackathon_id}", response_model=HackathonRead)
async def get_hackathon(
    hackathon_id: str,
    db: AsyncSession = Depends(get_db),
):
    hackathon = await db.get(Hackathon, hackathon_id)
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    return hackathon


@router.post("/", response_model=HackathonRead, status_code=201)
async def create_or_update_hackathon(
    payload: HackathonCreate,
    db: AsyncSession = Depends(get_db),
):
    """Upserts a hackathon — used internally by the scraper."""
    existing = await db.get(Hackathon, payload.id)
    if existing:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(existing, field, value)
        db.add(existing)
    else:
        hackathon = Hackathon(**payload.model_dump())
        db.add(hackathon)
    await db.commit()
    return await db.get(Hackathon, payload.id)
