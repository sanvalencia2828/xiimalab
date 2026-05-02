"""
services/api/schemas/milestone.py
─────────────────────────────────────────────────────────────────────────────
Educational escrow milestone schemas (Proof of Skill)

Used by:
  - services/api/routes/educational-escrow.py (milestone endpoints)
  - engine/staking_manager.py (milestone validation & release)
  - Stellar blockchain (XLM payment to students)

Milestone Lifecycle:
  pending  → marked_completed  → approved  → released
             (student action)   (coach)     (Stellar txn)

Flow:
  MarkMilestoneCompletedRequest → MilestoneStatusRead
  ApproveMilestoneRequest → MilestoneStatusRead (approved_at set)
  Released → funds_released_at + student receives XLM
─────────────────────────────────────────────────────────────────────────────
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────
# Milestone Completion Request/Response
# ─────────────────────────────────────────────

class MarkMilestoneCompletedRequest(BaseModel):
    """Request: Student marks milestone as completed."""
    completion_proof_url: Optional[str] = None # URL to GitHub, screenshot, evidence
    notes: Optional[str] = None                # Optional notes from student


class ApproveMilestoneRequest(BaseModel):
    """Request: Coach approves a milestone."""
    approver_address: str                      # Coach's wallet address (for audit)
    approver_notes: Optional[str] = None       # Optional coach feedback


class RejectMilestoneRequest(BaseModel):
    """Request: Coach rejects a milestone."""
    approver_address: str                      # Coach's wallet address (for audit)
    rejection_reason: str                      # Required reason for rejection
    allow_resubmission: bool = True            # Can student resubmit?


# ─────────────────────────────────────────────
# Milestone Status Schemas
# ─────────────────────────────────────────────

class MilestoneStatusRead(BaseModel):
    """Complete milestone status (all phases)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    escrow_id: int
    milestone_number: int                      # 1st, 2nd, 3rd milestone
    title: str
    description: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)

    # Timestamps
    marked_completed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    funds_released_at: Optional[datetime] = None

    # Approver feedback
    approver_notes: Optional[str] = None

    # Release info
    release_amount_xlm: Optional[float] = None

    # Completion proof
    completion_proof_url: Optional[str] = None

    # Computed status
    status: str                                 # "pending", "marked_completed", "approved", "rejected", "released"


class PendingMilestoneRead(BaseModel):
    """Milestone pending coach approval."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    escrow_id: int
    milestone_number: int
    title: str
    description: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)

    # When student marked it completed
    marked_completed_at: datetime

    # Proof provided by student
    completion_proof_url: Optional[str] = None

    # Student info (for coach review)
    student_address: str
    escrow_amount: float                       # Total escrow amount (for context)


# ─────────────────────────────────────────────
# Escrow Lifecycle Schemas
# ─────────────────────────────────────────────

class EscrowState(BaseModel):
    """Current state of an educational escrow."""
    status: str = Field(
        description="pending | funding | active | released | refunded"
    )
    student_address: str
    coach_address: Optional[str] = None
    total_amount_xlm: float
    milestone_count: int
    
    # Timestamps
    created_at: datetime
    funded_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None
    
    # Stellar info
    claimable_balance_id: Optional[str] = None


class MilestoneReleaseEvent(BaseModel):
    """Event: Milestone was completed and funds released."""
    milestone_id: int
    escrow_id: int
    student_address: str
    coach_address: Optional[str] = None
    
    release_amount_xlm: float
    stellar_tx_hash: Optional[str] = None
    
    released_at: datetime


# ─────────────────────────────────────────────
# Milestone Template Schemas (for creation)
# ─────────────────────────────────────────────

class MilestoneTemplate(BaseModel):
    """Template for creating milestones in a new escrow."""
    title: str
    description: str
    required_skills: list[str]
    estimated_hours: int = Field(
        default=40,
        ge=1,
        le=500,
        description="Estimated time to complete"
    )
    release_amount_percentage: float = Field(
        default=25.0,
        ge=5.0,
        le=100.0,
        description="% of total escrow released on completion (0-100)"
    )


class CreateEscrowRequest(BaseModel):
    """Request to create a new educational escrow."""
    student_address: str
    total_amount_xlm: float                    # Total XLM to escrow
    coach_address: Optional[str] = None        # Optional coach to approve milestones
    
    milestones: list[MilestoneTemplate]        # 2-5 milestones
    
    description: str                           # Course/program description
    skill_focus: list[str]                     # Skills the program teaches
    estimated_duration_days: int = Field(
        default=90,
        ge=7,
        le=365,
        description="Expected duration of the program"
    )


class CreateEscrowResponse(BaseModel):
    """Response: Escrow created successfully."""
    escrow_id: int
    status: str = "pending"
    claimable_balance_id: Optional[str] = None
    stellar_funding_address: Optional[str] = None  # Where to send XLM
    message: str


# ─────────────────────────────────────────────
# Milestone Progress Schemas (Tracking)
# ─────────────────────────────────────────────

class MilestoneProgressEntry(BaseModel):
    """Single entry in a milestone's progress tracking."""
    timestamp: datetime
    event_type: str                            # "started", "checkpoint", "submitted", "approved", "released"
    description: str
    metadata: Optional[dict] = None            # Additional context


class MilestoneProgressTrack(BaseModel):
    """Complete progress history for a milestone."""
    milestone_id: int
    escrow_id: int
    
    milestones: list[MilestoneProgressEntry]
    
    # Summary
    current_status: str
    percent_complete: float = Field(
        ge=0.0,
        le=100.0
    )
    days_elapsed: int
    estimated_days_remaining: int


class EscrowCompletionReport(BaseModel):
    """Report on completed escrow (for student record)."""
    escrow_id: int
    student_address: str
    
    total_released_xlm: float
    completion_date: datetime
    
    skills_certified: list[str]
    milestones_completed: int
    
    coach_rating: Optional[float] = Field(
        default=None,
        ge=1.0,
        le=5.0,
        description="Coach's rating of student performance (1-5 stars)"
    )
    coach_comments: Optional[str] = None
    
    proof_of_completion: str                   # URL to certificate or credential
