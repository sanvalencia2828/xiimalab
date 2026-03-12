"""
Xiimalab API — FastAPI application entry point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import engine, Base
from routes import hackathons, skills, analyze, staking


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


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "xiimalab-api"}
