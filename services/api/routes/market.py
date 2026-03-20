from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any

from db import get_db
from models import MarketTrend
from agents.market_scout import MarketScoutAgent
import logging

logger = logging.getLogger("xiima.market_router")

router = APIRouter(
    prefix="/market",
    tags=["Market Trends"]
)

@router.get("/trends")
async def get_market_trends(db: AsyncSession = Depends(get_db)):
    """
    Fetch the latest market trends from Supabase.
    """
    try:
        query = select(MarketTrend).order_by(MarketTrend.demand_score.desc()).limit(10)
        result = await db.execute(query)
        trends = result.scalars().all()
        
        return {
            "success": True,
            "trends": [
                {
                    "id": t.id,
                    "role_name": t.role_name,
                    "demand_score": t.demand_score,
                    "growth_percentage": t.growth_percentage,
                    "category": t.category,
                    "top_projects_keywords": t.top_projects_keywords,
                    "last_updated": t.last_updated
                } for t in trends
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching market trends: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/sync")
async def sync_market_trends(background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """
    Triggers the MarketScoutAgent to fetch new market trends using the LLM
    and writes them to the database. We run it in the background to avoid timeout.
    """
    
    async def run_scout(_db: AsyncSession):
        agent = MarketScoutAgent(_db)
        await agent.execute_sync()
        
    background_tasks.add_task(run_scout, db)
    
    return {
        "success": True,
        "message": "Market trends synchronization started in the background."
    }
