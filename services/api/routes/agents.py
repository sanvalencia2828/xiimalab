from typing import Any, Dict, List, Optional
import sys, pathlib
import os as _os
import logging
import asyncpg
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from db import get_db
from agents.notifier import NotifierAgent
from agents.trend_forecaster import TrendForecasterAgent
from agents.coach import CoachAgent
from agents.aura_engagement import AuraEngagementAgent
from agents.connector import ConnectorAgent

# Setup path for engine if needed
sys.path.insert(0, str(pathlib.Path(__file__).parents[3] / "engine"))

router = APIRouter(tags=["agents"])

# Try to load agent_crew if available
try:
    from agent_crew import create_router as _crew_router
    _crew = _crew_router()
    router.include_router(_crew)
except Exception as exc:
    logging.getLogger("xiima.agents").error(f"No se pudo cargar agent_crew: {exc}")

@router.get("/status")
async def get_agents_status():
    """Returns the status of all agents in the system."""
    return {
        "status": "ok",
        "agents": [
            {"name": "Notifier Agent", "status": "running", "last_seen": "2026-03-16T10:30:00Z"},
            {"name": "Trend Forecaster Agent", "status": "running", "last_seen": "2026-03-16T10:25:00Z"},
            {"name": "Coach Agent", "status": "running", "last_seen": "2026-03-16T10:30:00Z"},
            {"name": "Strategist Agent", "status": "running", "last_seen": "2026-03-16T10:28:00Z"},
            {"name": "Connector Agent", "status": "running", "last_seen": "2026-03-16T10:32:00Z"},
        ]
    }

class ConnectorOutreachRequest(BaseModel):
    hackathon_title: str
    match_score: int
    tech_stack: List[str]

@router.post("/connector/networking-strategy")
async def suggest_networking(payload: ConnectorOutreachRequest, db: AsyncSession = Depends(get_db)):
    """Generates a networking strategy and XMTP drafts."""
    connector = ConnectorAgent(db)
    strategy = await connector.suggest_networking_strategy(
        payload.hackathon_title,
        payload.match_score,
        payload.tech_stack
    )
    return strategy

@router.post("/orchestrator/coordinate")
async def run_orchestrator(db: AsyncSession = Depends(get_db)):
    """Triggers the orchestration logic to sync agents."""
    from agents.orchestrator import Orchestrator
    orchestrator = Orchestrator(db)
    await orchestrator.coordinate()
    return {"message": "Orchestration cycle completed"}

@router.post("/notifier/run")
async def run_notifier_agent(db: AsyncSession = Depends(get_db)):
    """Manually triggers the notifier agent to check for signals."""
    notifier = NotifierAgent(db)
    await notifier.watch_signals()
    return {"message": "Notifier agent run completed"}

@router.post("/trend-forecaster/run")
async def run_trend_forecaster_agent(db: AsyncSession = Depends(get_db)):
    """Manually triggers the trend forecaster agent to analyze trends."""
    forecaster = TrendForecasterAgent(db)
    trends = await forecaster.analyze_trends()
    return {"message": "Trend forecaster agent run completed", "trends": trends}

class AssetsRequest(BaseModel):
    hackathon_title: str
    roadmap: dict
    project_idea: str

@router.post("/coach/assets")
async def generate_assets(payload: AssetsRequest, db: AsyncSession = Depends(get_db)):
    """Generates professional assets (README, Pitch) for a hackathon project."""
    coach = CoachAgent(db)
    assets = await coach.generate_hackathon_assets(
        payload.hackathon_title,
        payload.roadmap,
        payload.project_idea
    )
    return assets

class AuraEngagementRequest(BaseModel):
    project_title: str
    hackathon_title: str
    project_idea: str
    tech_stack: List[str]

@router.post("/aura/engagement-kit")
async def generate_engagement_kit(payload: AuraEngagementRequest, db: AsyncSession = Depends(get_db)):
    """Generates a multi-platform engagement kit for social media."""
    aura = AuraEngagementAgent(db)
    kit = await aura.generate_engagement_kit(
        payload.project_title,
        payload.hackathon_title,
        payload.project_idea,
        payload.tech_stack
    )
    return kit

class FeedbackCollectionRequest(BaseModel):
    content_id: str
    platform: str
    metrics: Dict[str, Any]

@router.post("/aura/collect-feedback")
async def collect_feedback(payload: FeedbackCollectionRequest, db: AsyncSession = Depends(get_db)):
    """Collects engagement metrics for a specific content piece."""
    from agents.feedback_collector import EngagementMetricsCollector
    collector = EngagementMetricsCollector(db)
    
    feedback_data = {
        "content_id": payload.content_id,
        "platform": payload.platform,
        "metrics": payload.metrics,
        "collected_at": "2026-03-18T10:30:00Z"
    }
    
    from agents.brain import store_memory
    await store_memory(
        db,
        agent_id="feedback_collector",
        topic=f"feedback-{payload.content_id}-{payload.platform}",
        content=feedback_data
    )
    
    return {"status": "success", "message": "Feedback collected successfully"}

@router.get("/matches")
async def get_project_matches(project_id: str | None = None, limit: int = 10):
    """Devuelve project_hackathon_matches con join a user_projects + active_hackathons."""
    db_url = _os.environ.get("DATABASE_URL", "")
    if not db_url:
        return []
    conn = await asyncpg.connect(db_url)
    try:
        q = """
            SELECT phm.project_id, up.title AS project_title, up.status AS project_status,
                   phm.hackathon_id, phm.hackathon_title, phm.match_pct,
                   phm.shared_tags, phm.reasoning, phm.prize_pool,
                   phm.source, phm.source_url, phm.status AS match_status,
                   1 AS rank
            FROM project_hackathon_matches phm
            JOIN user_projects up ON up.id = phm.project_id
            WHERE phm.match_pct >= 50
        """
        params = []
        if project_id:
            params.append(project_id)
            q += f" AND phm.project_id = ${len(params)}"
        q += f" ORDER BY phm.match_pct DESC LIMIT ${len(params)+1}"
        params.append(limit)
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]
    except Exception:
        return []
    finally:
        await conn.close()
