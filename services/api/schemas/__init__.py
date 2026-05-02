"""
services/api/schemas/
─────────────────────────────────────────────────────────────────────────────
Pydantic schemas package — organized by domain

Structure:
  __init__.py           → Central imports (backward compatibility)
  analysis.py           → AI analysis & skill extraction schemas
  hackathon.py          → Hackathon response schemas
  skill.py              → Skill & demand schemas
  milestone.py          → Educational escrow milestone schemas

Usage:
  # New modular imports
  from services.api.schemas.analysis import HackathonAnalysisResult, SkillMatchReport
  from services.api.schemas.hackathon import HackathonRead, AggregatedHackathonResponse
  from services.api.schemas.skill import SkillDemandRead, UserSkillProfileRead
  
  # Legacy compatibility (from old schemas.py)
  from services.api.schemas import HackathonRead, SkillDemandRead
─────────────────────────────────────────────────────────────────────────────
"""

# Analysis schemas
from .analysis import (
    AnalyzeHackathonRequest,
    AnalyzeHackathonResponse,
    BatchAnalysisRequest,
    BatchAnalysisResponse,
    HackathonAnalysisResult,
    ProjectIdea,
    SkillExtraction,
    SkillMatchReport,
    SkillRequirement,
)

# Hackathon schemas
from .hackathon import (
    AggregatedHackathonResponse,
    DevfolioHackathonPersonalizedResponse,
    HackathonBase,
    HackathonCreate,
    HackathonExtendedRead,
    HackathonRead,
    PersonalizedMatchScore,
    SourceMetadata,
)

# Skill schemas
from .skill import (
    CognitiveProfile,
    LearningPreferences,
    SkillDemandBase,
    SkillDemandMetric,
    SkillDemandRead,
    SkillGapAnalysis,
    SkillProgressEntry,
    SkillTrendReport,
    UserNeuroProfileBase,
    UserNeuroProfileRead,
    UserSkillProfileBase,
    UserSkillProfileCreate,
    UserSkillProfileRead,
)

# Milestone schemas
from .milestone import (
    ApproveMilestoneRequest,
    CreateEscrowRequest,
    CreateEscrowResponse,
    EscrowCompletionReport,
    EscrowState,
    MarkMilestoneCompletedRequest,
    MilestoneProgressEntry,
    MilestoneProgressTrack,
    MilestoneReleaseEvent,
    MilestoneStatusRead,
    MilestoneTemplate,
    PendingMilestoneRead,
    RejectMilestoneRequest,
)

__all__ = [
    # Analysis
    "SkillExtraction",
    "SkillRequirement",
    "ProjectIdea",
    "HackathonAnalysisResult",
    "SkillMatchReport",
    "AnalyzeHackathonRequest",
    "AnalyzeHackathonResponse",
    "BatchAnalysisRequest",
    "BatchAnalysisResponse",
    # Hackathon
    "HackathonBase",
    "HackathonCreate",
    "HackathonRead",
    "HackathonExtendedRead",
    "PersonalizedMatchScore",
    "DevfolioHackathonPersonalizedResponse",
    "SourceMetadata",
    "AggregatedHackathonResponse",
    # Skill
    "SkillDemandBase",
    "SkillDemandRead",
    "SkillDemandMetric",
    "SkillProgressEntry",
    "UserSkillProfileBase",
    "UserSkillProfileCreate",
    "UserSkillProfileRead",
    "CognitiveProfile",
    "LearningPreferences",
    "UserNeuroProfileBase",
    "UserNeuroProfileRead",
    "SkillGapAnalysis",
    "SkillTrendReport",
    # Milestone
    "MarkMilestoneCompletedRequest",
    "ApproveMilestoneRequest",
    "RejectMilestoneRequest",
    "MilestoneStatusRead",
    "PendingMilestoneRead",
    "EscrowState",
    "MilestoneReleaseEvent",
    "MilestoneTemplate",
    "CreateEscrowRequest",
    "CreateEscrowResponse",
    "MilestoneProgressEntry",
    "MilestoneProgressTrack",
    "EscrowCompletionReport",
]
