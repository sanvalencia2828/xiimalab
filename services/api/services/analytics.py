"""
Analytics Service — AI-powered profile match evaluation
Uses OpenRouter (OpenAI-compatible) with gpt-4o or claude-3.5-sonnet.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

log = logging.getLogger("xiima.services.analytics")

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL   = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")
OPENROUTER_BASE    = "https://openrouter.ai/api/v1"

SYSTEM_PROMPT = """You are a senior technical recruiter and hackathon scout with 10 years of experience.
Your task: evaluate how well a developer profile matches a hackathon opportunity.

Respond ONLY with a valid JSON object — no markdown, no explanation outside JSON.
Required fields:
- match_score (int, 0-100): overall compatibility score
- matching_skills (list of strings): skills the user already has that are relevant
- missing_skills (list of strings): key skills the user lacks for this hackathon
- recommendation (string, max 120 chars): one concrete actionable suggestion

Be honest and specific. A score of 70+ means strong match. Below 40 means poor fit."""


async def evaluate_profile_match(
    user_profile: dict[str, Any],
    hackathon_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Use AI to evaluate how well a user profile matches a hackathon.
    
    Args:
        user_profile: dict with keys like skills, stack, experience, wallet
        hackathon_data: dict with keys like title, tags, prize_pool, deadline, source_url
    
    Returns:
        dict with match_score, matching_skills, missing_skills, recommendation
    """
    # Safe fallback
    fallback = {
        "match_score": 50,
        "matching_skills": user_profile.get("skills", [])[:3],
        "missing_skills": [],
        "recommendation": "Review hackathon requirements and apply early.",
    }

    if not OPENROUTER_API_KEY:
        log.warning("OPENROUTER_API_KEY not set — returning fallback match")
        return fallback

    try:
        import httpx

        user_summary = (
            f"Developer: {user_profile.get('username', 'unknown')}\n"
            f"Skills: {', '.join(user_profile.get('skills', []))}\n"
            f"Tech stack: {', '.join(user_profile.get('stack', []))}\n"
            f"Experience: {user_profile.get('experience', 'not specified')}\n"
            f"Previous hackathons: {user_profile.get('hackathons_count', 0)}"
        )

        hack_summary = (
            f"Hackathon: {hackathon_data.get('title', 'Unknown')}\n"
            f"Tags/Requirements: {', '.join(hackathon_data.get('tags', []))}\n"
            f"Prize pool: ${hackathon_data.get('prize_pool', 0):,}\n"
            f"Deadline: {hackathon_data.get('deadline', 'TBD')}\n"
            f"Source: {hackathon_data.get('source', '')}"
        )

        user_message = (
            f"USER PROFILE:\n{user_summary}\n\n"
            f"HACKATHON:\n{hack_summary}\n\n"
            "Evaluate the match and return the JSON object."
        )

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://xiimalab.vercel.app",
                    "X-Title": "Xiimalab Matchmaker",
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user",   "content": user_message},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                    "max_tokens": 400,
                },
            )

        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        result  = json.loads(content)

        # Validate and sanitize output
        return {
            "match_score":      max(0, min(100, int(result.get("match_score", 50)))),
            "matching_skills":  list(result.get("matching_skills", [])),
            "missing_skills":   list(result.get("missing_skills", [])),
            "recommendation":   str(result.get("recommendation", ""))[:200],
        }

    except Exception as exc:
        log.error(f"evaluate_profile_match error: {exc}")
        return fallback
