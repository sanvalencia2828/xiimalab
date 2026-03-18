"""
Coach Agent — Generates personalized career roadmaps based on strategic insights and user data.
Also creates professional README and elevator pitch for hackathon submissions.
"""
import json
import logging
from typing import Any
import anthropic
import os
from sqlalchemy.ext.asyncio import AsyncSession
from agents.brain import store_memory
from integrations.aura_client import sync_student_aura_progress

log = logging.getLogger("xiima.coach_agent")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

from integrations.soroban_oracle import soroban_oracle

class CoachAgent:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    async def generate_roadmap(self, hackathon_title: str, strategic_insight: str, missing_skills: list[str], student_address: str = None) -> dict:
        """Creates a step-by-step roadmap and generates a verifiable mastery proof on Stellar."""
        # Get user's AURA engagement metrics if student_address is provided
        aura_summary = None
        if student_address:
            try:
                aura_summary = await sync_student_aura_progress(student_address)
            except Exception as e:
                log.warning(f"Failed to fetch AURA data for student {student_address}: {e}")

        # Customize prompt based on AURA data
        aura_context = ""
        if aura_summary and aura_summary.images_passing_quality > 5:  # High engagement threshold
            aura_context = f"\nEl usuario tiene un alto puntaje en AURA (engagement): {aura_summary.images_passing_quality} imágenes procesadas con calidad.\nPrioriza pasos que involucren crecimiento de comunidad o marketing técnico."

        prompt = f"""
        Eres un Coach de Carrera Senior especializado en Tech y Hackathones.
        El usuario quiere participar en: {hackathon_title}
        Insight Estratégico: {strategic_insight}
        Habilidades Faltantes: {', '.join(missing_skills)}
        {aura_context}

        Genera un roadmap de 3 pasos concretos para que el usuario sea altamente competitivo.
        Responde exclusivamente en formato JSON:
        {{
            "steps": [
                {{"title": "...", "description": "...", "priority": "high/medium"}}
            ],
            "estimated_effort": "X horas/días",
            "coach_tip": "..."
        }}
        """

        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=800,
                messages=[{"role": "user", "content": prompt}]
            )
            data = json.loads(response.content[0].text)

            # Store in agent's shared memory
            await store_memory(
                self.db,
                agent_id="coach",
                topic=f"roadmap-{hackathon_title.lower().replace(' ', '-')}",
                content=data
            )

            # Generate verifiable proof if student_address exists
            if student_address:
                try:
                    proof = await soroban_oracle.generate_mastery_proof(
                        user_address=student_address,
                        roadmap_id=f"roadmap-{hackathon_title.lower().replace(' ', '-')}",
                        skills=missing_skills
                    )
                    data["proof"] = proof
                except Exception as e:
                    log.warning(f"Failed to generate Soroban proof: {e}")

            return data
        except Exception as e:
            log.error(f"Coach Agent failed to generate roadmap: {e}")
            return {"steps": [], "error": "AI Coach unavailable"}

    async def generate_hackathon_assets(self, hackathon_title: str, roadmap: dict, project_idea: str) -> dict:
        """Generates a professional README and elevator pitch for a hackathon project."""
        prompt = f"""
        Eres un experto en presentación de proyectos tecnológicos para hackathones.
        Basándote en la siguiente información:

        Hackathon: {hackathon_title}
        Roadmap del proyecto: {json.dumps(roadmap, indent=2)}
        Idea del proyecto: {project_idea}

        Genera dos artefactos:

        1. Un README.md profesional que incluya:
           - Título llamativo
           - Descripción concisa del problema que resuelve
           - Solución propuesta
           - Tecnologías utilizadas
           - Instrucciones de instalación y uso
           - Roadmap de desarrollo
           - Contribuyentes

        2. Un "Elevator Pitch" de 30 segundos que incluya:
           - Hook inicial
           - Problema
           - Solución
           - Diferenciador
           - Llamado a la acción

        Responde exclusivamente en formato JSON:
        {{
            "readme": "{{Contenido del README.md}}",
            "elevator_pitch": "{{Contenido del pitch}}"
        }}
        """

        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}]
            )
            data = json.loads(response.content[0].text)

            # Store in agent memory
            await store_memory(
                self.db,
                agent_id="coach",
                topic=f"hackathon-assets-{hackathon_title.lower().replace(' ', '-')}",
                content=data
            )

            return data
        except Exception as e:
            log.error(f"Coach Agent failed to generate hackathon assets: {e}")
            return {"readme": "# Error generando README", "elevator_pitch": "Error generando pitch"}
