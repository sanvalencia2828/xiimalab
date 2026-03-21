"""
aura_engagement.py — Xiimalab
Agent specialized in scaling and reformatting content for social media engagement.
Integrates "RedimensionamientoAI" logic.
"""

import logging
from typing import Any, Dict, List, Optional
from integrations.openrouter_client import OpenRouterClient
from sqlalchemy.ext.asyncio import AsyncSession
from agents.brain import store_memory

logger = logging.getLogger("xiima.aura_agent")

class AuraEngagementAgent:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.client = OpenRouterClient()

    async def generate_engagement_kit(
        self,
        project_title: str,
        hackathon_title: str,
        project_idea: str,
        tech_stack: List[str]
    ) -> Dict[str, Any]:
        """
        Generates a multi-platform engagement kit using Redimensionamiento logic.
        Formats: X (Twitter), LinkedIn, Discord.
        Tones: Hype, Professional, Technical.
        """

        prompt = f"""
        Act as a Social Media Tech Growth Expert and Content Strategist.
        You are implementing the 'RedimensionamientoAI' logic to scale a project's visibility.

        Project: {project_title}
        Hackathon: {hackathon_title}
        Idea: {project_idea}
        Tech Stack: {', '.join(tech_stack)}

        Generate an 'Engagement Kit' with the following formats and tones:

        1. X (Twitter) - Tone: HYPE
           - Hooky, uses emojis, aggressive for growth.
        2. LinkedIn - Tone: PROFESSIONAL
           - Structured, focus on networking and problem-solving.
        3. Discord/Telegram - Tone: TECHNICAL/COMMUNITY
           - Dev-focused, focus on the build and collaboration.

        Return ONLY a valid JSON object with this structure:
        {{
            "x_post": "...",
            "linkedin_post": "...",
            "discord_message": "...",
            "metadata": {{
                "hashtags": ["...", "..."],
                "scaling_strategy": "..."
            }}
        }}
        """

        messages = [
            {"role": "system", "content": "You are an AI specialized in technical content marketing."},
            {"role": "user", "content": prompt}
        ]

        # Using DeepSeek-V3 via OpenRouter for cost-effective content scaling
        try:
            data = await self.client.complete_json(
                messages=messages,
                model="deepseek/deepseek-chat"
            )
        except json.JSONDecodeError as exc:
            logger.error("JSON parsing error in AuraEngagementAgent: %s", exc, exc_info=True)
            data = None
        except ValueError as exc:
            logger.error("Validation error in AuraEngagementAgent: %s", exc, exc_info=True)
            data = None
        except Exception as exc:
            logger.error("Unexpected error in AuraEngagementAgent: %s", exc, exc_info=True)
            data = None

        if not data:
            error_msg = "AI provider unavailable or returned invalid response"
            logger.error(f"AuraEngagementAgent failed to generate kit for project '{project_title}': {error_msg}")
            return {
                "x_post": "Error generando contenido. Por favor, inténtalo de nuevo más tarde.",
                "linkedin_post": "Error generando contenido. Por favor, inténtalo de nuevo más tarde.",
                "discord_message": "Error generando contenido. Por favor, inténtalo de nuevo más tarde.",
                "error": error_msg,
                "project_title": project_title,
                "timestamp": "2026-03-18"  # En una implementación real, usar datetime.utcnow().isoformat()
            }

        # Validate that we have the expected structure
        required_keys = ["x_post", "linkedin_post", "discord_message"]
        for key in required_keys:
            if key not in data:
                logger.warning(f"Missing key '{key}' in AI response for project '{project_title}'")
                data[key] = f"Contenido no generado correctamente para {key}"

        # Store in agent memory for future learning
        try:
            await store_memory(
                self.db,
                agent_id="aura",
                topic=f"engagement-kit-{project_title.lower().replace(' ', '-')}",
                content=data
            )
        except Exception as e:
            logger.warning(f"Failed to store memory for engagement kit: {e}")

        return data