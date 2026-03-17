"""
services/api/routes/agents.py
Registra el router del Agent Crew en FastAPI.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parents[3] / "engine"))

from fastapi import APIRouter

try:
    from agent_crew import create_router as _crew_router
    _base: APIRouter = _crew_router()
except Exception as exc:
    import logging
    logging.getLogger("xiima.agents").error(f"No se pudo cargar agent_crew: {exc}")
    _base = APIRouter()

import asyncpg, os as _os

agents_router = _base

@agents_router.get("/matches")
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
