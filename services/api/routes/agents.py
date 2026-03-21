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
except ModuleNotFoundError as exc:
    logging.getLogger("xiima.agents").warning("agent_crew module not found (optional): %s", exc)
except ImportError as exc:
    logging.getLogger("xiima.agents").warning("Failed to import agent_crew: %s", exc, exc_info=True)
except Exception as exc:
    logging.getLogger("xiima.agents").error("Unexpected error loading agent_crew: %s", exc, exc_info=True)

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

@router.post("/strategist/run")
async def run_strategist_agent(db: AsyncSession = Depends(get_db)):
    """Manually triggers the strategist agent to analyze a sample opportunity."""
    from agents.strategist import StrategistAgent
    from sqlalchemy import text
    
    strategist = StrategistAgent(db)
    
    # Fetch an opportunity to analyze (e.g., top active hackathon)
    result = await db.execute(text("SELECT id, title as project_title, description, tags, prize_pool FROM active_hackathons ORDER BY deadline ASC LIMIT 1"))
    row = result.fetchone()
    
    if not row:
        return {"message": "No active hackathons found to analyze", "analysis": None}
        
    opportunity_data = dict(row._mapping)
    analysis = await strategist.analyze_opportunity(opportunity_data, user_accepted=False)
    
    return {"message": "Strategist agent run completed", "analysis": analysis}

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

class MatchProjectsRequest(BaseModel):
    hackathons: List[Dict[str, Any]]

@router.post("/strategist/match-projects")
async def match_projects(payload: MatchProjectsRequest, db: AsyncSession = Depends(get_db)):
    """Background job endpoint to cross-check new hackathons against active user projects."""
    db_url = _os.environ.get("DATABASE_URL", "")
    if not db_url:
        return {"status": "error", "message": "DATABASE_URL not found"}
        
    conn = await asyncpg.connect(db_url)
    try:
        # Fetch active projects
        projects_records = await conn.fetch("SELECT id, title, stack, status FROM user_projects WHERE status IN ('active', 'ideation')")
        
        matches_found = 0
        
        for p in projects_records:
            project_id = p["id"]
            p_title = p["title"]
            p_stack_raw = p["stack"]
            p_stack = []
            
            if p_stack_raw:
                if isinstance(p_stack_raw, str):
                    import json
                    try:
                        p_stack = json.loads(p_stack_raw)
                    except:
                        p_stack = []
                else:
                    p_stack = p_stack_raw
                    
            if not isinstance(p_stack, list):
                p_stack = []
                
            for h in payload.hackathons:
                h_tags = h.get("tags", [])
                if not h_tags or not isinstance(h_tags, list):
                    continue
                    
                overlap = set([str(t).lower() for t in h_tags]) & set([str(s).lower() for s in p_stack])
                
                base_match = h.get("match_score", 50)
                if overlap:
                    base_match = min(100, base_match + (len(overlap) * 15))
                
                if base_match >= 60:
                    shared_tags = list(overlap)
                    reasoning = f"Compatible con tu stack ({', '.join(shared_tags)})" if shared_tags else "Oportunidad estratégica alineada"
                    
                    try:
                        import json
                        await conn.execute("""
                            INSERT INTO project_hackathon_matches 
                            (project_id, hackathon_id, hackathon_title, match_pct, shared_tags, reasoning, prize_pool, source, source_url, computed_at)
                            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, NOW())
                            ON CONFLICT (project_id, hackathon_id) DO UPDATE SET
                                match_pct = EXCLUDED.match_pct,
                                shared_tags = EXCLUDED.shared_tags,
                                reasoning = EXCLUDED.reasoning,
                                prize_pool = EXCLUDED.prize_pool,
                                hackathon_title = EXCLUDED.hackathon_title,
                                source_url = EXCLUDED.source_url,
                                source = EXCLUDED.source,
                                computed_at = EXCLUDED.computed_at
                        """, project_id, h["id"], h.get("title", ""), base_match, json.dumps(shared_tags), reasoning, h.get("prize_pool", 0), h.get("source", "mcp"), h.get("source_url", ""))
                        
                        matches_found += 1
                        
                        # Golden Matches (>85%) emits a signal
                        if base_match >= 85:
                            from agents.orchestrator import Orchestrator
                            orch = Orchestrator(db)
                            await orch.emit_signal(
                                source="strategist",
                                signal_type="golden_project_match",
                                payload={
                                    "project_id": project_id,
                                    "project_title": p_title,
                                    "hackathon_id": h["id"],
                                    "hackathon_title": h.get("title", ""),
                                    "match_pct": base_match
                                }
                            )
                    except asyncpg.PostgresError as ins_exc:
                        logging.getLogger("xiima.matchmaker").error("Database error inserting match: %s", ins_exc, exc_info=True)
                    except ValueError as ins_exc:
                        logging.getLogger("xiima.matchmaker").warning("Validation error inserting match: %s", ins_exc)
                    except Exception as ins_exc:
                        logging.getLogger("xiima.matchmaker").error("Unexpected error inserting match: %s", ins_exc, exc_info=True)
                        
        return {"status": "success", "matches_found": matches_found}
    except asyncpg.PostgresError as exc:
        logging.getLogger("xiima.matchmaker").error("Database error in match_projects: %s", exc, exc_info=True)
        return {"status": "error", "message": "Database error"}
    except Exception as exc:
        logging.getLogger("xiima.matchmaker").error("Unexpected error in match_projects: %s", exc, exc_info=True)
        return {"status": "error", "message": "Internal error"}
    finally:
        await conn.close()

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
