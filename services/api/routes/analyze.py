"""
Analyze router — POST /analyze/hackathon
Runs Claude 3.5 Sonnet analysis using validated schemas and service layer.

Uses:
  - schemas.analysis: AnalyzeHackathonRequest, HackathonAnalysisResult
  - services.analysis_service: analyze_hackathon_with_validation()
  - agents: Orchestrator, CoachAgent for signal emission

Flow:
  POST /analyze/hackathon
    ↓ [AnalyzeHackathonRequest]
  analyze_hackathon_with_validation()
    ↓ [HackathonAnalysisResult]
  Emit signal: analysis_complete
    ↓
  Return AnalyzeHackathonResponse
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from schemas.analysis import (
    AnalyzeHackathonRequest,
    AnalyzeHackathonResponse,
    HackathonAnalysisResult,
)
from services.analysis_service import (
    analyze_hackathon_with_validation,
    get_cached_analysis,
)

# Import agents for signal emission (optional — can be disabled)
try:
    from agents.orchestrator import Orchestrator
    from agents.coach import CoachAgent
    AGENTS_AVAILABLE = True
except ImportError:
    AGENTS_AVAILABLE = False

log = logging.getLogger("xiima.routes.analyze")
router = APIRouter()


# ─────────────────────────────────────────────
# POST /analyze/hackathon
# ─────────────────────────────────────────────

@router.post(
    "/hackathon",
    response_model=AnalyzeHackathonResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze a hackathon with Claude 3.5",
    description="Run AI analysis on a hackathon to extract skills, project ideas, and difficulty assessment."
)
async def analyze_hackathon(
    payload: AnalyzeHackathonRequest,
    db: AsyncSession = Depends(get_db),
    force_refresh: bool = False,
):
    """
    Analyze a hackathon using Claude 3.5 Sonnet.
    
    Cache-first strategy: Returns cached result if available (unless force_refresh=true).
    
    Request body:
        {
            "id": "a1b2c3d4e5f6",
            "title": "Solana Riptide Hackathon",
            "tags": ["web3", "solana", "blockchain"],
            "prize_pool": 250000,
            "description": "Build the next killer dApp on Solana"
        }
    
    Response:
        {
            "hackathon_id": "a1b2c3d4e5f6",
            "analysis": {
                "skills_required": [
                    {
                        "skill_name": "Solana",
                        "category": "Blockchain",
                        "relevance_score": 0.95,
                        "is_core_requirement": true
                    }
                ],
                "project_ideas": [
                    {
                        "title": "Solana NFT Marketplace",
                        "skills_covered": ["Solana", "Rust", "TypeScript"],
                        ...
                    }
                ],
                "difficulty_level": "intermediate"
            },
            "status": "success"
        }
    """
    
    log.info(f"📊 POST /analyze/hackathon — {payload.title}")
    
    try:
        # Validate request (Pydantic already did this)
        # Call service layer for analysis
        analysis, was_cached = await analyze_hackathon_with_validation(
            request=payload,
            db=db,
            force_refresh=force_refresh
        )
        
        # Log cache hit/miss
        cache_status = "📦 (cached)" if was_cached else "🧠 (analyzed)"
        log.info(f"✅ Analysis complete {cache_status}: {payload.title}")
        
        # Emit signal if agents are available
        if AGENTS_AVAILABLE:
            try:
                orchestrator = Orchestrator(db)
                await orchestrator.emit_signal(
                    source="analyze_route",
                    signal_type="analysis_complete",
                    payload={
                        "hackathon_id": payload.id,
                        "title": payload.title,
                        "difficulty": analysis.difficulty_level,
                        "skills_count": len(analysis.skills_required),
                        "cached": was_cached
                    }
                )
                log.info(f"📡 Signal emitted: analysis_complete")
            except Exception as e:
                log.warning(f"Could not emit signal: {e}")
        
        return AnalyzeHackathonResponse(
            hackathon_id=payload.id,
            analysis=analysis,
            status="success"
        )
    
    except ValueError as e:
        # Validation or service error
        log.error(f"❌ Analysis failed: {e}")
        return AnalyzeHackathonResponse(
            hackathon_id=payload.id,
            analysis=None,
            status="failed",
            error=str(e)
        )
    
    except Exception as e:
        # Unexpected error
        log.exception(f"💥 Unexpected error during analysis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during analysis: {str(e)}"
        )


# ─────────────────────────────────────────────
# GET /analyze/hackathon/{id}
# ─────────────────────────────────────────────

@router.get(
    "/hackathon/{hackathon_id}",
    response_model=AnalyzeHackathonResponse,
    summary="Get cached analysis for a hackathon",
    description="Retrieve previously computed AI analysis from cache."
)
async def get_cached_hackathon_analysis(
    hackathon_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Return the last AI analysis stored in DB for a given hackathon.
    
    Returns 404 if hackathon not found or no analysis cached yet.
    """
    
    log.info(f"📖 GET /analyze/hackathon/{hackathon_id}")
    
    try:
        analysis = await get_cached_analysis(hackathon_id, db)
        
        if not analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No cached analysis for hackathon {hackathon_id}. Call POST /analyze/hackathon first."
            )
        
        log.info(f"✅ Retrieved cached analysis for {hackathon_id}")
        
        return AnalyzeHackathonResponse(
            hackathon_id=hackathon_id,
            analysis=analysis,
            status="success"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"💥 Error retrieving analysis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving analysis: {str(e)}"
        )

