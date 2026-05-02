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


# ─────────────────────────────────────────────
# AI Analysis & Skill Extraction schemas
# ─────────────────────────────────────────────

class SkillExtraction(BaseModel):
    """Extracted skill from hackathon analysis."""
    skill_name: str                           # e.g., "Solana", "React", "Python"
    category: str                             # e.g., "Frontend", "Blockchain", "Backend", "DevOps", "ML"
    relevance_score: float                    # 0.0 to 1.0 — how central is this skill to the hackathon
    difficulty: str = "intermediate"          # "beginner", "intermediate", "advanced"
    is_core_requirement: bool = False         # True if essential for winning


class SkillRequirement(BaseModel):
    """Skill requirement for a hackathon."""
    skill: str                                # e.g., "Rust"
    proficiency_level: str = "intermediate"  # "beginner", "intermediate", "advanced"
    years_of_experience: int = 1             # Suggested min. years
    why_important: str                        # Reason this skill matters for the hackathon


class ProjectIdea(BaseModel):
    """Project idea generated from hackathon + skills analysis."""
    title: str                                # Project name
    description: str                          # Detailed description
    skills_covered: list[str]                 # Skills this project teaches/uses
    estimated_hours: int = 40                 # Estimated time to build
    difficulty: str = "intermediate"          # "beginner", "intermediate", "advanced"
    learning_outcomes: list[str] = []         # What student will learn
    revenue_potential: str | None = None      # "low", "medium", "high" (for Web3 projects)


class HackathonAnalysisResult(BaseModel):
    """Complete AI analysis result for a hackathon."""
    hackathon_id: str                         # Reference to hackathon ID
    title: str                                # Hackathon title (for context)
    
    # Extracted requirements
    skills_required: list[SkillExtraction]    # All skills mentioned/inferred
    core_tech_stack: list[str]                # Primary technologies (["Solana", "React"])
    difficulty_level: str                     # Overall difficulty assessment
    
    # Recommended projects
    project_ideas: list[ProjectIdea]          # 2-5 project ideas to build during hackathon
    best_for: str                             # "Who should apply? e.g., 'Backend engineers with Rust experience'"
    
    # Timeline & effort
    estimated_preparation_hours: int = 10    # Prep time before applying
    estimated_hackathon_hours: int = 40       # Time needed during hackathon
    
    # Risk assessment
    recommended_team_size: int = 1            # 1 for solo, 2-3 for small team
    success_rate_estimate: str = "medium"     # "low", "medium", "high"
    
    # Meta
    analysis_timestamp: datetime = datetime.now()
    model_used: str = "claude-3.5-sonnet"     # LLM model version


class SkillMatchReport(BaseModel):
    """User skill match report against a hackathon."""
    hackathon_id: str
    wallet_address: str                       # User's wallet
    
    # Skills analysis
    user_skills: list[str]                    # Skills user has
    required_skills: list[str]                # Skills hackathon requires
    skill_overlap: list[str]                  # Intersection
    skill_gaps: list[str]                     # What user needs to learn
    
    # Scoring
    skill_match_percentage: float              # 0-100: % of required skills user has
    learning_feasibility_score: float          # 0-1: Can user learn missing skills in time?
    overall_readiness: str                     # "ready", "prepare", "not_ready"
    
    # Recommendations
    recommended_prep_path: list[str] = []      # ["Learn Solana basics", "Practice Rust", ...]
    time_to_readiness_hours: int = 0          # Hours of study needed
