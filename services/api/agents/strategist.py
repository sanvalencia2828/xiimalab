"""
Strategist Agent — Analyzes opportunities and emits signals for high-match prospects.
Consumes AURA engagement kits from agent_knowledge for feedback loop.
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from agents.orchestrator import Orchestrator
from agents.brain import update_relevance_score, recall_memory
from ai_engine import analyze_competitiveness

log = logging.getLogger("xiima.strategist_agent")

class StrategistAgent:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.orchestrator = Orchestrator(db)

    async def _get_aura_context(self, project_title: str) -> dict:
        """Retrieves AURA engagement kit context from agent knowledge for better analysis."""
        topic = f"engagement-kit-{project_title.lower().replace(' ', '-')}"
        memories = await recall_memory(self.db, topic, min_relevance=0.7)
        if memories:
            latest = memories[0]
            return {
                "previous_strategy": latest.content.get("metadata", {}).get("scaling_strategy"),
                "platforms_used": list(latest.content.keys()) if latest.content else []
            }
        return {}

    async def analyze_opportunity(self, opportunity_data: dict, user_accepted: bool = False):
        """Analyzes a hackathon/project opportunity and emits signals based on match score."""
        
        # Enrich with AURA context if project title available
        aura_context = {}
        if opportunity_data.get("project_title"):
            aura_context = await self._get_aura_context(opportunity_data["project_title"])
        
        # Run AI analysis
        result = await analyze_competitiveness(opportunity_data, aura_context)

        # Update relevance score in agent knowledge for learning if user accepted
        if user_accepted:
            topic = f"hackathon-{opportunity_data.get('id')}"
            # Increase relevance score for accepted opportunities
            new_score = min(result["match_score"] / 100.0 + 0.1, 1.0)  # Normalize and add bonus
            await update_relevance_score(self.db, topic, new_score)

        # Emit signal for high-value opportunities
        if result["match_score"] > 90:
            await self.orchestrator.emit_signal(
                source="strategist",
                signal_type="golden_opportunity_detected",
                payload={
                    "opportunity_id": opportunity_data.get("id"),
                    "match_score": result["match_score"],
                    "strategic_category": result["strategic_category"]
                }
            )

        # Always emit analysis complete signal
        await self.orchestrator.emit_signal(
            source="strategist",
            signal_type="analysis_complete",
            payload={
                "opportunity_id": opportunity_data.get("id"),
                "match_score": result["match_score"],
                "strategic_category": result["strategic_category"],
                "missing_skills": result["missing_skills"]
            }
        )

        return result