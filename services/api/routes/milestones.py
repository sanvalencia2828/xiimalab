"""
Milestone Approval Workflow — FastAPI routes
─────────────────────────────────────────────────────────────────
Handles the complete lifecycle of milestone approval:
  1. Student marks milestone as completed (with proof URL)
  2. Coach retrieves pending milestones for approval
  3. Coach approves (or rejects) milestone
  4. System auto-releases payment when all milestones approved
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from schemas import (
    MarkMilestoneCompletedRequest,
    ApproveMilestoneRequest,
    RejectMilestoneRequest,
    MilestoneStatusRead,
    PendingMilestoneRead,
)

# Import staking_manager for potential future use
# (Currently using direct SQL, but keeping imports for consistency)

log = logging.getLogger("xiima.routes.milestones")
router = APIRouter()


# ─────────────────────────────────────────────────────────────
# Helper Functions (direct SQL access)
# ─────────────────────────────────────────────────────────────


async def get_milestone_status(
    db: AsyncSession, escrow_id: int, milestone_id: int
) -> dict:
    """Fetch milestone status from DB."""
    from sqlalchemy import text

    result = await db.execute(
        text(
            """
            SELECT
                em.id,
                em.escrow_id,
                em.milestone_number,
                em.title,
                em.description,
                em.required_skills,
                em.marked_completed_at,
                em.approved_at,
                em.approver_notes,
                em.funds_released_at,
                em.release_amount_xlm,
                em.completion_proof_url
            FROM escrow_milestones em
            WHERE em.id = :milestone_id AND em.escrow_id = :escrow_id
            """
        ),
        {"milestone_id": milestone_id, "escrow_id": escrow_id},
    )
    row = result.first()
    if not row:
        return None
    return row._mapping


def milestone_status_string(milestone: dict) -> str:
    """Compute the status string from milestone data."""
    if milestone["funds_released_at"]:
        return "released"
    elif milestone["approved_at"]:
        return "approved"
    elif milestone["marked_completed_at"]:
        return "marked_completed"
    else:
        return "pending"


def milestone_to_read(milestone: dict) -> MilestoneStatusRead:
    """Convert DB row to MilestoneStatusRead schema."""
    return MilestoneStatusRead(
        id=milestone["id"],
        escrow_id=milestone["escrow_id"],
        milestone_number=milestone["milestone_number"],
        title=milestone["title"],
        description=milestone["description"],
        required_skills=milestone["required_skills"] or [],
        marked_completed_at=milestone["marked_completed_at"],
        approved_at=milestone["approved_at"],
        approver_notes=milestone["approver_notes"],
        funds_released_at=milestone["funds_released_at"],
        release_amount_xlm=milestone["release_amount_xlm"],
        completion_proof_url=milestone["completion_proof_url"],
        status=milestone_status_string(milestone),
    )


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────


@router.post(
    "/{escrow_id}/mark-completed",
    response_model=dict,
    summary="Mark milestone as completed (Student action)",
)
async def mark_milestone_completed(
    escrow_id: int,
    payload: MarkMilestoneCompletedRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Student marks a milestone as completed and optionally provides proof URL.

    This transitions the milestone from 'pending' → 'marked_completed'.
    The coach must then approve it for funds to be released.

    Args:
        escrow_id: ID of the escrow contract
        payload: Completion proof and notes
        db: Database session

    Returns:
        Milestone status update

    Raises:
        HTTPException: 404 if no pending milestones found
    """
    from sqlalchemy import text

    try:
        # Find the first pending milestone for this escrow
        result = await db.execute(
            text(
                """
                SELECT id, milestone_number
                FROM escrow_milestones
                WHERE escrow_id = :escrow_id
                  AND marked_completed_at IS NULL
                ORDER BY milestone_number ASC
                LIMIT 1
                """
            ),
            {"escrow_id": escrow_id},
        )
        milestone = result.first()
        if not milestone:
            raise HTTPException(
                status_code=404,
                detail="No pending milestones found for this escrow",
            )

        milestone_id = milestone.id

        # Mark as completed
        await db.execute(
            text(
                """
                UPDATE escrow_milestones
                SET marked_completed_at = :now,
                    completion_proof_url = :proof_url,
                    updated_at = :now
                WHERE id = :milestone_id
                """
            ),
            {
                "milestone_id": milestone_id,
                "now": datetime.now(timezone.utc),
                "proof_url": payload.completion_proof_url,
            },
        )

        # Log state transition
        await db.execute(
            text(
                """
                INSERT INTO escrow_timeline (escrow_id, from_state, to_state, actor, reason, metadata)
                VALUES (:escrow_id, 'MILESTONE_UPDATES', 'MILESTONE_UPDATES', 'student', 'milestone_marked_completed', :metadata)
                """
            ),
            {
                "escrow_id": escrow_id,
                "metadata": '{"milestone_id": ' + str(milestone_id) + "}",
            },
        )

        await db.commit()

        log.info(
            f"✅ Milestone #{milestone_id} marked completed for escrow #{escrow_id}"
        )

        return {
            "milestone_id": milestone_id,
            "status": "marked_completed",
            "marked_completed_at": datetime.now(timezone.utc).isoformat(),
            "next_step": "Awaiting coach approval",
        }

    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        log.error(f"Error marking milestone completed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/pending-approval",
    response_model=list[PendingMilestoneRead],
    summary="Get milestones pending coach approval",
)
async def list_pending_milestones(
    coach_address: str = Query(..., description="Coach's wallet address"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all milestones marked completed but not yet approved by coach.

    This allows coaches to see pending work and approve/reject milestones.

    Args:
        coach_address: Coach's wallet address (for audit)
        limit: Max number of results
        db: Database session

    Returns:
        List of pending milestones
    """
    from sqlalchemy import text

    try:
        result = await db.execute(
            text(
                """
                SELECT
                    em.id,
                    em.escrow_id,
                    em.milestone_number,
                    em.title,
                    em.description,
                    em.required_skills,
                    em.marked_completed_at,
                    em.completion_proof_url,
                    el.student_address,
                    el.amount_xlm as escrow_amount
                FROM escrow_milestones em
                JOIN escrow_ledger el ON el.id = em.escrow_id
                WHERE em.marked_completed_at IS NOT NULL
                  AND em.approved_at IS NULL
                ORDER BY em.marked_completed_at ASC
                LIMIT :limit
                """
            ),
            {"limit": limit},
        )
        rows = result.fetchall()

        milestones = []
        for row in rows:
            milestones.append(
                PendingMilestoneRead(
                    id=row.id,
                    escrow_id=row.escrow_id,
                    milestone_number=row.milestone_number,
                    title=row.title,
                    description=row.description,
                    required_skills=row.required_skills or [],
                    marked_completed_at=row.marked_completed_at,
                    completion_proof_url=row.completion_proof_url,
                    student_address=row.student_address,
                    escrow_amount=row.escrow_amount,
                )
            )

        log.info(
            f"Coach {coach_address[:8]}... retrieved {len(milestones)} pending milestones"
        )
        return milestones

    except Exception as exc:
        log.error(f"Error listing pending milestones: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/{escrow_id}/{milestone_id}/approve",
    response_model=dict,
    summary="Approve a milestone (Coach action)",
)
async def approve_milestone_endpoint(
    escrow_id: int,
    milestone_id: int,
    payload: ApproveMilestoneRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Coach approves a milestone. If all milestones in the escrow are approved,
    the system automatically transitions to RELEASE state and sends payment.

    Args:
        escrow_id: ID of the escrow
        milestone_id: ID of the milestone to approve
        payload: Coach approval details
        db: Database session

    Returns:
        Approval confirmation and escrow status

    Raises:
        HTTPException: 404/400 for validation errors
    """
    from sqlalchemy import text

    try:
        # Verify milestone exists and is marked completed
        milestone_result = await db.execute(
            text(
                """
                SELECT id, escrow_id, marked_completed_at
                FROM escrow_milestones
                WHERE id = :milestone_id AND escrow_id = :escrow_id
                """
            ),
            {"milestone_id": milestone_id, "escrow_id": escrow_id},
        )
        milestone = milestone_result.first()
        if not milestone:
            raise HTTPException(
                status_code=404, detail="Milestone not found in this escrow"
            )

        if not milestone.marked_completed_at:
            raise HTTPException(
                status_code=400,
                detail="Milestone must be marked completed before approval",
            )

        # Approve the milestone
        await db.execute(
            text(
                """
                UPDATE escrow_milestones
                SET approved_at = :now,
                    approver_notes = :notes,
                    updated_at = :now
                WHERE id = :milestone_id
                """
            ),
            {
                "milestone_id": milestone_id,
                "now": datetime.now(timezone.utc),
                "notes": payload.approver_notes,
            },
        )

        # Log approval transition
        await db.execute(
            text(
                """
                INSERT INTO escrow_timeline (escrow_id, from_state, to_state, actor, reason, metadata)
                VALUES (:escrow_id, 'MILESTONE_UPDATES', 'APPROVAL', :actor, 'coach_approved', :metadata)
                """
            ),
            {
                "escrow_id": escrow_id,
                "actor": payload.approver_address,
                "metadata": '{"milestone_id": '
                + str(milestone_id)
                + ', "notes": "'
                + (payload.approver_notes or "")
                + '"}',
            },
        )

        # Check if ALL milestones are now approved
        approval_check = await db.execute(
            text(
                """
                SELECT
                    el.total_milestones,
                    COUNT(em.id) as approved_count
                FROM escrow_ledger el
                LEFT JOIN escrow_milestones em
                    ON em.escrow_id = el.id AND em.approved_at IS NOT NULL
                WHERE el.id = :escrow_id
                GROUP BY el.id
                """
            ),
            {"escrow_id": escrow_id},
        )
        approval_info = approval_check.first()

        all_approved = (
            approval_info.total_milestones > 0
            and approval_info.approved_count == approval_info.total_milestones
        )

        if all_approved:
            # Transition to RELEASE
            await db.execute(
                text("""UPDATE escrow_ledger SET current_state = 'RELEASE' WHERE id = :escrow_id"""),
                {"escrow_id": escrow_id},
            )

            # Log final transition
            await db.execute(
                text(
                    """
                    INSERT INTO escrow_timeline (escrow_id, from_state, to_state, actor, reason)
                    VALUES (:escrow_id, 'APPROVAL', 'RELEASE', :actor, 'all_milestones_approved')
                    """
                ),
                {"escrow_id": escrow_id, "actor": payload.approver_address},
            )

            log.info(
                f"✅ All milestones approved for escrow #{escrow_id} — transitioning to RELEASE"
            )

        await db.commit()

        return {
            "milestone_id": milestone_id,
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "all_milestones_approved": all_approved,
            "next_step": "Funds released" if all_approved else "Awaiting other milestone approvals",
        }

    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        log.error(f"Error approving milestone: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/{escrow_id}/{milestone_id}/reject",
    response_model=dict,
    summary="Reject a milestone (Coach action)",
)
async def reject_milestone_endpoint(
    escrow_id: int,
    milestone_id: int,
    payload: RejectMilestoneRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Coach rejects a milestone with a reason. This resets the milestone
    to pending state if allow_resubmission is true.

    Args:
        escrow_id: ID of the escrow
        milestone_id: ID of the milestone to reject
        payload: Rejection details
        db: Database session

    Returns:
        Rejection confirmation

    Raises:
        HTTPException: 404/400 for validation errors
    """
    from sqlalchemy import text

    try:
        # Verify milestone exists
        milestone_result = await db.execute(
            text(
                """
                SELECT id, escrow_id
                FROM escrow_milestones
                WHERE id = :milestone_id AND escrow_id = :escrow_id
                """
            ),
            {"milestone_id": milestone_id, "escrow_id": escrow_id},
        )
        milestone = milestone_result.first()
        if not milestone:
            raise HTTPException(
                status_code=404, detail="Milestone not found in this escrow"
            )

        if payload.allow_resubmission:
            # Reset to pending (clear marked_completed_at)
            await db.execute(
                text(
                    """
                    UPDATE escrow_milestones
                    SET marked_completed_at = NULL,
                        completion_proof_url = NULL,
                        updated_at = :now
                    WHERE id = :milestone_id
                    """
                ),
                {"milestone_id": milestone_id, "now": datetime.now(timezone.utc)},
            )
        else:
            # Mark as permanently rejected (could add rejection_reason field)
            await db.execute(
                text(
                    """
                    UPDATE escrow_milestones
                    SET marked_completed_at = NULL,
                        completion_proof_url = NULL,
                        approver_notes = :reason,
                        updated_at = :now
                    WHERE id = :milestone_id
                    """
                ),
                {
                    "milestone_id": milestone_id,
                    "reason": f"REJECTED: {payload.rejection_reason}",
                    "now": datetime.now(timezone.utc),
                },
            )

        # Log rejection
        await db.execute(
            text(
                """
                INSERT INTO escrow_timeline (escrow_id, from_state, to_state, actor, reason, metadata)
                VALUES (:escrow_id, 'MILESTONE_UPDATES', 'MILESTONE_UPDATES', :actor, 'milestone_rejected', :metadata)
                """
            ),
            {
                "escrow_id": escrow_id,
                "actor": payload.approver_address,
                "metadata": '{"milestone_id": '
                + str(milestone_id)
                + ', "reason": "'
                + payload.rejection_reason
                + '", "allow_resubmission": '
                + ("true" if payload.allow_resubmission else "false")
                + "}",
            },
        )

        await db.commit()

        log.info(
            f"⚠️ Milestone #{milestone_id} rejected for escrow #{escrow_id} — resubmission={'allowed' if payload.allow_resubmission else 'not allowed'}"
        )

        return {
            "milestone_id": milestone_id,
            "status": "rejected",
            "rejection_reason": payload.rejection_reason,
            "allow_resubmission": payload.allow_resubmission,
            "next_step": "Student can resubmit" if payload.allow_resubmission else "Contact coach for next steps",
        }

    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        log.error(f"Error rejecting milestone: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/{escrow_id}/status",
    response_model=list[MilestoneStatusRead],
    summary="Get all milestones for an escrow",
)
async def get_escrow_milestones(
    escrow_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all milestones (and their current status) for an escrow contract.

    Args:
        escrow_id: ID of the escrow
        db: Database session

    Returns:
        List of all milestones with their statuses
    """
    from sqlalchemy import text

    try:
        result = await db.execute(
            text(
                """
                SELECT
                    em.id,
                    em.escrow_id,
                    em.milestone_number,
                    em.title,
                    em.description,
                    em.required_skills,
                    em.marked_completed_at,
                    em.approved_at,
                    em.approver_notes,
                    em.funds_released_at,
                    em.release_amount_xlm,
                    em.completion_proof_url
                FROM escrow_milestones em
                WHERE em.escrow_id = :escrow_id
                ORDER BY em.milestone_number ASC
                """
            ),
            {"escrow_id": escrow_id},
        )
        rows = result.fetchall()

        if not rows:
            raise HTTPException(
                status_code=404, detail="Escrow not found or has no milestones"
            )

        milestones = []
        for row in rows:
            milestone_dict = row._mapping.to_dict() if hasattr(row._mapping, 'to_dict') else dict(row._mapping)
            milestones.append(milestone_to_read(milestone_dict))

        log.info(f"Retrieved {len(milestones)} milestones for escrow #{escrow_id}")
        return milestones

    except HTTPException:
        raise
    except Exception as exc:
        log.error(f"Error retrieving milestones: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
