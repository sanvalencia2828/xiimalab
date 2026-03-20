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


class HackathonExtendedRead(HackathonRead):
    """Extended hackathon response with Devfolio-specific metadata."""
    model_config = ConfigDict(from_attributes=True)
    
    # Devfolio metadata
    tech_stack: list[str] | None = None
    difficulty: str | None = None  # beginner, intermediate, advanced
    requirements: list[str] | None = None
    talent_pool_estimate: int | None = None
    organizer: str | None = None
    city: str | None = None
    event_type: str | None = None  # virtual, in-person, hybrid
    description: str | None = None
    participation_count_estimate: int | None = None


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


# ─────────────────────────────────────────────
# User Skill Profile schemas
# ─────────────────────────────────────────────
class UserSkillProfileBase(BaseModel):
    verified_skills: list[str]
    preferred_tech_stack: list[str]
    learning_history: list[dict] = []
    certifications: list[dict] = []
    total_skill_hours: float = 0.0
    skill_diversity_score: float = 0.0
    preferred_difficulty: str | None = None
    preferred_event_types: list[str] = []
    neuroplasticity_score: float = 0.5


class UserSkillProfileCreate(UserSkillProfileBase):
    wallet_address: str


class UserSkillProfileRead(UserSkillProfileBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    wallet_address: str
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────
# Personalized Scoring Response
# ─────────────────────────────────────────────
class PersonalizedMatchScore(BaseModel):
    """Detailed scoring breakdown for a single hackathon matching."""
    skill_overlap_score: float
    urgency_score: float
    value_score: float
    tech_stack_score: float
    neuro_score: float
    
    personalized_score: float  # Weighted composite
    reasoning: str  # Human-readable breakdown


class DevfolioHackathonPersonalizedResponse(HackathonExtendedRead):
    """Hackathon response WITH personalized scoring."""
    urgency_score: float        # Days to deadline urgency
    value_score: float          # Prize percentile
    personalized_score: float | None = None  # Weighted composite (only if wallet provided)
    match_breakdown: PersonalizedMatchScore | None = None  # Detailed scoring


# ─────────────────────────────────────────────
# Aggregated Hackathon schemas (Phase 4)
# ─────────────────────────────────────────────

class SourceMetadata(BaseModel):
    """Metadata about a hackathon's sources (multi-source aggregation)."""
    model_config = ConfigDict(from_attributes=True)
    
    sources: list[str]              # ["devfolio", "dorahacks"]
    primary_source: str             # Highest priority source
    source_urls: dict[str, str]     # source → URL mapping
    is_multi_source: bool           # True if from multiple sources
    source_confidence: float        # 0.7-1.0 based on source count


class AggregatedHackathonResponse(HackathonExtendedRead):
    """Extended response with multi-source aggregation metadata."""
    model_config = ConfigDict(from_attributes=True)

    source_metadata: SourceMetadata

    # Phase 3 Scoring
    urgency_score: float | None = None
    value_score: float | None = None
    personalized_score: float | None = None
    match_breakdown: PersonalizedMatchScore | None = None


# ─────────────────────────────────────────────
# Milestone Approval Workflow schemas
# ─────────────────────────────────────────────

class MarkMilestoneCompletedRequest(BaseModel):
    """Request schema: Student marks milestone as completed."""
    completion_proof_url: str | None = None  # URL to GitHub, screenshot, or evidence
    notes: str | None = None  # Optional notes from student


class ApproveMilestoneRequest(BaseModel):
    """Request schema: Coach approves a milestone."""
    approver_address: str  # Coach's wallet address (for audit)
    approver_notes: str | None = None  # Optional coach feedback


class RejectMilestoneRequest(BaseModel):
    """Request schema: Coach rejects a milestone."""
    approver_address: str  # Coach's wallet address (for audit)
    rejection_reason: str  # Required reason for rejection
    allow_resubmission: bool = True  # Can student resubmit?


class MilestoneStatusRead(BaseModel):
    """Response schema: Complete milestone status."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    escrow_id: int
    milestone_number: int
    title: str
    description: str | None = None
    required_skills: list[str] = []

    # Timestamps
    marked_completed_at: datetime | None = None
    approved_at: datetime | None = None
    funds_released_at: datetime | None = None

    # Approver feedback
    approver_notes: str | None = None

    # Release info
    release_amount_xlm: float | None = None
    completion_proof_url: str | None = None

    # Computed status (pending, marked_completed, approved, rejected, released)
    status: str


class PendingMilestoneRead(BaseModel):
    """Response schema: Milestone pending coach approval."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    escrow_id: int
    milestone_number: int
    title: str
    description: str | None = None
    required_skills: list[str] = []

    # When student marked it completed
    marked_completed_at: datetime

    # Proof provided by student
    completion_proof_url: str | None = None

    # Student info (for coach review)
    student_address: str
    escrow_amount: float  # Total escrow amount (for context)
