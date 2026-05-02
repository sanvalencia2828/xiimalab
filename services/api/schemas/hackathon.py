"""
services/api/schemas/hackathon.py
─────────────────────────────────────────────────────────────────────────────
Hackathon response schemas for API endpoints

Used by:
  - services/api/routes/hackathons.py (GET /, GET /{id})
  - services/api/routes/devfolio.py (personalized scoring)
  - services/api/routes/aggregated.py (multi-source aggregation)

Flow:
  HackathonBase → HackathonCreate → HackathonRead
  HackathonRead → HackathonExtendedRead → (DevfolioHackathonPersonalizedResponse | AggregatedHackathonResponse)
─────────────────────────────────────────────────────────────────────────────
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator


# ─────────────────────────────────────────────
# Base Hackathon Schemas
# ─────────────────────────────────────────────

class HackathonBase(BaseModel):
    """Base hackathon information (common fields)."""
    title: str
    prize_pool: int
    tags: list[str]
    deadline: str                              # ISO date string "YYYY-MM-DD"
    match_score: int                           # 0-100 computed match score
    source_url: Optional[str] = None
    source: str = "dorahacks"                  # "dorahacks", "devfolio", "devpost"
    missing_skills: list[str] = []
    project_highlight: str = ""


class HackathonCreate(HackathonBase):
    """Schema for creating a new hackathon record."""
    id: str                                     # MD5(title.lower())[:12]


class HackathonRead(HackathonBase):
    """Standard hackathon response for GET endpoints."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    scraped_at: datetime
    updated_at: datetime
    ai_analysis: Optional[dict] = None          # JSON analysis result

    @field_validator("prize_pool", mode="before")
    @classmethod
    def coerce_prize(cls, v: Any) -> int:
        return int(v)


# ─────────────────────────────────────────────
# Extended Hackathon Schemas (Devfolio metadata)
# ─────────────────────────────────────────────

class HackathonExtendedRead(HackathonRead):
    """Extended hackathon response with Devfolio-specific metadata."""
    model_config = ConfigDict(from_attributes=True)
    
    # Devfolio-specific metadata
    tech_stack: Optional[list[str]] = None      # ["React", "Node.js", "Solana", ...]
    difficulty: Optional[str] = None            # "beginner", "intermediate", "advanced"
    requirements: Optional[list[str]] = None    # Skill requirements from Devfolio
    talent_pool_estimate: Optional[int] = None  # Estimated participants
    organizer: Optional[str] = None             # Organizing company/team
    city: Optional[str] = None                  # Location (for in-person events)
    event_type: Optional[str] = None            # "virtual", "in-person", "hybrid"
    description: Optional[str] = None           # Full hackathon description
    participation_count_estimate: Optional[int] = None


# ─────────────────────────────────────────────
# Personalized Scoring Schemas
# ─────────────────────────────────────────────

class PersonalizedMatchScore(BaseModel):
    """Detailed scoring breakdown for a single hackathon."""
    skill_overlap_score: float                  # 0-100: user skills vs required
    urgency_score: float                        # 0-100: deadline urgency
    value_score: float                          # 0-100: prize pool percentile
    tech_stack_score: float                     # 0-100: tech alignment
    neuro_score: float                          # 0-100: neuroplasticity alignment
    
    personalized_score: float                   # Weighted composite (0-100)
    reasoning: str                              # Human-readable breakdown


class DevfolioHackathonPersonalizedResponse(HackathonExtendedRead):
    """Hackathon response WITH personalized scoring for logged-in user."""
    urgency_score: float                        # Days to deadline urgency (0-100)
    value_score: float                          # Prize percentile (0-100)
    personalized_score: Optional[float] = None  # Weighted composite (only if wallet provided)
    match_breakdown: Optional[PersonalizedMatchScore] = None


# ─────────────────────────────────────────────
# Multi-Source Aggregation (Phase 4)
# ─────────────────────────────────────────────

class SourceMetadata(BaseModel):
    """Metadata about hackathon sources (multi-source aggregation)."""
    model_config = ConfigDict(from_attributes=True)
    
    sources: list[str]                          # ["devfolio", "dorahacks"]
    primary_source: str                         # Highest priority source
    source_urls: dict[str, str]                 # source → URL mapping
    is_multi_source: bool                       # True if from multiple sources
    source_confidence: float                    # 0.7-1.0 based on source count


class AggregatedHackathonResponse(HackathonExtendedRead):
    """Extended response with multi-source aggregation metadata."""
    model_config = ConfigDict(from_attributes=True)

    source_metadata: SourceMetadata

    # Phase 3 Scoring
    urgency_score: Optional[float] = None
    value_score: Optional[float] = None
    personalized_score: Optional[float] = None
    match_breakdown: Optional[PersonalizedMatchScore] = None
