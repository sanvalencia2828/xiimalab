"""
DoraHacks API Scraper — HTTP client for hackathon listings.

Fetches hackathons from DoraHacks API endpoints.
Extracts: title, prize_pool, deadline, tags[], source_url
Saves to hackathons table with source='dorahacks-api'.

Follows same pattern as devpost_engine.py and devfolio_engine.py.
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
DORAHACKS_API_BASE = "https://api.dorahacks.io"
TIMEOUT_SECONDS = 30

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("xiima.dorahacks-api")


# ─────────────────────────────────────────────
# DoraHacks API Client
# ─────────────────────────────────────────────
async def _fetch_dorahacks_api(endpoint: str, params: Dict[str, Any] = None) -> Any:
    """Fetch data from DoraHacks API."""
    url = f"{DORAHACKS_API_BASE}{endpoint}"

    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(
                url,
                params=params,
                timeout=aiohttp.ClientTimeout(total=TIMEOUT_SECONDS),
                headers={"Accept": "application/json"}
            ) as response:
                if response.status != 200:
                    log.error(f"DoraHacks API error {response.status}: {await response.text()}")
                    return None

                return await response.json()
        except Exception as exc:
            log.error(f"DoraHacks API connection error: {exc}")
            return None


# ─────────────────────────────────────────────
# Data processing
# ─────────────────────────────────────────────
def _generate_id(title: str) -> str:
    """Generate stable ID from title."""
    import hashlib
    return hashlib.md5(title.lower().strip().encode()).hexdigest()[:12]


def _parse_prize(prize_data: Any) -> int:
    """Parse prize data to integer USD value."""
    if not prize_data:
        return 0

    try:
        # If it's already a number
        if isinstance(prize_data, (int, float)):
            return int(prize_data)

        # If it's a string
        if isinstance(prize_data, str):
            # Remove currency symbols and commas
            prize_text = prize_data.replace("$", "").replace(",", "").strip()

            # Handle K/M suffixes
            if prize_text.endswith("K"):
                return int(float(prize_text[:-1]) * 1000)
            elif prize_text.endswith("M"):
                return int(float(prize_text[:-1]) * 1000000)

            return int(float(prize_text))

        # If it's a dict with amount and currency
        if isinstance(prize_data, dict):
            amount = prize_data.get("amount", 0)
            return int(float(amount))

    except (ValueError, TypeError, KeyError):
        pass

    return 0


def _parse_deadline(deadline_data: Any) -> str:
    """Parse deadline to ISO date format."""
    if not deadline_data:
        return "2099-12-31"

    try:
        # If it's already a string date
        if isinstance(deadline_data, str):
            if "T" in deadline_data:
                dt = datetime.fromisoformat(deadline_data.replace("Z", "+00:00"))
            else:
                # Try parsing as date only
                dt = datetime.strptime(deadline_data, "%Y-%m-%d")
            return dt.date().isoformat()

        # If it's a timestamp
        if isinstance(deadline_data, (int, float)):
            dt = datetime.fromtimestamp(int(deadline_data)/1000)
            return dt.date().isoformat()

    except (ValueError, TypeError):
        pass

    return "2099-12-31"


# ─────────────────────────────────────────────
# Main scrape function
# ─────────────────────────────────────────────
async def scrape_dorahacks_api_hackathons() -> List[Dict]:
    """
    Fetch hackathons from DoraHacks API.

    Expected DoraHacks API response structure:
    {
        "data": {
            "hackathons": [
                {
                    "id": "hackathon-id",
                    "name": "Web3 Innovation Challenge",
                    "prize": {"amount": 50000, "currency": "USD"},
                    "tags": ["web3", "blockchain", "defi"],
                    "registration_end_time": "2026-05-15T23:59:59Z",
                    "hackathon_url": "https://dorahacks.io/hackathon/web3-innovation-challenge"
                }
            ]
        }
    }
    """
    log.info("🚀 Starting DoraHacks API scrape run…")

    # Fetch hackathons from DoraHacks API
    # This assumes there's an endpoint like "/hackathons" or similar
    result = await _fetch_dorahacks_api("/hackathons", {"status": "open"})

    if not result or "data" not in result:
        log.warning("No hackathons found in DoraHacks API response")
        return []

    # Handle different API response structures
    hackathons = []
    if "hackathons" in result["data"]:
        hackathons = result["data"]["hackathons"]
    elif isinstance(result["data"], list):
        hackathons = result["data"]
    elif "items" in result["data"]:
        hackathons = result["data"]["items"]
    else:
        hackathons = [result["data"]] if isinstance(result["data"], dict) else []

    parsed_items = []

    for item in hackathons:
        title = item.get("name") or item.get("title", "").strip()
        if not title:
            continue

        parsed_items.append({
            "id": _generate_id(title),
            "title": title,
            "prize_pool": _parse_prize(item.get("prize", 0)),
            "tags": item.get("tags", []) if isinstance(item.get("tags"), list) else [],
            "deadline": _parse_deadline(item.get("registration_end_time") or item.get("deadline")),
            "match_score": 0,  # Will be updated by AI engine
            "source_url": item.get("hackathon_url") or item.get("url", ""),
            "source": "dorahacks-api",
        })

    log.info(f"✅ Parsed {len(parsed_items)} hackathons from DoraHacks API")
    return parsed_items


# ─────────────────────────────────────────────
# DB upsert (asyncpg — fast bulk write)
# ─────────────────────────────────────────────
async def upsert_dorahacks_api_hackathons(items: List[Dict]) -> None:
    """Upsert parsed DoraHacks API hackathons to PostgreSQL."""
    if not items:
        log.warning("No DoraHacks API hackathons to upsert — skipping.")
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
        log.info(f"✅ Upserted {len(items)} DoraHacks API hackathons to PostgreSQL")
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
async def run_dorahacks_api_job() -> None:
    """Run complete DoraHacks API scrape and upsert cycle."""
    items = await scrape_dorahacks_api_hackathons()
    await upsert_dorahacks_api_hackathons(items)


if __name__ == "__main__":
    asyncio.run(run_dorahacks_api_job())