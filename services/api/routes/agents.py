from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db import get_db
from agents.notifier import NotifierAgent
from agents.trend_forecaster import TrendForecasterAgent
from agents.coach import CoachAgent
from agents.aura_engagement import AuraEngagementAgent
from pydantic import BaseModel

from agents.connector import ConnectorAgent

router = APIRouter(tags=["agents"])

@router.get("/agents/status")
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

# ... (rest of the existing routes)

class ConnectorOutreachRequest(BaseModel):
    hackathon_title: str
    match_score: int
    tech_stack: List[str]

@router.post("/agents/connector/networking-strategy")
async def suggest_networking(payload: ConnectorOutreachRequest, db: AsyncSession = Depends(get_db)):
    """Generates a networking strategy and XMTP drafts."""
    connector = ConnectorAgent(db)
    strategy = await connector.suggest_networking_strategy(
        payload.hackathon_title,
        payload.match_score,
        payload.tech_stack
    )
    return strategy

@router.post("/agents/orchestrator/coordinate")
async def run_orchestrator(db: AsyncSession = Depends(get_db)):
    """Triggers the orchestration logic to sync agents."""
    from agents.orchestrator import Orchestrator
    orchestrator = Orchestrator(db)
    await orchestrator.coordinate()
    return {"message": "Orchestration cycle completed"}

@router.post("/agents/notifier/run")
async def run_notifier_agent(db: AsyncSession = Depends(get_db)):
    """Manually triggers the notifier agent to check for signals."""
    notifier = NotifierAgent(db)
    await notifier.watch_signals()
    return {"message": "Notifier agent run completed"}

@router.post("/agents/trend-forecaster/run")
async def run_trend_forecaster_agent(db: AsyncSession = Depends(get_db)):
    """Manually triggers the trend forecaster agent to analyze trends."""
    forecaster = TrendForecasterAgent(db)
    trends = await forecaster.analyze_trends()
    return {"message": "Trend forecaster agent run completed", "trends": trends}

class AssetsRequest(BaseModel):
    hackathon_title: str
    roadmap: dict
    project_idea: str

@router.post("/agents/coach/assets")
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

@router.post("/agents/aura/engagement-kit")
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

@router.post("/agents/aura/collect-feedback")
async def collect_feedback(payload: FeedbackCollectionRequest, db: AsyncSession = Depends(get_db)):
    """Collects engagement metrics for a specific content piece."""
    from agents.feedback_collector import EngagementMetricsCollector
    collector = EngagementMetricsCollector(db)
    
    # For now, we'll just store the provided metrics
    # In a real implementation, this would fetch from actual social media APIs
    feedback_data = {
        "content_id": payload.content_id,
        "platform": payload.platform,
        "metrics": payload.metrics,
        "collected_at": "2026-03-18T10:30:00Z"  # This would be dynamic
    }
    
    # Store in agent memory for learning
    from agents.brain import store_memory
    await store_memory(
        db,
        agent_id="feedback_collector",
        topic=f"feedback-{payload.content_id}-{payload.platform}",
        content=feedback_data
    )
    
    return {"status": "success", "message": "Feedback collected successfully"}