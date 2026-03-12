"""
Hackathons router — CRUD + Portfolio milestone integration
"""
from __future__ import annotations

import logging
import sys, pathlib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Hackathon
from schemas import HackathonCreate, HackathonRead

# Staking engine para registrar aplicaciones como milestones
sys.path.insert(0, str(pathlib.Path(__file__).parents[3] / "engine"))
from staking_manager import record_hackathon_application

log = logging.getLogger("xiima.routes.hackathons")
router = APIRouter()


class ApplyPayload(BaseModel):
    user_id: str
    hackathon_id: str


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


@router.post("/{hackathon_id}/apply")
async def apply_to_hackathon(
    hackathon_id: str,
    payload: ApplyPayload,
    db: AsyncSession = Depends(get_db),
):
    """
    Registra que un usuario aplica a una hackatón.
    Esto se considera un hito de portafolio válido para liberar el staking
    de Proof of Skill en Stellar.
    """
    hackathon = await db.get(Hackathon, hackathon_id)
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")

    try:
        staking_result = await record_hackathon_application(
            user_id=payload.user_id,
            hackathon_id=hackathon_id,
            hackathon_title=hackathon.title,
            source=hackathon.source,
        )
        log.info(
            f"Portfolio milestone — user={payload.user_id} "
            f"hackathon={hackathon_id} released={len(staking_result.get('released_escrows', []))}"
        )
        return {
            "hackathon_id": hackathon_id,
            "hackathon_title": hackathon.title,
            "staking": staking_result,
        }
    except Exception as exc:
        log.error(f"Error registrando aplicación a hackatón: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
