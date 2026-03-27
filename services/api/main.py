"""
Xiimalab API — FastAPI application entry point
"""
from contextlib import asynccontextmanager
import sys
import os
import asyncio
import logging

# Ensure local imports take precedence over absolute imports from engine/
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from db import engine, Base, SessionLocal
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
from routes.learning_resources import router as learning_router
from routes.match import router as match_router
from hotmart_bridge import router as hotmart_router
# from skill_validator import router as skill_validator_router  # [DISABLED] conflicto con engine/skill_validator.py - renombra a skill_validator_routes.py para arreglarlo
from integrations.aura_client import router as aura_router
from scrapers.hackathon_tracker import router as hackathon_tracker_router
from routes.agents import router as agents_router
# from routes.projects import router as projects_router  # [DISABLED] routes/projects.py no existe
from routes.profile import router as profile_router
# from routes.github import router as github_router  # [DISABLED] routes/github.py no existe aún

log = logging.getLogger("xiima.main")

# APScheduler for background tasks
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.interval import IntervalTrigger
    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False
    log.warning("APScheduler not available, scheduled tasks disabled")

scheduler = AsyncIOScheduler() if SCHEDULER_AVAILABLE else None


async def scheduled_dorahacks_sync():
    """Background task: sync DoraHacks every 6 hours."""
    from services.sync_dorahacks import sync_dorahacks
    
    log.info("[Scheduler] Starting scheduled DoraHacks sync...")
    try:
        async with SessionLocal() as session:
            result = await sync_dorahacks(session)
            await session.commit()
            log.info(f"[Scheduler] DoraHacks sync complete: {result}")
    except Exception as exc:
        log.error(f"[Scheduler] DoraHacks sync failed: {exc}")


def setup_scheduler():
    """Configure APScheduler for periodic tasks."""
    if not SCHEDULER_AVAILABLE or scheduler is None:
        return
    
    scheduler.add_job(
        scheduled_dorahacks_sync,
        trigger=IntervalTrigger(hours=6),
        id="dorahacks_sync",
        name="DoraHacks Hackathon Sync",
        replace_existing=True,
    )
    log.info("[Scheduler] DoraHacks sync scheduled every 6 hours")


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
        except asyncio.CancelledError:
            print("🛑 Agent runner cancelled")
            break
        except RuntimeError as exc:
            print(f"⚠️ Agent Runner runtime error: {exc}")
        except Exception as exc:
            print(f"⚠️ Agent Runner unexpected error: {exc}")
        
        # Poll every 60 seconds
        await asyncio.sleep(60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start APScheduler for background tasks
    if scheduler is not None:
        setup_scheduler()
        scheduler.start()
        log.info("[Scheduler] APScheduler started")
    
    # Start the background runner
    runner_task = asyncio.create_task(agent_background_runner())
    
    print("✅ FastAPI lifespan: startup complete")
    yield
    print("🛑 FastAPI lifespan: shutdown")
    
    # Shutdown APScheduler
    if scheduler is not None and scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("[Scheduler] APScheduler shutdown")
    
    # Cancel the background runner
    runner_task.cancel()
    try:
        await runner_task
    except asyncio.CancelledError:
        pass
    # Dispose connection pool on shutdown
    try:
        await engine.dispose()
    except RuntimeError as exc:
        print(f"⚠️ Engine dispose failed (runtime): {exc}")
    except Exception as exc:
        print(f"⚠️ Engine dispose failed: {exc}")


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
app.include_router(learning_router, prefix="/learning", tags=["learning"])
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
app.include_router(match_router,  prefix="/api/v1", tags=["AI Matchmaker"])


# ─────────────────────────────────────────────
# Health check con verificación real
# ─────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check():
    """
    Health check ligero que verifica que el servicio está respondiendo.
    GET /health → { status, service, timestamp, services }
    """
    from datetime import datetime
    import asyncio
    
    services = {
        "api": "online",
        "database": "unknown",
    }
    
    try:
        async def check_db():
            try:
                from db import engine
                async with engine.connect() as conn:
                    await conn.execute("SELECT 1")
                return "online"
            except Exception:
                return "offline"
        
        db_task = asyncio.create_task(check_db())
        db_status = await asyncio.wait_for(db_task, timeout=3.0)
        services["database"] = db_status
    except asyncio.TimeoutError:
        services["database"] = "timeout"
    except Exception:
        services["database"] = "offline"
    
    overall = "healthy" if services["api"] == "online" else "degraded"
    if services["database"] == "offline":
        overall = "degraded"
    
    return {
        "status": overall,
        "service": "xiimalab-api",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "services": services,
    }


@app.get("/health/live", tags=["system"])
async def liveness_probe():
    """
    Liveness probe para Kubernetes/load balancers.
    Solo verifica que el proceso está respondiendo.
    """
    return {"status": "alive"}


@app.get("/health/ready", tags=["system"])
async def readiness_probe():
    """
    Readiness probe - verifica que el servicio puede recibir tráfico.
    """
    from datetime import datetime
    
    try:
        async def check_db():
            try:
                from db import engine
                async with engine.connect() as conn:
                    await conn.execute("SELECT 1")
                return True
            except Exception:
                return False
        
        db_ready = await asyncio.wait_for(check_db(), timeout=3.0)
        return {
            "status": "ready" if db_ready else "not_ready",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    except asyncio.TimeoutError:
        return {"status": "not_ready", "reason": "database_timeout"}
    except Exception:
        return {"status": "not_ready", "reason": "internal_error"}


@app.get("/api/health", tags=["system"], include_in_schema=False)
async def api_health():
    """
    Health check simple para el frontend.
    GET /api/health → {"status": "ok"}
    """
    return {"status": "ok"}


# ─────────────────────────────────────────────
# Admin endpoints
# ─────────────────────────────────────────────
@app.post("/api/v1/admin/sync-dorahacks", tags=["admin"])
async def admin_sync_dorahacks():
    """
    Manually trigger DoraHacks sync.
    POST /api/v1/admin/sync-dorahacks
    """
    from datetime import datetime
    from db import SessionLocal
    from services.sync_dorahacks import sync_dorahacks
    
    start_time = datetime.now()
    log.info("[Admin] Manual DoraHacks sync triggered")
    
    try:
        async with SessionLocal() as session:
            result = await sync_dorahacks(session)
            await session.commit()
            return {
                "success": True,
                "message": "DoraHacks sync completed",
                "result": result,
                "elapsed_seconds": (datetime.now() - start_time).total_seconds(),
            }
    except Exception as exc:
        log.error(f"[Admin] DoraHacks sync failed: {exc}")
        return {
            "success": False,
            "message": f"Sync failed: {str(exc)}",
            "elapsed_seconds": (datetime.now() - start_time).total_seconds(),
        }
