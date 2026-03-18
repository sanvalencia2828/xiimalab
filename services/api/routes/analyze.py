"""
Analyze router — POST /analyze/hackathon
Runs Claude 3.5 Sonnet analysis and persists result back to DB.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ai_engine import analyze_competitiveness
from db import get_db
from models import Hackathon
from agents.orchestrator import Orchestrator
from agents.coach import CoachAgent

router = APIRouter()


# ─────────────────────────────────────────────
# Request / Response schemas (inline — simple)
# ─────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    id: str
    title: str
    tags: list[str] = []
    prize_pool: int = 0
    description: str = ""   # optional extra context
    force: bool = False      # set True to bypass cache and re-run Claude


class AnalysisResult(BaseModel):
    hackathon_id: str
    match_score: int
    missing_skills: list[str]
    project_highlight: str
    strategic_category: str = "Skill Builder"
    agent_roadmap: dict | None = None


# ─────────────────────────────────────────────
# POST /analyze/hackathon
# ─────────────────────────────────────────────
@router.post("/hackathon", response_model=AnalysisResult)
async def analyze_hackathon(
    payload: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Run Claude 3.5 competitiveness analysis for a hackathon.

    Cache-first: if the hackathon already has ai_analysis in DB, returns the
    cached result immediately without calling Claude (avoids 429 rate limits).
    Pass force=True to bypass the cache and re-run the analysis.
    """
    hackathon = await db.get(Hackathon, payload.id)

    # Return cached result if available and not forcing refresh
    if hackathon and hackathon.ai_analysis and not payload.force:
        cached = hackathon.ai_analysis
        return AnalysisResult(
            hackathon_id=payload.id,
            match_score=hackathon.match_score,
            missing_skills=cached.get("missing_skills", []),
            project_highlight=cached.get("project_highlight", ""),
            strategic_category=cached.get("strategic_category", "Skill Builder"),
        )

    # Call Claude only for new or forced hackathons
    opportunity = {
        "title": payload.title,
        "tags": payload.tags,
        "prize_pool_usd": payload.prize_pool,
        "description": payload.description,
    }

    result = await analyze_competitiveness(opportunity)

    if hackathon:
        hackathon.match_score = result["match_score"]
        hackathon.ai_analysis = {
            "missing_skills": result["missing_skills"],
            "project_highlight": result["project_highlight"],
            "strategic_category": result["strategic_category"],
        }
        db.add(hackathon)
        await db.commit()

    # --- AGENT COLLABORATION ---
    orchestrator = Orchestrator(db)
    # 1. Strategist signals analysis is ready
    await orchestrator.emit_signal(
        source="strategist",
        signal_type="analysis_complete",
        payload={"hackathon_id": payload.id, "strategic_category": result["strategic_category"]}
    )

    # 2. Trigger Coach Agent for roadmap
    coach = CoachAgent(db)
    roadmap = await coach.generate_roadmap(
        hackathon_title=payload.title,
        strategic_insight=result.get("project_highlight", ""),
        missing_skills=result.get("missing_skills", [])
    )

    return AnalysisResult(
        hackathon_id=payload.id,
        match_score=result["match_score"],
        missing_skills=result["missing_skills"],
        project_highlight=result["project_highlight"],
        strategic_category=result["strategic_category"],
        agent_roadmap=roadmap
    )


# ─────────────────────────────────────────────
# GET /analyze/hackathon/{id}
# Returns cached analysis from DB
# ─────────────────────────────────────────────
@router.get("/hackathon/{hackathon_id}", response_model=AnalysisResult)
async def get_cached_analysis(
    hackathon_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return the last AI analysis stored in DB for a given hackathon."""
    hackathon = await db.get(Hackathon, hackathon_id)
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")

    if hackathon.ai_analysis is None:
        raise HTTPException(
            status_code=404,
            detail="No analysis cached yet — call POST /analyze/hackathon first",
        )

    return AnalysisResult(
        hackathon_id=hackathon_id,
        match_score=hackathon.match_score,
        missing_skills=hackathon.ai_analysis.get("missing_skills", []),
        project_highlight=hackathon.ai_analysis.get("project_highlight", ""),
        strategic_category=hackathon.ai_analysis.get("strategic_category", "Skill Builder"),
    )
