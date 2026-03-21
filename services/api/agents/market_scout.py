"""
market_scout.py — Xiimalab
Agent specialized in scanning market trends and updating the database.
"""

import logging
import json
import uuid
import base64
import os
from typing import Any, Dict, List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from integrations.openrouter_client import OpenRouterClient
from models import MarketTrend

logger = logging.getLogger("xiima.market_scout")

IMAGE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "Xiima transparente.png"
)

class MarketScoutAgent:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.client = OpenRouterClient()

    def _load_image_base64(self) -> str | None:
        """Load Xiima logo as base64 for vision model."""
        try:
            if os.path.exists(IMAGE_PATH):
                with open(IMAGE_PATH, "rb") as f:
                    return base64.b64encode(f.read()).decode("utf-8")
            logger.warning(f"Image not found: {IMAGE_PATH}")
            return None
        except Exception as e:
            logger.error(f"Error loading image: {e}")
            return None

    async def scan_market(self) -> List[Dict[str, Any]]:
        """
        Uses GPT-4o Vision to analyze the Xiima logo and fetch market trends.
        Sends the logo image + prompt for a personalized analysis.
        """
        image_b64 = self._load_image_base64()
        
        system_msg = {
            "role": "system",
            "content": "You are a specialized tech market trends analyst with expertise in hackathons and AI/blockchain trends."
        }
        
        if image_b64:
            user_msg = {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_b64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": f"""Analyze the Xiima logo and the current tech market in {datetime.now(timezone.utc).strftime("%B %Y")}.
                        
Based on Xiima's focus (AI, Blockchain, Hackathons, Developer Education), return a JSON array of exactly 6 top trending tech roles/skills relevant to their platform.

For each, include:
- "role_name": Name of the role or skill (e.g., "AI Engineer", "Rust Developer", "Data Analytics")
- "demand_score": Integer from 1 to 100 representing market heat.
- "growth_percentage": String representing Month-over-Month growth (e.g., "+15%", "+8%").
- "category": String category like "tech", "design", "management".
- "top_projects_keywords": Array of 3 short keyword strings defining what people are building.

Return ONLY a raw, valid JSON array. Example: [{{ "role_name": "Rust Developer", "demand_score": 85, "growth_percentage": "+12%", "category": "tech", "top_projects_keywords": ["Solana", "Systems", "Wasm"] }}]"""
                    }
                ]
            }
        else:
            user_msg = {
                "role": "user", 
                "content": f"""Act as a Global Tech Market Analyst in {datetime.now(timezone.utc).strftime("%B %Y")}.
Analyze the current tech job market, hacking trends, and freelance demands relevant to AI, Blockchain, and hackathons.

Return a JSON array of exactly 6 top trending roles/skills right now.
For each, include:
- "role_name": Name of the role or skill
- "demand_score": Integer from 1 to 100 representing market heat.
- "growth_percentage": String representing Month-over-Month growth (e.g., "+15%", "+8%").
- "category": String category like "tech", "design", "management".
- "top_projects_keywords": Array of 3 short keyword strings defining what people are building.

Return ONLY a raw, valid JSON array. Example: [{{ "role_name": "Rust Developer", "demand_score": 85, "growth_percentage": "+12%", "category": "tech", "top_projects_keywords": ["Solana", "Systems", "Wasm"] }}]"""
            }

        messages = [system_msg, user_msg]

        logger.info("MarketScoutAgent: Fetching market trends with vision...")
        try:
            data = await self.client.complete_json(
                messages=messages,
                model="openai/gpt-4o"  # Vision-capable model
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
