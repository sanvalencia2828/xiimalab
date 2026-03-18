"""
Trend Forecaster Agent — Analyzes hackathon descriptions to predict trending technologies.
"""
import logging
from collections import Counter
from sqlalchemy.ext.asyncio import AsyncSession
from agents.orchestrator import Orchestrator
from models import Hackathon

log = logging.getLogger("xiima.trend_forecaster")

# Common technology terms to track
TECHNOLOGY_TERMS = {
    "zero knowledge": ["zk", "zero-knowledge", "zkp", "zk proofs"],
    "soroban": ["stellar", "soroban"],
    "blockchain": ["blockchain", "chain", "distributed ledger"],
    "ai": ["artificial intelligence", "machine learning", "deep learning", "neural network"],
    "web3": ["web3", "decentralized web", "dweb"],
    "defi": ["defi", "decentralized finance", "dex", "amm"],
    "nft": ["nft", "non-fungible token", "nfts"],
    "dao": ["dao", "decentralized autonomous organization"],
    "metaverse": ["metaverse", "virtual world"],
    "iot": ["iot", "internet of things", "sensor network"],
    "quantum": ["quantum computing", "quantum cryptography"],
    "ar/vr": ["augmented reality", "virtual reality", "ar", "vr", "xr"],
}

class TrendForecasterAgent:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.orchestrator = Orchestrator(db)

    async def analyze_trends(self):
        """Analyzes hackathon descriptions to identify emerging technology trends."""
        # Get recent hackathons
        hackathons = await self._get_recent_hackathons()

        # Extract and count technology terms
        term_counts = self._extract_technology_terms(hackathons)

        # Identify trending technologies
        trending_skills = self._identify_trending_skills(term_counts)

        # Emit signals for trending skills
        for skill, count in trending_skills:
            await self.orchestrator.emit_signal(
                source="trend_forecaster",
                signal_type="trending_skill_detected",
                payload={
                    "skill": skill,
                    "frequency": count,
                    "message": f"Trending skill detected: {skill} (mentioned {count} times in recent hackathons)"
                }
            )

        return trending_skills

    async def _get_recent_hackathons(self, limit: int = 50):
        """Fetches recent hackathons from the database."""
        # In a real implementation, you might want to filter by date
        # For now, we'll just get the most recent ones
        from sqlalchemy import select
        stmt = select(Hackathon).order_by(Hackathon.scraped_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    def _extract_technology_terms(self, hackathons):
        """Extracts and counts technology terms from hackathon descriptions."""
        term_counter = Counter()

        for hackathon in hackathons:
            # Combine title, tags, and description for analysis
            text = f"{hackathon.title} {' '.join(hackathon.tags)} {hackathon.ai_analysis or ''}".lower()

            # Count occurrences of each technology term
            for term, variants in TECHNOLOGY_TERMS.items():
                count = text.count(term)
                for variant in variants:
                    count += text.count(variant)
                if count > 0:
                    term_counter[term] += count

        return term_counter

    def _identify_trending_skills(self, term_counts, threshold: int = 5):
        """Identifies skills that are trending based on frequency."""
        # In a more sophisticated implementation, you might compare to historical data
        # For now, we'll just use a simple threshold
        trending = [(term, count) for term, count in term_counts.most_common() if count >= threshold]
        return trending