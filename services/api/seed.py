"""
Seed script — populates the DB with the current stub data from page.tsx.
Run once after first `docker compose up`:
    docker compose exec api python seed.py
"""
import asyncio

from db import SessionLocal, engine, Base
from models import Hackathon, SkillDemand


HACKATHONS = [
    {"id": "h1", "title": "Stellar Build Challenge 2025", "prize_pool": 50000,
     "tags": ["Stellar", "DeFi", "Cross-chain"], "deadline": "2025-04-15", "match_score": 88,
     "source_url": "https://dorahacks.io"},
    {"id": "h2", "title": "Avalanche Summit Hackathon", "prize_pool": 75000,
     "tags": ["Avalanche", "NFT", "Smart Contracts"], "deadline": "2025-05-02", "match_score": 74,
     "source_url": "https://dorahacks.io"},
    {"id": "h3", "title": "AI x Web3 Global Sprint", "prize_pool": 30000,
     "tags": ["AI", "Web3", "Python", "Blockchain"], "deadline": "2025-04-28", "match_score": 95,
     "source_url": "https://dorahacks.io"},
    {"id": "h4", "title": "DoraHacks Open Track Q2", "prize_pool": 100000,
     "tags": ["Open Track", "Innovation", "AI"], "deadline": "2025-06-10", "match_score": 81,
     "source_url": "https://dorahacks.io"},
]

SKILLS = [
    {"label": "Data Analytics", "sublabel": "NODO-EAFIT", "user_score": 82,
     "market_demand": 90, "color": "#7dd3fc"},
    {"label": "Docker & DevOps", "sublabel": "Containerización", "user_score": 75,
     "market_demand": 85, "color": "#38bdf8"},
    {"label": "Blockchain", "sublabel": "Stellar · Avalanche", "user_score": 68,
     "market_demand": 78, "color": "#f59e0b"},
    {"label": "AI / ML", "sublabel": "Python · Modelos", "user_score": 70,
     "market_demand": 95, "color": "#a78bfa"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        # Hackathons
        for data in HACKATHONS:
            existing = await session.get(Hackathon, data["id"])
            if not existing:
                session.add(Hackathon(**data))

        # Skills
        for data in SKILLS:
            from sqlalchemy import select
            result = await session.execute(
                select(SkillDemand).where(SkillDemand.label == data["label"])
            )
            if not result.scalar_one_or_none():
                session.add(SkillDemand(**data))

        await session.commit()
        print("✅ Seed complete — hackathons and skills loaded.")


if __name__ == "__main__":
    asyncio.run(seed())
