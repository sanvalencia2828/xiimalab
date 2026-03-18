"""
Xiimalab AI Engine — competitiveness analysis via OpenRouter (Claude/GPT fallback).

analyze_competitiveness(opportunity) → {
    match_score: int (0-100),
    missing_skills: list[str],
    project_highlight: str,
}

Fully async. Exponential backoff on rate limits / server errors.
Gracefully degrades to zeroed response after max retries.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
from typing import Any

import httpx
import asyncpg

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
OPENROUTER_API_KEY: str = os.environ.get("OPENROUTER_API_KEY", "")
ANTHROPIC_API_KEY: str  = os.environ.get("ANTHROPIC_API_KEY", "")   # legacy fallback
DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://xiima:secret@localhost:5432/xiimalab"
)

# OpenRouter — primary provider
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL    = "anthropic/claude-3.5-sonnet"   # change to openai/gpt-4o, etc.
MAX_TOKENS          = 1024

# Retry config — exponential backoff
MAX_RETRIES    = 4          # total attempts
BASE_DELAY     = 1.0        # seconds for first retry
MAX_DELAY      = 30.0       # cap on delay
JITTER         = 0.3        # ±30% random jitter to avoid thundering herd
RETRYABLE_CODES = {429, 500, 502, 503, 504}  # HTTP codes worth retrying

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
# Exponential backoff helper
# ─────────────────────────────────────────────
def _backoff_delay(attempt: int) -> float:
    """Return delay in seconds for given attempt (0-indexed) with jitter."""
    delay = min(BASE_DELAY * (2 ** attempt), MAX_DELAY)
    jitter = delay * JITTER * (random.random() * 2 - 1)  # ±JITTER%
    return max(0.1, delay + jitter)


# ─────────────────────────────────────────────
# OpenRouter API call with retries
# ─────────────────────────────────────────────
async def _call_openrouter(prompt: str, title: str) -> str:
    """
    Call OpenRouter API with exponential backoff retries.

    Retries on:  429 (rate limit), 500/502/503/504 (server errors), timeouts
    Fails fast on: 400 (bad request), 401 (invalid key), 403 (forbidden)

    Returns raw text content from the model.
    Raises RuntimeError after max retries exhausted.
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://xiimalab.vercel.app",
        "X-Title": "Xiimalab AI Engine",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "max_tokens": MAX_TOKENS,
        "messages": [{"role": "user", "content": prompt}],
    }

    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(MAX_RETRIES):
            try:
                log.info(f"[AI] attempt {attempt+1}/{MAX_RETRIES} — '{title}'")
                resp = await client.post(OPENROUTER_BASE_URL, headers=headers, json=payload)

                # Fast-fail on auth/bad-request errors — no point retrying
                if resp.status_code in (400, 401, 403):
                    body = resp.text[:300]
                    raise RuntimeError(f"Non-retryable HTTP {resp.status_code}: {body}")

                # Retryable server/rate-limit errors
                if resp.status_code in RETRYABLE_CODES:
                    delay = _backoff_delay(attempt)
                    retry_after = float(resp.headers.get("Retry-After", delay))
                    wait = max(delay, retry_after)
                    log.warning(
                        f"[AI] HTTP {resp.status_code} on attempt {attempt+1} "
                        f"— retrying in {wait:.1f}s"
                    )
                    last_error = RuntimeError(f"HTTP {resp.status_code}")
                    await asyncio.sleep(wait)
                    continue

                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]

            except httpx.TimeoutException as exc:
                delay = _backoff_delay(attempt)
                log.warning(f"[AI] Timeout on attempt {attempt+1} — retrying in {delay:.1f}s")
                last_error = exc
                await asyncio.sleep(delay)

            except httpx.RequestError as exc:
                delay = _backoff_delay(attempt)
                log.warning(f"[AI] Network error on attempt {attempt+1}: {exc} — retrying in {delay:.1f}s")
                last_error = exc
                await asyncio.sleep(delay)

    raise RuntimeError(
        f"OpenRouter failed after {MAX_RETRIES} attempts for '{title}'. "
        f"Last error: {last_error}"
    )


# ─────────────────────────────────────────────
# Core analysis function
# ─────────────────────────────────────────────
async def analyze_competitiveness(opportunity: dict[str, Any]) -> dict[str, Any]:
    """
    Analyze a hackathon/job opportunity against the developer profile.

    Uses OpenRouter as primary provider with exponential backoff.
    Falls back gracefully to zeroed response if all retries exhausted.

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
    title = opportunity.get("title", "unknown")

    if not OPENROUTER_API_KEY:
        log.error("OPENROUTER_API_KEY not set — cannot run analysis")
        return _fallback

    prompt = await _build_prompt(opportunity)
    raw_text = ""

    try:
        raw_text = await _call_openrouter(prompt, title)
        log.info(f"[AI] response for '{title}': {raw_text[:120]}…")

        result = json.loads(raw_text.strip())

        return {
            "match_score":     max(0, min(100, int(result.get("match_score", 0)))),
            "missing_skills":  [str(s) for s in result.get("missing_skills", [])[:5]],
            "project_highlight": str(result.get("project_highlight", "")),
        }

    except json.JSONDecodeError as exc:
        log.error(f"[AI] Invalid JSON from model: {exc}\nRaw: {raw_text[:300]}")
        return _fallback

    except RuntimeError as exc:
        log.error(f"[AI] {exc}")
        return _fallback

    except Exception as exc:
        log.error(f"[AI] Unexpected error for '{title}': {exc}", exc_info=True)
        return _fallback
