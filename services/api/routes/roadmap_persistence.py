"""
Learning Roadmap Persistence API
POST /api/v1/learning/roadmaps — Save a generated roadmap
PATCH /api/v1/learning/steps/{step_id} — Mark step as completed / incomplete
GET  /api/v1/learning/roadmaps/{wallet} — Fetch user roadmaps with steps
"""
import hashlib
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import UserRoadmap, RoadmapStep

router = APIRouter(prefix="/learning", tags=["learning-persistence"])


def make_id(seed: str) -> str:
    return hashlib.md5(seed.encode()).hexdigest()[:12]


class RoadmapStepCreate(BaseModel):
    step_index: int
    title: str
    duration: str = "0h"
    step_type: str = "Doc"
    description: Optional[str] = None


class RoadmapCreate(BaseModel):
    wallet_address: str
    hackathon_id: str
    skill: str
    target_level: int = 60
    steps: list[RoadmapStepCreate] = []


class StepUpdate(BaseModel):
    is_completed: bool


class StepProgressResponse(BaseModel):
    step_id: str
    title: str
    is_completed: bool
    completed_at: Optional[str] = None


class RoadmapProgressResponse(BaseModel):
    roadmap_id: str
    skill: str
    total_steps: int
    completed_steps: int
    progress_percent: int
    steps: list[StepProgressResponse]


@router.post("/roadmaps", status_code=201)
async def create_roadmap(
    payload: RoadmapCreate,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Persist a generated roadmap with its steps."""
    if not payload.wallet_address:
        raise HTTPException(status_code=400, detail="wallet_address is required")

    roadmap_id = make_id(f"{payload.wallet_address}:{payload.hackathon_id}:{payload.skill}")

    existing = await db.execute(
        select(UserRoadmap).where(UserRoadmap.id == roadmap_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Roadmap already exists")

    now = datetime.utcnow()
    roadmap = UserRoadmap(
        id=roadmap_id,
        wallet_address=payload.wallet_address,
        hackathon_id=payload.hackathon_id,
        skill=payload.skill,
        target_level=payload.target_level,
        created_at=now,
        updated_at=now,
    )
    db.add(roadmap)

    for step in payload.steps:
        step_id = make_id(f"{roadmap_id}:step:{step.step_index}")
        db.add(RoadmapStep(
            id=step_id,
            roadmap_id=roadmap_id,
            step_index=step.step_index,
            title=step.title,
            duration=step.duration,
            step_type=step.step_type,
            description=step.description,
            is_completed=False,
            created_at=now,
            updated_at=now,
        ))

    await db.flush()
    return {
        "success": True,
        "roadmap_id": roadmap_id,
        "message": f"Roadmap saved with {len(payload.steps)} steps",
        "steps": [
            {
                "step_id": make_id(f"{roadmap_id}:step:{step.step_index}"),
                "step_index": step.step_index,
                "title": step.title,
            }
            for step in payload.steps
        ],
    }


@router.patch("/steps/{step_id}")
async def update_step_status(
    step_id: str,
    payload: StepUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Mark a roadmap step as completed or not."""
    step = await db.execute(
        select(RoadmapStep).where(RoadmapStep.id == step_id)
    )
    step_record = step.scalar_one_or_none()

    if not step_record:
        raise HTTPException(status_code=404, detail="Step not found")

    completed_at = datetime.utcnow() if payload.is_completed else None
    await db.execute(
        update(RoadmapStep)
        .where(RoadmapStep.id == step_id)
        .values(
            is_completed=payload.is_completed,
            completed_at=completed_at,
            updated_at=datetime.utcnow(),
        )
    )
    await db.flush()

    return {
        "success": True,
        "step_id": step_id,
        "is_completed": payload.is_completed,
        "completed_at": completed_at.isoformat() if completed_at else None,
    }


@router.get("/roadmaps/{wallet}")
async def get_user_roadmaps(
    wallet: str,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Fetch all roadmaps (with step progress) for a user."""
    roadmaps = await db.execute(
        select(UserRoadmap)
        .where(UserRoadmap.wallet_address == wallet)
        .order_by(UserRoadmap.updated_at.desc())
    )
    user_roadmaps = roadmaps.scalars().all()

    result = []
    for roadmap in user_roadmaps:
        steps_result = await db.execute(
            select(RoadmapStep)
            .where(RoadmapStep.roadmap_id == roadmap.id)
            .order_by(RoadmapStep.step_index)
        )
        steps = steps_result.scalars().all()

        total = len(steps)
        completed = sum(1 for s in steps if s.is_completed)

        result.append({
            "roadmap_id": roadmap.id,
            "wallet_address": roadmap.wallet_address,
            "hackathon_id": roadmap.hackathon_id,
            "skill": roadmap.skill,
            "target_level": roadmap.target_level,
            "total_steps": total,
            "completed_steps": completed,
            "progress_percent": round((completed / total) * 100) if total > 0 else 0,
            "created_at": roadmap.created_at.isoformat(),
            "steps": [
                {
                    "step_id": s.id,
                    "step_index": s.step_index,
                    "title": s.title,
                    "duration": s.duration,
                    "step_type": s.step_type,
                    "description": s.description,
                    "is_completed": s.is_completed,
                    "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                }
                for s in steps
            ],
        })

    return result