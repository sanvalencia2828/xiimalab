"""
services/api/routes/agents.py
Registra el router del Agent Crew en FastAPI.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parents[3] / "engine"))

from fastapi import APIRouter

try:
    from agent_crew import create_router as _crew_router
    agents_router: APIRouter = _crew_router()
except Exception as exc:
    import logging
    logging.getLogger("xiima.agents").error(f"No se pudo cargar agent_crew: {exc}")
    agents_router = APIRouter()
