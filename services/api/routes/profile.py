"""
Profile router — GET /profile/knowledge-map
Visualizes the user's "Knowledge Map" based on agent_knowledge.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db import get_db
from models import AgentKnowledge
from typing import List

router = APIRouter(prefix="/profile", tags=["profile"])

@router.get("/knowledge-map")
async def get_knowledge_map(
    db: AsyncSession = Depends(get_db),
    limit: int = 20
):
    """
    Returns the user's knowledge map based on agent observations.
    Shows strongest skills inferred from hackathon interactions.
    """
    # Get all knowledge entries related to user skills/competencies
    stmt = select(AgentKnowledge).where(
        (AgentKnowledge.topic.like("skill-%")) |
        (AgentKnowledge.topic.like("roadmap-%")) |
        (AgentKnowledge.topic.like("hackathon-%"))
    ).order_by(AgentKnowledge.relevance_score.desc()).limit(limit)

    result = await db.execute(stmt)
    knowledge_entries = result.scalars().all()

    # Process entries to build a skill strength map
    skill_strengths = {}
    for entry in knowledge_entries:
        topic = entry.topic
        content = entry.content or {}
        relevance = entry.relevance_score

        # Extract skills from roadmap entries
        if topic.startswith("roadmap-"):
            steps = content.get("steps", [])
            for step in steps:
                # This is a simplified example - in reality, you'd have more sophisticated NLP
                desc = step.get("description", "").lower()
                if "blockchain" in desc:
                    skill_strengths["Blockchain"] = skill_strengths.get("Blockchain", 0) + relevance
                if "ai" in desc or "machine learning" in desc:
                    skill_strengths["AI/ML"] = skill_strengths.get("AI/ML", 0) + relevance
                if "web3" in desc:
                    skill_strengths["Web3"] = skill_strengths.get("Web3", 0) + relevance

        # Extract directly from skill-related topics
        elif topic.startswith("skill-"):
            skill_name = topic.replace("skill-", "")
            skill_strengths[skill_name] = skill_strengths.get(skill_name, 0) + relevance

    # Convert to sorted list
    sorted_skills = sorted(skill_strengths.items(), key=lambda x: x[1], reverse=True)

    return {
        "knowledge_map": [
            {"skill": skill, "strength": round(strength, 2)}
            for skill, strength in sorted_skills
        ]
    }