"""
services/api/schemas/skill.py
─────────────────────────────────────────────────────────────────────────────
Skill and demand schemas for market analysis and user profiles

Used by:
  - services/api/routes/skills.py (GET /skills, POST /skills)
  - services/api/routes/insights.py (GET /insights/tag-analysis)
  - services/api/routes/user-profiles.py (GET /user-profiles/{wallet})
  - engine/agent_crew.py (ProjectAnalyzer agent)

Flow:
  SkillDemandBase → SkillDemandRead
  UserSkillProfileBase → UserSkillProfileCreate/Read
─────────────────────────────────────────────────────────────────────────────
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────
# Skill Demand Schemas
# ─────────────────────────────────────────────

class SkillDemandBase(BaseModel):
    """Base skill demand information."""
    label: str                                  # e.g., "Python", "Solana", "Leadership"
    sublabel: Optional[str] = None              # e.g., "Backend Development"
    user_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="User's proficiency level (0-1)"
    )
    market_demand: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Market trend / demand level (0-1)"
    )
    color: str = "#7dd3fc"                      # UI color code (tailwind)


class SkillDemandRead(SkillDemandBase):
    """Complete skill demand record from database."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime


class SkillDemandMetric(BaseModel):
    """Aggregated skill demand metric for market analysis."""
    skill: str
    market_demand: float                        # 0-100 normalized
    demand_trend: str                           # "increasing", "stable", "decreasing"
    frequency_count: int                        # How many hackathons mention this skill
    avg_difficulty: str                         # "beginner", "intermediate", "advanced"
    related_skills: list[str]                   # Skills often paired with this one


# ─────────────────────────────────────────────
# User Skill Profile Schemas
# ─────────────────────────────────────────────

class SkillProgressEntry(BaseModel):
    """Single skill progress entry for a user."""
    skill_name: str
    hours_practiced: float = 0.0               # Total hours invested
    mastery_level: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Estimated mastery (0-1)"
    )
    streak_days: int = 0                       # Current learning streak
    last_practiced: Optional[datetime] = None  # When user last practiced


class UserSkillProfileBase(BaseModel):
    """Base user skill profile information."""
    verified_skills: list[str] = []            # Skills with verified credentials
    preferred_tech_stack: list[str] = []       # Technologies user wants to use
    learning_history: list[dict] = Field(
        default_factory=list,
        description="List of completed learning activities"
    )
    certifications: list[dict] = Field(
        default_factory=list,
        description="Completed certifications"
    )
    total_skill_hours: float = Field(
        default=0.0,
        ge=0.0,
        description="Total hours invested across all skills"
    )
    skill_diversity_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Breadth of skills (0-1)"
    )
    preferred_difficulty: Optional[str] = Field(
        default=None,
        pattern="^(beginner|intermediate|advanced)$"
    )
    preferred_event_types: list[str] = []      # ["virtual", "in-person", "hybrid"]
    neuroplasticity_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Learning capacity / adaptability (0-1)"
    )


class UserSkillProfileCreate(UserSkillProfileBase):
    """Schema for creating a new user skill profile."""
    wallet_address: str                         # Required for profile creation


class UserSkillProfileRead(UserSkillProfileBase):
    """Complete user skill profile from database."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    wallet_address: str
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────
# Neuro Profile Schemas
# ─────────────────────────────────────────────

class CognitiveProfile(BaseModel):
    """User's neuropsychological cognitive profile."""
    dominant_category: str = Field(
        default="executive",
        description="Dominant cognitive strength (memory, attention, executive, language, visuospatial, motor, metacognition)"
    )
    cognitive_strengths: list[str] = Field(
        default_factory=list,
        description="Identified cognitive strengths"
    )
    cognitive_weaknesses: list[str] = Field(
        default_factory=list,
        description="Identified cognitive weaknesses"
    )


class LearningPreferences(BaseModel):
    """User's learning style and timing preferences."""
    learning_style: str = Field(
        default="visual",
        pattern="^(visual|auditory|reading|kinesthetic)$"
    )
    optimal_time: str = Field(
        default="morning",
        pattern="^(morning|afternoon|evening|night)$"
    )
    available_minutes_daily: int = Field(
        default=90,
        ge=15,
        le=480,
        description="Minutes available for learning per day"
    )


class UserNeuroProfileBase(BaseModel):
    """Base neuropsychological profile for personalized learning."""
    wallet_address: str
    cognitive_profile: CognitiveProfile = Field(default_factory=CognitiveProfile)
    learning_preferences: LearningPreferences = Field(default_factory=LearningPreferences)
    
    # Skill progress tracking
    skills_progress: dict = Field(
        default_factory=dict,
        description='{"python": {"hours": 10, "mastery": 0.45, "streak": 5, "last_practiced": "2026-03-19"}}'
    )
    
    # Computed scores
    neuroplasticity_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Learning capacity (0-1)"
    )
    learning_efficiency: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="How efficiently user learns (0-1)"
    )
    
    # Stats
    total_hours_learned: float = Field(
        default=0.0,
        ge=0.0
    )
    hackathons_participated: int = Field(
        default=0,
        ge=0
    )
    projects_completed: int = Field(
        default=0,
        ge=0
    )
    
    # Goals
    target_skills: list[str] = Field(
        default_factory=list,
        description="Skills user wants to develop"
    )


class UserNeuroProfileRead(UserNeuroProfileBase):
    """Complete user neuro profile from database."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────
# Skill Match & Gap Analysis
# ─────────────────────────────────────────────

class SkillGapAnalysis(BaseModel):
    """Analysis of user's skill gaps against hackathon requirements."""
    required_skills: list[str]
    user_has: list[str]
    gap_skills: list[str]
    
    total_required: int
    user_has_count: int
    gap_count: int
    
    match_percentage: float = Field(
        ge=0.0,
        le=100.0
    )
    recommended_learning_path: list[str]
    estimated_learning_hours: int


# ─────────────────────────────────────────────
# Batch Skill Operations
# ─────────────────────────────────────────────

class BulkSkillDemandUpdate(BaseModel):
    """Bulk update skill demand scores (for market analysis jobs)."""
    updates: list[tuple[str, float, float]]    # [(skill, user_score, market_demand), ...]


class SkillTrendReport(BaseModel):
    """Top trending skills in the market."""
    period: str                                 # "weekly", "monthly", "quarterly"
    top_skills: list[SkillDemandMetric]
    emerging_skills: list[str]
    declining_skills: list[str]
    timestamp: datetime = Field(default_factory=datetime.now)
