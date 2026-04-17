"""
Devfolio API Scraper — MCP client for hackathon listings.

Uses Devfolio MCP API via JSON-RPC 2.0 over HTTP POST (streamable HTTP).
Protocol: initialize → tools/list → tools/call
Extracts: title, prize_pool, deadline, tags[], source_url
Saves to hackathons table with source='devfolio'.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List

import httpx
import asyncpg

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql://xiima:secret@localhost:5432/xiimalab"
)
DEVFOLIO_MCP_API_KEY = os.environ.get("DEVFOLIO_MCP_API_KEY", "")
DEVFOLIO_MCP_BASE = "https://mcp.devfolio.co/mcp"
TIMEOUT_SECONDS = 30

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("xiima.devfolio")


# ─────────────────────────────────────────────
# MCP Client (JSON-RPC 2.0 over HTTP)
# ─────────────────────────────────────────────
def _parse_sse(text: str) -> Any:
    """Parse SSE response and extract JSON result."""
    result = None
    for line in text.splitlines():
        if line.startswith("data:"):
            raw = line[5:].strip()
            if raw and raw != "[DONE]":
                try:
                    parsed = json.loads(raw)
                    if "result" in parsed:
                        result = parsed["result"]
                except json.JSONDecodeError:
                    pass
    return result


async def _mcp_rpc(client: httpx.AsyncClient, url: str, method: str,
                   params: dict | None = None, session_id: str | None = None,
                   request_id: int = 1) -> tuple[Any, str | None]:
    """Send JSON-RPC 2.0 request. Returns (result, session_id)."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    if session_id:
        headers["Mcp-Session-Id"] = session_id

    payload: dict[str, Any] = {"jsonrpc": "2.0", "method": method, "id": request_id}
    if params:
        payload["params"] = params

    response = await client.post(url, json=payload, headers=headers)
    response.raise_for_status()

    new_session = (
        response.headers.get("Mcp-Session-Id")
        or response.headers.get("mcp-session-id")
        or session_id
    )

    text = response.text.strip()
    ct = response.headers.get("content-type", "")

    if "text/event-stream" in ct or text.startswith("event:") or text.startswith("data:"):
        return _parse_sse(text), new_session

    try:
        data = response.json()
        if "error" in data:
            raise RuntimeError(f"MCP error: {data['error']}")
        return data.get("result"), new_session
    except Exception:
        return _parse_sse(text), new_session


def _extract_hackathons(result: Any) -> list[dict]:
    """Extract hackathon list from MCP tool call response."""
    if isinstance(result, list):
        return result
    if isinstance(result, dict):
        for item in result.get("content", []):
            if item.get("type") == "text":
                try:
                    parsed = json.loads(item["text"])
                    if isinstance(parsed, list):
                        return parsed
                    if isinstance(parsed, dict):
                        for key in ("hackathons", "data", "results", "items"):
                            if key in parsed and isinstance(parsed[key], list):
                                return parsed[key]
                except (json.JSONDecodeError, KeyError):
                    pass
        for key in ("hackathons", "data", "results", "items"):
            if key in result and isinstance(result[key], list):
                return result[key]
    return []


# ─────────────────────────────────────────────
# Data processing
# ─────────────────────────────────────────────
def _generate_id(title: str) -> str:
    return hashlib.md5(title.lower().strip().encode()).hexdigest()[:12]


def _parse_prize(prize_text: str) -> int:
    if not prize_text:
        return 0
    prize_text = str(prize_text).replace("$", "").replace(",", "").strip()
    if prize_text.endswith("K"):
        return int(float(prize_text[:-1]) * 1000)
    elif prize_text.endswith("M"):
        return int(float(prize_text[:-1]) * 1000000)
    try:
        return int(float(prize_text))
    except (ValueError, TypeError):
        return 0


def _parse_deadline(deadline_str: str) -> str:
    if not deadline_str:
        return "2099-12-31"
    try:
        dt = datetime.fromisoformat(str(deadline_str).replace("Z", "+00:00"))
        return dt.date().isoformat()
    except ValueError:
        try:
            dt = datetime.fromtimestamp(int(deadline_str) / 1000)
            return dt.date().isoformat()
        except (ValueError, TypeError):
            return "2099-12-31"


# ─────────────────────────────────────────────
# Main scrape function
# ─────────────────────────────────────────────
async def scrape_devfolio_hackathons() -> List[Dict]:
    """Fetch hackathons from Devfolio MCP API using correct protocol."""
    if not DEVFOLIO_MCP_API_KEY:
        log.error("DEVFOLIO_MCP_API_KEY not set — skipping")
        return []

    log.info("Starting Devfolio MCP scrape...")
    url = f"{DEVFOLIO_MCP_BASE}?apiKey={DEVFOLIO_MCP_API_KEY}"

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        try:
            # 1. Initialize session
            _, session_id = await _mcp_rpc(client, url, "initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "xiimalab-engine", "version": "1.0.0"},
            })

            # 2. Initialized notification
            try:
                headers = {"Content-Type": "application/json"}
                if session_id:
                    headers["Mcp-Session-Id"] = session_id
                await client.post(url, json={
                    "jsonrpc": "2.0", "method": "notifications/initialized"
                }, headers=headers)
            except Exception:
                pass

            # 3. Discover tools
            tools_result, session_id = await _mcp_rpc(
                client, url, "tools/list", session_id=session_id, request_id=2
            )
            tool_names = [t.get("name", "") for t in (tools_result or {}).get("tools", [])]
            log.info(f"MCP tools: {tool_names}")

            # 4. Find and call hackathon tool
            hack_tool = next((n for n in tool_names if "hackathon" in n.lower()), "list_hackathons")
            call_result, _ = await _mcp_rpc(
                client, url, "tools/call",
                {"name": hack_tool, "arguments": {}},
                session_id=session_id, request_id=3
            )

            raw_hackathons = _extract_hackathons(call_result)
            log.info(f"Retrieved {len(raw_hackathons)} raw hackathons from Devfolio")

        except Exception as exc:
            log.error(f"Devfolio MCP error: {exc}", exc_info=True)
            return []

    # Parse raw items
    parsed_items = []
    for item in raw_hackathons:
        title = (item.get("title") or item.get("name") or "").strip()
        if not title:
            continue
        slug = item.get("slug") or item.get("id") or _generate_id(title)
        parsed_items.append({
            "id": f"devfolio-{slug}",
            "title": title,
            "prize_pool": _parse_prize(str(item.get("prize", item.get("prize_amount", "0")))),
            "tags": item.get("tags") or item.get("technologies") or [],
            "deadline": _parse_deadline(str(item.get("deadline", item.get("ends_at", "")))),
            "match_score": 0,
            "source_url": item.get("url") or f"https://devfolio.co/hackathons/{slug}",
            "source": "devfolio",
        })

    log.info(f"Parsed {len(parsed_items)} hackathons from Devfolio")
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