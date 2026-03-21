"""
Match Router — AI-powered hackathon ↔ profile evaluation
POST /api/v1/match/evaluate
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Any

from services.analytics import evaluate_profile_match

router = APIRouter(prefix="/match", tags=["AI Matchmaker"])


# ── Request / Response schemas ─────────────────────────────

class UserProfileIn(BaseModel):
    username:         str  = Field(default="user", example="sanxi_ima")
    skills:           list[str] = Field(default_factory=list, example=["Python", "Next.js", "FastAPI"])
    stack:            list[str] = Field(default_factory=list, example=["TypeScript", "Docker"])
    experience:       str  = Field(default="intermediate", example="intermediate")
    hackathons_count: int  = Field(default=0, example=2)

class HackathonIn(BaseModel):
    title:      str       = Field(example="AI Agents Global Sprint")
    tags:       list[str] = Field(default_factory=list, example=["AI/ML", "Agents"])
    prize_pool: int       = Field(default=0, example=40000)
    deadline:   str       = Field(default="", example="2026-04-15")
    source:     str       = Field(default="", example="devfolio")
    source_url: str       = Field(default="", example="https://devfolio.co/ai-agents")

class EvaluateRequest(BaseModel):
    user_profile:  UserProfileIn
    hackathon_data: HackathonIn

class EvaluateResponse(BaseModel):
    match_score:     int
    matching_skills: list[str]
    missing_skills:  list[str]
    recommendation:  str
    model_used:      str = ""


# ── Endpoint ───────────────────────────────────────────────

@router.post("/evaluate", response_model=EvaluateResponse, summary="AI Profile × Hackathon Match")
async def evaluate_match(body: EvaluateRequest) -> EvaluateResponse:
    """
    Evaluates compatibility between a developer profile and a hackathon using AI.
    
    Returns:
    - **match_score**: 0-100 compatibility score
    - **matching_skills**: skills the user has that are relevant
    - **missing_skills**: key skills to acquire for this hackathon
    - **recommendation**: one concrete actionable suggestion
    """
    result = await evaluate_profile_match(
        user_profile=body.user_profile.model_dump(),
        hackathon_data=body.hackathon_data.model_dump(),
    )

    import os
    return EvaluateResponse(
        **result,
        model_used=os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet"),
    )
