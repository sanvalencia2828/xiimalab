"""
Devfolio API Scraper — JSON-RPC client for hackathon listings.

Uses Devfolio MCP API via JSON-RPC 2.0 over HTTP POST.
Extracts: title, prize_pool, deadline, tags[], source_url
Saves to hackathons table with source='devfolio'.

Follows same pattern as devpost_engine.py.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List

import aiohttp
import asyncpg

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql://xiima:secret@localhost:5432/xiimalab"
)
DEVFOLIO_MCP_API_KEY = os.environ.get("DEVFOLIO_MCP_API_KEY", "")
DEVFOLIO_MCP_URL = f"https://mcp.devfolio.co/mcp?apiKey={DEVFOLIO_MCP_API_KEY}"
TIMEOUT_SECONDS = 30

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("xiima.devfolio")


# ─────────────────────────────────────────────
# Devfolio MCP Client
# ─────────────────────────────────────────────
async def _call_devfolio_mcp(method: str, params: Dict[str, Any] = None) -> Any:
    """Call Devfolio MCP API via JSON-RPC 2.0."""
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params or {},
        "id": "xiima-" + datetime.now().isoformat(),
    }

    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                DEVFOLIO_MCP_URL,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=TIMEOUT_SECONDS),
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status != 200:
                    log.error(f"Devfolio API error {response.status}: {await response.text()}")
                    return None

                result = await response.json()

                if "error" in result:
                    log.error(f"Devfolio RPC error: {result['error']}")
                    return None

                return result.get("result")
        except Exception as exc:
            log.error(f"Devfolio API connection error: {exc}")
            return None


# ─────────────────────────────────────────────
# Data processing
# ─────────────────────────────────────────────
def _generate_id(title: str) -> str:
    """Generate stable ID from title."""
    import hashlib
    return hashlib.md5(title.lower().strip().encode()).hexdigest()[:12]


def _parse_prize(prize_text: str) -> int:
    """Parse prize text to integer USD value."""
    if not prize_text:
        return 0

    # Remove currency symbols and commas
    prize_text = prize_text.replace("$", "").replace(",", "").strip()

    # Handle K/M suffixes
    if prize_text.endswith("K"):
        return int(float(prize_text[:-1]) * 1000)
    elif prize_text.endswith("M"):
        return int(float(prize_text[:-1]) * 1000000)

    try:
        return int(float(prize_text))
    except (ValueError, TypeError):
        return 0


def _parse_deadline(deadline_str: str) -> str:
    """Parse deadline to ISO date format."""
    if not deadline_str:
        return "2099-12-31"

    try:
        # Try parsing common formats
        dt = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except ValueError:
        try:
            # Try parsing timestamp
            dt = datetime.fromtimestamp(int(deadline_str)/1000)
            return dt.date().isoformat()
        except (ValueError, TypeError):
            return "2099-12-31"


# ─────────────────────────────────────────────
# Main scrape function
# ─────────────────────────────────────────────
async def scrape_devfolio_hackathons() -> List[Dict]:
    """
    Fetch hackathons from Devfolio MCP API.

    Expected Devfolio API response structure:
    {
        "hackathons": [
            {
                "title": "ETHGlobal Hackathon",
                "prize": "$50,000",
                "tags": ["ethereum", "blockchain", "defi"],
                "deadline": "2026-05-15T23:59:59Z",
                "url": "https://devfolio.co/hackathons/ethglobal-2026"
            }
        ]
    """
    log.info("🚀 Starting Devfolio API scrape run…")

    # Call Devfolio MCP API method to list hackathons
    # This assumes there's a method like "list_hackathons" available
    result = await _call_devfolio_mcp("list_hackathons")

    if not result or "hackathons" not in result:
        log.warning("No hackathons found in Devfolio API response")
        return []

    hackathons = result["hackathons"]
    parsed_items = []

    for item in hackathons:
        title = item.get("title", "").strip()
        if not title:
            continue

        parsed_items.append({
            "id": _generate_id(title),
            "title": title,
            "prize_pool": _parse_prize(item.get("prize", "0")),
            "tags": item.get("tags", []),
            "deadline": _parse_deadline(item.get("deadline", "")),
            "match_score": 0,  # Will be updated by AI engine
            "source_url": item.get("url", ""),
            "source": "devfolio",
        })

    log.info(f"✅ Parsed {len(parsed_items)} hackathons from Devfolio API")
    return parsed_items


# ─────────────────────────────────────────────
# DB upsert (asyncpg — fast bulk write)
# ─────────────────────────────────────────────
async def upsert_devfolio_hackathons(items: List[Dict]) -> None:
    """Upsert parsed Devfolio hackathons to PostgreSQL."""
    if not items:
        log.warning("No Devfolio hackathons to upsert — skipping.")
        return

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        records = [
            (
                item["id"],
                item["title"],
                item["prize_pool"],
                json.dumps(item["tags"]),
                item["deadline"],
                item["match_score"],
                item["source_url"],
                item["source"],
            )
            for item in items
        ]
        await conn.executemany(
            """
            INSERT INTO hackathons (id, title, prize_pool, tags, deadline, match_score, source_url, source)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
                title       = EXCLUDED.title,
                prize_pool  = EXCLUDED.prize_pool,
                tags        = EXCLUDED.tags,
                deadline    = EXCLUDED.deadline,
                source_url  = EXCLUDED.source_url,
                source      = EXCLUDED.source,
                updated_at  = NOW()
            """,
            records,
        )
        log.info(f"✅ Upserted {len(items)} Devfolio hackathons to PostgreSQL")
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
async def run() -> List[Dict]:
    """Run complete Devfolio scrape and return parsed items."""
    items = await scrape_devfolio_hackathons()
    return items


async def run_devfolio_job() -> None:
    """Run complete Devfolio scrape and upsert cycle."""
    items = await scrape_devfolio_hackathons()
    await upsert_devfolio_hackathons(items)


if __name__ == "__main__":
    asyncio.run(run_devfolio_job())