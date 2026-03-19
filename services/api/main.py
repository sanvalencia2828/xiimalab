"""
Xiimalab API — FastAPI application entry point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import engine, Base
from routes import hackathons, skills, analyze, staking, stream, hotmart_bridge
from routes.insights import router as insights_router
from routes.neuro import router as neuro_router
from hotmart_bridge import router as hotmart_router
from skill_validator import router as skill_validator_router
from integrations.aura_client import router as aura_router
from scrapers.hackathon_tracker import router as hackathon_tracker_router
from routes.agents import router as agents_router
from routes.projects import router as projects_router
from routes.profile import router as profile_router
from routes.github import router as github_router


# ─────────────────────────────────────────────
# Startup / Shutdown lifecycle
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Dispose connection pool on shutdown
    await engine.dispose()


# ─────────────────────────────────────────────
# App instance
# ─────────────────────────────────────────────
app = FastAPI(
    title="Xiimalab API",
    description="Intelligence backend for hackathon scraping, skill analytics, and AURA metrics.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js dev and prod origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://frontend:3000",
        "https://xiimalab.vercel.app",  # update with your domain
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────
app.include_router(hackathons.router, prefix="/hackathons", tags=["hackathons"])
app.include_router(skills.router, prefix="/skills", tags=["skills"])
app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(staking.router, prefix="/staking", tags=["staking"])
app.include_router(stream.router, prefix="/stream", tags=["realtime"])
app.include_router(hotmart_bridge.router, prefix="/hotmart", tags=["hotmart"])
app.include_router(skill_validator_router)      # GET/POST /skills/escrow, /skills/progress
app.include_router(aura_router)                 # GET /aura/progress/{address}, POST /aura/progress/{address}/force-sync
app.include_router(hackathon_tracker_router)    # GET /hackathon-tracker/applications/{address}
app.include_router(agents_router, prefix="/api/agents", tags=["agents"])
app.include_router(projects_router, prefix="/api/projects", tags=["projects"])
app.include_router(profile_router, prefix="/api", tags=["profile"])
app.include_router(github_router, prefix="/api", tags=["github"])
app.include_router(insights_router, prefix="/insights", tags=["insights"])
app.include_router(neuro_router, prefix="/neuro", tags=["neuro"])


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "xiimalab-api"}
