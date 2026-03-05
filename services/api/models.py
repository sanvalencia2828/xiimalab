"""
SQLAlchemy ORM models — Hackathon, SkillDemand
"""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────
# Hackathon
# ─────────────────────────────────────────────
class Hackathon(Base):
    __tablename__ = "hackathons"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    prize_pool: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tags: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    deadline: Mapped[str] = mapped_column(String(32), nullable=False)
    match_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_url: Mapped[str] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="dorahacks")
    ai_analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


# ─────────────────────────────────────────────
# User Achievements / Certifications
# ─────────────────────────────────────────────
class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    issuer: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="certification")
    skills: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    issued_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    credential_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


# ─────────────────────────────────────────────
# Skill Market Demand
# ─────────────────────────────────────────────
class SkillDemand(Base):
    __tablename__ = "skill_demands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    sublabel: Mapped[str] = mapped_column(String(256), nullable=True)
    user_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    market_demand: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#7dd3fc")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
