"""
Pydantic v2 schemas — mirrors the TypeScript interfaces in the frontend.
"""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


# ─────────────────────────────────────────────
# Hackathon schemas
# ─────────────────────────────────────────────
class HackathonBase(BaseModel):
    title: str
    prize_pool: int
    tags: list[str]
    deadline: str      # ISO date string "YYYY-MM-DD"
    match_score: int
    source_url: str | None = None
    source: str = "dorahacks"
    missing_skills: list[str] = []
    project_highlight: str = ""


class HackathonCreate(HackathonBase):
    id: str


class HackathonRead(HackathonBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scraped_at: datetime
    updated_at: datetime
    ai_analysis: dict | None = None

    # Convert snake_case DB fields to camelCase for the frontend
    @field_validator("prize_pool", mode="before")
    @classmethod
    def coerce_prize(cls, v: Any) -> int:
        return int(v)


# ─────────────────────────────────────────────
# Skill schemas
# ─────────────────────────────────────────────
class SkillDemandBase(BaseModel):
    label: str
    sublabel: str | None = None
    user_score: float
    market_demand: float
    color: str = "#7dd3fc"


class SkillDemandRead(SkillDemandBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime
