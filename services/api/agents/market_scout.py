"""
market_scout.py — Xiimalab
Agent specialized in scanning market trends and updating the database.
"""

import logging
import json
import uuid
from typing import Any, Dict, List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from integrations.openrouter_client import OpenRouterClient
from models import MarketTrend

logger = logging.getLogger("xiima.market_scout")

class MarketScoutAgent:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.client = OpenRouterClient()

    async def scan_market(self) -> List[Dict[str, Any]]:
        """
        Uses an LLM to dynamically fetch the current market trends.
        In a full implementation, this would aggregate data from RapidAPI,
        LinkedIn jobs APIs, or RemoteOK before sending it to the LLM to parse.
        For now, we use the LLM's own knowledge augmented to simulate the "project of the day" logic.
        """
        prompt = f"""
        Act as a Global Tech Market Analyst in {datetime.now(timezone.utc).strftime("%B %Y")}.
        Analyze the current tech job market, hacking trends, and freelance demands.
        
        Return a JSON array of exactly 6 top trending roles/skills right now.
        For each, include:
        - "role_name": Name of the role or skill (e.g., "AI Engineer", "Rust Developer", "Data Analytics")
        - "demand_score": Integer from 1 to 100 representing market heat.
        - "growth_percentage": String representing Month-over-Month growth (e.g., "+15%", "+8%").
        - "category": String category like "tech", "design", "management".
        - "top_projects_keywords": Array of 3 short keyword strings defining what people are building.

        Return ONLY a raw, valid JSON array. Do not wrap in markdown or anything else.
        Example: [{{ "role_name": "Rust Developer", "demand_score": 85, "growth_percentage": "+12%", "category": "tech", "top_projects_keywords": ["Solana", "Systems", "Wasm"] }}]
        """

        messages = [
            {"role": "system", "content": "You are a specialized tech market trends analyzer."},
            {"role": "user", "content": prompt}
        ]

        logger.info("MarketScoutAgent: Fetching new market trends...")
        try:
            # We use deepseek-chat or auto for cost-effective JSON generation
            data = await self.client.complete_json(
                messages=messages,
                model="deepseek/deepseek-chat"
            )
            
            if not data or not isinstance(data, list):
                logger.error("MarketScoutAgent received invalid data format from LLM.")
                return []
                
            return data
        except Exception as e:
            logger.error(f"Error fetching market trends from LLM: {str(e)}")
            return []

    async def update_trends_in_db(self, trends: List[Dict[str, Any]]) -> bool:
        """
        Takes the fetched trends and upserts them into the market_trends table.
        """
        if not trends:
            return False

        try:
            # Simple approach: since we want to overwrite the old top list, 
            # we can either truncate and insert, or update existing based on role_name.
            # We'll do an upsert or just clear and insert to keep it clean for the top list.
            
            from sqlalchemy import text
            await self.db.execute(text("TRUNCATE TABLE market_trends"))
            
            for item in trends:
                new_trend = MarketTrend(
                    id=str(uuid.uuid4()),
                    role_name=item.get("role_name", "Unknown"),
                    demand_score=item.get("demand_score", 50),
                    growth_percentage=item.get("growth_percentage", "+0%"),
                    category=item.get("category", "tech"),
                    top_projects_keywords=item.get("top_projects_keywords", [])
                )
                self.db.add(new_trend)
                
            await self.db.commit()
            logger.info(f"MarketScoutAgent: Successfully updated {len(trends)} market trends in DB.")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"MarketScoutAgent: Error updating database: {str(e)}")
            return False

    async def execute_sync(self) -> List[Dict[str, Any]]:
        """Main orchestrator function for the agent to be called from the endpoint."""
        trends = await self.scan_market()
        if trends:
            await self.update_trends_in_db(trends)
        return trends
