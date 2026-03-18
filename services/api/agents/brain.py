"""
Agent Brain — Shared Knowledge Base and memory management.
"""
import logging
from typing import Any
from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from models import AgentKnowledge

log = logging.getLogger("xiima.agent_brain")

async def store_memory(db: AsyncSession, agent_id: str, topic: str, content: dict, relevance: float = 1.0):
    """Saves agent experience or data to the shared knowledge base."""
    memory = AgentKnowledge(
        agent_id=agent_id,
        topic=topic,
        content=content,
        relevance_score=relevance
    )
    db.add(memory)
    await db.commit()
    log.info(f"Agent {agent_id} stored memory on topic: {topic}")

async def recall_memory(db: AsyncSession, topic: str, min_relevance: float = 0.5):
    """Retrieves relevant past experiences for a given topic."""
    stmt = select(AgentKnowledge).where(
        AgentKnowledge.topic.ilike(f"%{topic}%"),
        AgentKnowledge.relevance_score >= min_relevance
    ).order_by(AgentKnowledge.created_at.desc())

    result = await db.execute(stmt)
    return result.scalars().all()

async def update_relevance_score(db: AsyncSession, topic: str, new_score: float):
    """Updates the relevance score for a specific topic in agent knowledge."""
    stmt = update(AgentKnowledge).where(
        AgentKnowledge.topic == topic
    ).values(relevance_score=new_score)

    await db.execute(stmt)
    await db.commit()
    log.info(f"Updated relevance score for topic '{topic}' to {new_score}")
