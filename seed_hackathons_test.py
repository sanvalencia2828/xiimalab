#!/usr/bin/env python3
"""
seed_hackathons_test.py — Semilla de hackathones de prueba para testing
Inserta hackathones de ejemplo para verificar que la API funciona
"""
import asyncio
import json
import os
from datetime import datetime, timezone, timedelta
import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:xiima_pass@localhost:5433/xiimalab"
)

# Conversión para asyncpg (sin asyncpg en la URL)
DB_URL_ASYNCPG = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

async def seed_test_hackathons():
    """Inserta hackathones de prueba."""
    print("🌱 Sembrando hackathones de prueba...\n")
    
    try:
        conn = await asyncpg.connect(DB_URL_ASYNCPG)
        
        # Hackathones de prueba
        now = datetime.now(timezone.utc)
        test_hackathons = [
            {
                "id": "test-ai-2025-v1",
                "title": "AI Innovation Hackathon 2025",
                "prize_pool": 100000,
                "tags": ["AI", "Python", "ML", "Analytics"],
                "deadline": (now + timedelta(days=30)).isoformat(),
                "match_score": 85,
                "source": "dorahacks",
                "source_url": "https://dorahacks.io/hackathon/ai-2025",
                "tech_stack": ["Python", "TensorFlow", "PyTorch"],
                "difficulty": "intermediate",
                "organizer": "Xiimalab",
                "city": "San Francisco",
                "event_type": "virtual",
            },
            {
                "id": "test-web3-2025-v1",
                "title": "Web3 Builders Hackathon",
                "prize_pool": 250000,
                "tags": ["Blockchain", "Solidity", "Web3", "DeFi"],
                "deadline": (now + timedelta(days=45)).isoformat(),
                "match_score": 72,
                "source": "dorahacks",
                "source_url": "https://dorahacks.io/hackathon/web3-2025",
                "tech_stack": ["Solidity", "JavaScript", "React"],
                "difficulty": "advanced",
                "organizer": "Web3 Foundation",
                "city": "Remote",
                "event_type": "hybrid",
            },
            {
                "id": "test-fullstack-2025-v1",
                "title": "Full Stack Developer Challenge",
                "prize_pool": 75000,
                "tags": ["JavaScript", "React", "Node.js", "Full-Stack"],
                "deadline": (now + timedelta(days=20)).isoformat(),
                "match_score": 94,
                "source": "devpost",
                "source_url": "https://devpost.com/software/fullstack-2025",
                "tech_stack": ["React", "Node.js", "PostgreSQL"],
                "difficulty": "beginner",
                "organizer": "Dev Community",
                "city": "New York",
                "event_type": "in-person",
            },
        ]
        
        for h in test_hackathons:
            try:
                await conn.execute(
                    """
                    INSERT INTO hackathons (
                        id, title, prize_pool, tags, deadline, match_score,
                        source, source_url, tech_stack, difficulty, organizer,
                        city, event_type
                    ) VALUES (
                        $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        prize_pool = EXCLUDED.prize_pool,
                        tags = EXCLUDED.tags,
                        deadline = EXCLUDED.deadline,
                        updated_at = NOW()
                    """,
                    h["id"],
                    h["title"],
                    h["prize_pool"],
                    json.dumps(h["tags"]),
                    h["deadline"],
                    h["match_score"],
                    h["source"],
                    h["source_url"],
                    json.dumps(h["tech_stack"]),
                    h["difficulty"],
                    h["organizer"],
                    h["city"],
                    h["event_type"],
                )
                print(f"✅ {h['title']}")
            except Exception as e:
                print(f"❌ {h['title']}: {e}")
        
        print(f"\n✅ {len(test_hackathons)} hackathones sembrados")
        await conn.close()
        
    except Exception as e:
        print(f"❌ Error al sembrar: {e}")
        return False
    
    return True


if __name__ == "__main__":
    success = asyncio.run(seed_test_hackathons())
    exit(0 if success else 1)
