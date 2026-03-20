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
    
    # Devfolio-specific metadata (nullable for backward compatibility)
    tech_stack: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String(32), nullable=True)  # beginner, intermediate, advanced
    requirements: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    talent_pool_estimate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    organizer: Mapped[str | None] = mapped_column(String(256), nullable=True)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    event_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # virtual, in-person, hybrid
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    participation_count_estimate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
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
# ─────────────────────────────────────────────
# AI Agent Infrastructure
# ─────────────────────────────────────────────

class AgentKnowledge(Base):
    """Shared state and context for collaborative agents."""
    __tablename__ = "agent_knowledge"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g., 'scout', 'strategist'
    topic: Mapped[str] = mapped_column(String(128), nullable=False)
    content: Mapped[dict] = mapped_column(JSON, nullable=False)
    relevance_score: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AgentSignal(Base):
    """Event-driven triggers between specialized agents."""
    __tablename__ = "agent_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_agent: Mapped[str] = mapped_column(String(64), nullable=False)
    target_agent: Mapped[str | None] = mapped_column(String(64), nullable=True)  # None = broadcast
    signal_type: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g., 'new_discovery', 'analysis_ready'
    payload: Mapped[dict] = mapped_column(JSON, nullable=True)
    is_processed: Mapped[bool] = mapped_column(nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UserProject(Base):
    """Tracking user projects for AI profile enrichment."""
    __tablename__ = "user_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    github_repo_id: Mapped[int | None] = mapped_column(Integer, nullable=True, unique=True)
    repo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    stack: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    impact_score: Mapped[int] = mapped_column(Integer, default=0)
    is_public: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserNeuroProfile(Base):
    """Neuropsychological profile for personalized learning paths."""
    __tablename__ = "user_neuro_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet_address: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    
    # Cognitive profile
    dominant_category: Mapped[str] = mapped_column(String(32), nullable=False, default="executive")
    cognitive_strengths: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    cognitive_weaknesses: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    
    # Learning preferences
    learning_style: Mapped[str] = mapped_column(String(32), nullable=False, default="visual")
    optimal_time: Mapped[str] = mapped_column(String(32), nullable=False, default="morning")
    available_minutes_daily: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    
    # Skill progress tracking
    skills_progress: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # {"python": {"hours": 10, "mastery": 45, "streak": 5, "last_practiced": "2026-03-19"}}
    
    # Computed scores
    neuroplasticity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    learning_efficiency: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    
    # Stats
    total_hours_learned: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    hackathons_participated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    projects_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    # Goals
    target_skills: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class HackathonNotification(Base):
    """Push notification records for hackathon urgency."""
    __tablename__ = "hackathon_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet_address: Mapped[str] = mapped_column(String(64), nullable=False)
    hackathon_id: Mapped[str] = mapped_column(String(64), nullable=False)
    notification_type: Mapped[str] = mapped_column(String(32), nullable=False)  # urgency, deadline, opportunity
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_sent: Mapped[bool] = mapped_column(nullable=False, default=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class RecommendationFeedback(Base):
    """User feedback on hackathon recommendations for adaptive learning."""
    __tablename__ = "recommendation_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet_address: Mapped[str] = mapped_column(String(64), nullable=False)
    hackathon_id: Mapped[str] = mapped_column(String(64), nullable=False)
    feedback_type: Mapped[str] = mapped_column(String(32), nullable=False)  # accepted, rejected, ignored
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class UserSkillProfile(Base):
    """Aggregated user skills for intelligent hackathon matching."""
    __tablename__ = "user_skill_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet_address: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    
    # Skill inventory
    verified_skills: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    # ["Python", "FastAPI", "React", "Smart Contracts"]
    
    preferred_tech_stack: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    # ["Python", "TypeScript", "PostgreSQL", "Ethereum"]
    
    # Additional profiles
    learning_history: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    # [{completed_at, skill, hours, source}]
    
    certifications: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    # [{name, issuer, issued_at}]
    
    # Computed metrics
    total_skill_hours: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    skill_diversity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # 0.0-1.0: Diversity (specialization vs generalization)
    
    # Preferences
    preferred_difficulty: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # "beginner" | "intermediate" | "advanced"
    
    preferred_event_types: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    # ["virtual", "in-person", "hybrid"]
    
    # Cross-reference with neuro profile
    neuroplasticity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    # Synced from user_neuro_profiles.neuroplasticity_score
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class MarketTrend(Base):
    """Market Trends (Real-Time Growth & Demand)"""
    __tablename__ = "market_trends"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    role_name: Mapped[str] = mapped_column(String(128), nullable=False)
    demand_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    growth_percentage: Mapped[str] = mapped_column(String(32), nullable=False, default="+0%")
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="tech")
    top_projects_keywords: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
