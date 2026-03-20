"""
Xiimalab API — FastAPI application entry point
"""
from contextlib import asynccontextmanager
import sys
import os
import asyncio

# Ensure local imports take precedence over absolute imports from engine/
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import engine, Base
from routes import hackathons, skills, analyze, staking, stream, hotmart_bridge, devfolio, aggregated, milestones
from routes.hackathons import router as hackathons_router
from routes.aggregated import router as aggregated_router
from routes.skills import router as skills_router
from routes.insights import router as insights_router
from routes.neuro import router as neuro_router
from routes.notifications import router as notifications_router
from routes.ml_recommendations import router as ml_router
from routes.portfolio import router as portfolio_router
from routes.market import router as market_router
from hotmart_bridge import router as hotmart_router
# from skill_validator import router as skill_validator_router  # [DISABLED] conflicto con engine/skill_validator.py - renombra a skill_validator_routes.py para arreglarlo
from integrations.aura_client import router as aura_router
from scrapers.hackathon_tracker import router as hackathon_tracker_router
from routes.agents import router as agents_router
# from routes.projects import router as projects_router  # [DISABLED] routes/projects.py no existe
from routes.profile import router as profile_router
# from routes.github import router as github_router  # [DISABLED] routes/github.py no existe aún


# ─────────────────────────────────────────────
# Startup / Shutdown lifecycle
# ─────────────────────────────────────────────

async def agent_background_runner():
    """Background loop to process agent signals automatically."""
    from db import SessionLocal
    from agents.notifier import NotifierAgent
    
    print("🤖 Agent Background Runner started.")
    while True:
        try:
            async with SessionLocal() as session:
                # The NotifierAgent checks pending signals (like golden_match) and notifies users
                notifier = NotifierAgent(session)
                await notifier.watch_signals()
        except Exception as e:
            print(f"⚠️ Agent Runner error: {e}")
        
        # Poll every 60 seconds
        await asyncio.sleep(60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # [SIMPLIFIED] Commented out DB initialization to prevent startup hang
    # if PostgreSQL is unavailable. Tables will be created on first request
    # or manually via alembic migrations.
    # try:
    #     async with engine.begin() as conn:
    #         await conn.run_sync(Base.metadata.create_all)
    # except Exception as e:
    #     print(f"⚠️ DB init failed (non-blocking): {e}")
    
    # Start the background runner
    runner_task = asyncio.create_task(agent_background_runner())
    
    print("✅ FastAPI lifespan: startup complete")
    yield
    print("🛑 FastAPI lifespan: shutdown")
    
    # Cancel the background runner
    runner_task.cancel()
    try:
        await runner_task
    except asyncio.CancelledError:
        pass
    # Dispose connection pool on shutdown
    try:
        await engine.dispose()
    except Exception as e:
        print(f"⚠️ Engine dispose failed: {e}")


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
app.include_router(hackathons_router, prefix="/hackathons", tags=["hackathons"])
app.include_router(devfolio.router, prefix="/hackathons/devfolio", tags=["devfolio"])
app.include_router(aggregated_router, prefix="/hackathons/aggregated", tags=["hackathons-aggregated"])
app.include_router(skills_router, prefix="/skills", tags=["skills"])
app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(staking.router, prefix="/staking", tags=["staking"])
app.include_router(milestones.router, prefix="/milestones", tags=["milestones"])
app.include_router(stream.router, prefix="/stream", tags=["realtime"])
app.include_router(hotmart_bridge.router, prefix="/hotmart", tags=["hotmart"])
# app.include_router(skill_validator_router)  # [DISABLED] conflicto con engine/skill_validator.py
app.include_router(aura_router)                 # GET /aura/progress/{address}, POST /aura/progress/{address}/force-sync
app.include_router(hackathon_tracker_router)    # GET /hackathon-tracker/applications/{address}
app.include_router(agents_router, prefix="/api/agents", tags=["agents"])
# app.include_router(projects_router, prefix="/api/projects", tags=["projects"])  # [DISABLED] routes/projects.py no existe
app.include_router(profile_router, prefix="/api", tags=["profile"])
# app.include_router(github_router, prefix="/api", tags=["github"])  # [DISABLED] routes/github.py no existe
app.include_router(insights_router, prefix="/insights", tags=["insights"])
app.include_router(neuro_router, prefix="/neuro", tags=["neuro"])
app.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
app.include_router(ml_router, prefix="/ml", tags=["ml-recommendations"])
app.include_router(portfolio_router, prefix="/portfolio", tags=["portfolio"])
app.include_router(market_router, prefix="/api/v1", tags=["market"])


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "xiimalab-api"}
