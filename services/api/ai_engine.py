"""
Xiimalab AI Engine — Claude 3.5 Sonnet competitiveness analysis.

analyze_competitiveness(opportunity) → {
    match_score: int (0-100),
    missing_skills: list[str],
    project_highlight: str,
}

Fully async. Gracefully degrades to zeroed response on API failure.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import anthropic
import asyncpg

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://xiima:secret@localhost:5432/xiimalab"
)
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 1024

log = logging.getLogger("xiima.ai_engine")

# ─────────────────────────────────────────────
# Developer profile (your background — update as skills grow)
# ─────────────────────────────────────────────
DEVELOPER_PROFILE = """
## Developer Profile — Santiago Valencia (Medellín, Colombia)

**Current level:** Junior Fullstack Developer & AI Engineer

**Education & certifications:**
- Data Analytics — NODO-EAFIT (Escuela de Ingeniería)
- Data Analytics — MINTIC (Ministerio TIC Colombia)
- Blockchain & Web3 — Stellar Impacta Program
- Avalanche Academy (DeFi, Smart Contracts)

**Technical skills:**
- Languages: Python, TypeScript/JavaScript
- Frontend: Next.js 14, React, Tailwind CSS, Framer Motion
- Backend: FastAPI, PostgreSQL, Redis, Docker, Docker Compose
- AI/Data: Pandas, NumPy, Scikit-learn, Playwright, AI model integration
- Blockchain: Stellar (SDK, Horizon API), Avalanche (EVM, Fuji testnet)
- DevOps: Docker, GitHub Actions (basic), Linux

**Main project:**
- **RedimensionAI** (https://github.com/sanvalencia2828/RedimensionAI):
  AI-powered image resizing & optimization engine for social media.
  Stack: Python, FastAPI, OpenCV, Docker.
  Features: Neural style transfer, smart content-awareness, multi-platform export.

**Gaps / growth areas:**
- Advanced ML model training (mostly uses pre-trained models)
- Solidity / EVM smart contract development (learning)
- Mobile development (none)
- Advanced DevOps / Kubernetes (basic Docker only)
"""

# ─────────────────────────────────────────────
# Fetch achievements from DB to enrich the prompt
# ─────────────────────────────────────────────
async def _fetch_achievements() -> str:
    """Return a formatted string of active certifications from user_achievements table."""
    # Strip the SQLAlchemy driver prefix for asyncpg raw connection
    raw_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    try:
        conn = await asyncpg.connect(raw_url)
        rows = await conn.fetch(
            "SELECT title, issuer, skills, issued_date FROM user_achievements WHERE is_active = true ORDER BY issued_date DESC"
        )
        await conn.close()
        if not rows:
            return ""
        lines = ["**Verified Certifications (from DB):**"]
        for r in rows:
            skills_list = r["skills"] if isinstance(r["skills"], list) else json.loads(r["skills"])
            skills_str = ", ".join(skills_list)
            lines.append(f"- {r['title']} — {r['issuer']} ({r['issued_date'] or 'n/a'}): {skills_str}")
        return "\n".join(lines)
    except Exception as exc:
        log.warning(f"Could not fetch achievements from DB: {exc}")
        return ""


# ─────────────────────────────────────────────
# Prompt builder
# ─────────────────────────────────────────────
async def _build_prompt(opportunity: dict[str, Any]) -> str:
    achievements_section = await _fetch_achievements()
    opp_str = json.dumps(opportunity, ensure_ascii=False, indent=2)
    return f"""You are a career coach specialized in hackathons and tech job applications.

Analyze the following opportunity and evaluate how competitive the developer below would be.

{DEVELOPER_PROFILE}

{achievements_section}

## Opportunity to Analyze
```json
{opp_str}
```

## Instructions
Return ONLY a valid JSON object — no markdown, no explanation, no extra text — with exactly these keys:
- "match_score": integer 0-100 (100 = perfect fit, 0 = no overlap)
- "missing_skills": array of strings (top 3 specific skills/tools they're missing to WIN this opportunity)
- "project_highlight": string (1-2 sentences: exactly HOW to use RedimensionAI to stand out in this specific application)

Example format:
{{"match_score": 78, "missing_skills": ["Solidity", "Hardhat", "IPFS"], "project_highlight": "Showcase RedimensionAI as an AI utility layer for NFT metadata image optimization on Avalanche, demonstrating cross-chain image processing at scale."}}
"""


# ─────────────────────────────────────────────
# Core analysis function
# ─────────────────────────────────────────────
async def analyze_competitiveness(opportunity: dict[str, Any]) -> dict[str, Any]:
    """
    Analyze a hackathon/job opportunity against the developer profile.

    Args:
        opportunity: dict with keys like title, tags, prize_pool, description, etc.

    Returns:
        {
            match_score: int,
            missing_skills: list[str],
            project_highlight: str,
        }
    """
    _fallback = {"match_score": 0, "missing_skills": [], "project_highlight": ""}

    if not ANTHROPIC_API_KEY:
        log.error("ANTHROPIC_API_KEY not set — cannot run analysis")
        return _fallback

    prompt = await _build_prompt(opportunity)

    try:
        import asyncio
        loop = asyncio.get_event_loop()

        def _call_claude() -> str:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            message = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text

        raw_text = await loop.run_in_executor(None, _call_claude)
        log.info(f"Claude response for '{opportunity.get('title', '?')}': {raw_text[:120]}…")

        # Parse JSON from response
        result = json.loads(raw_text.strip())

        # Validate & sanitize fields
        return {
            "match_score": max(0, min(100, int(result.get("match_score", 0)))),
            "missing_skills": [str(s) for s in result.get("missing_skills", [])[:5]],
            "project_highlight": str(result.get("project_highlight", "")),
        }

    except json.JSONDecodeError as exc:
        log.error(f"Claude returned invalid JSON: {exc}\nRaw: {raw_text}")
        return _fallback
    except anthropic.APIError as exc:
        log.error(f"Anthropic API error: {exc}")
        return _fallback
    except Exception as exc:
        log.error(f"Unexpected AI engine error: {exc}", exc_info=True)
        return _fallback
