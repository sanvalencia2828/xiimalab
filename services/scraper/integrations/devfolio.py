import asyncio
import json
import logging
import os
import uuid

import httpx

log = logging.getLogger("xiima.scraper.devfolio")

DEVFOLIO_MCP_URL = os.environ.get(
    "DEVFOLIO_MCP_URL",
    "https://mcp.devfolio.co/mcp"
)
DEVFOLIO_API_KEY = os.environ.get(
    "DEVFOLIO_API_KEY",
    os.environ.get("DEVFOLIO_MCP_API_KEY", "")
)


def _parse_sse(text: str):
    """Parse SSE response and extract JSON from last 'data:' event."""
    result = None
    for line in text.splitlines():
        if line.startswith("data:"):
            raw = line[5:].strip()
            if raw and raw != "[DONE]":
                try:
                    parsed = json.loads(raw)
                    if "result" in parsed:
                        result = parsed["result"]
                    elif "error" in parsed:
                        raise RuntimeError(f"MCP error: {parsed['error']}")
                except json.JSONDecodeError:
                    pass
    return result


async def _mcp_rpc(client: httpx.AsyncClient, url: str, method: str,
                   params: dict | None = None, session_id: str | None = None,
                   request_id: int = 1) -> tuple:
    """Send a JSON-RPC 2.0 request to MCP server. Returns (result, session_id)."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    if session_id:
        headers["Mcp-Session-Id"] = session_id

    payload = {"jsonrpc": "2.0", "method": method, "id": request_id}
    if params:
        payload["params"] = params

    response = await client.post(url, json=payload, headers=headers)
    response.raise_for_status()

    new_session = (
        response.headers.get("Mcp-Session-Id")
        or response.headers.get("mcp-session-id")
        or session_id
    )

    content_type = response.headers.get("content-type", "")
    text = response.text.strip()

    if "text/event-stream" in content_type or text.startswith("event:") or text.startswith("data:"):
        return _parse_sse(text), new_session

    try:
        data = response.json()
        if "error" in data:
            raise RuntimeError(f"MCP error: {data['error']}")
        return data.get("result"), new_session
    except Exception:
        return _parse_sse(text), new_session


def _extract_hackathons(result) -> list[dict]:
    """Extract hackathon list from MCP tool response."""
    if isinstance(result, list):
        return result
    if isinstance(result, dict):
        content = result.get("content", [])
        for item in content:
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


async def scrape() -> list[dict]:
    """Fetch hackathons from Devfolio MCP server via HTTP (JSON-RPC 2.0)."""
    if not DEVFOLIO_API_KEY:
        log.error("DEVFOLIO_MCP_API_KEY not set — skipping Devfolio")
        return []

    url = f"{DEVFOLIO_MCP_URL}?apiKey={DEVFOLIO_API_KEY}"
    log.info(f"Connecting to Devfolio MCP at {DEVFOLIO_MCP_URL} ...")

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # 1. Initialize MCP session
            _, session_id = await _mcp_rpc(client, url, "initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "xiimalab-scraper", "version": "1.0.0"},
            })
            log.info(f"MCP session initialized (session={session_id[:16] if session_id else 'none'}...)")

            # 2. Send initialized notification (required by MCP spec)
            try:
                headers = {"Content-Type": "application/json"}
                if session_id:
                    headers["Mcp-Session-Id"] = session_id
                await client.post(url, json={
                    "jsonrpc": "2.0", "method": "notifications/initialized"
                }, headers=headers)
            except Exception:
                pass

            # 3. Discover available tools
            tools_result, session_id = await _mcp_rpc(
                client, url, "tools/list", session_id=session_id, request_id=2
            )
            tool_names = [t.get("name", "") for t in (tools_result or {}).get("tools", [])]
            log.info(f"MCP tools available: {tool_names}")

            # 4. Find hackathon tool
            hack_tool = next((n for n in tool_names if "hackathon" in n.lower()), None)
            if not hack_tool:
                hack_tool = "list_hackathons"
                log.warning(f"No hackathon tool found, trying default: {hack_tool}")

            # 5. Call the tool
            call_result, _ = await _mcp_rpc(
                client, url, "tools/call",
                {"name": hack_tool, "arguments": {}},
                session_id=session_id, request_id=3
            )

            raw_items = _extract_hackathons(call_result)
            log.info(f"Retrieved {len(raw_items)} hackathons from Devfolio MCP")
            return raw_items

        except Exception as exc:
            log.error(f"Devfolio MCP error: {exc}", exc_info=True)
            return []


def parse(raw_items: list[dict]) -> list[dict]:
    """Parse raw Devfolio MCP items into standard hackathon objects."""
    parsed = []
    for item in raw_items:
        title = item.get("title") or item.get("name") or "Unnamed Hackathon"
        slug = item.get("slug") or item.get("id") or str(uuid.uuid4())

        deadline_raw = item.get("deadline") or item.get("ends_at") or ""
        deadline = deadline_raw[:10] if deadline_raw else "2099-12-31"

        parsed.append({
            "id": f"devfolio-{slug}",
            "title": title,
            "prize_pool": int(item.get("prize_pool") or item.get("prizePool") or 0),
            "tags": item.get("tags") or [],
            "deadline": deadline,
            "match_score": 0,
            "source_url": (
                item.get("url")
                or item.get("devfolio_url")
                or f"https://devfolio.co/hackathons/{slug}"
            ),
            "source": "devfolio",
        })
    return parsed


async def run() -> list[dict]:
    raw = await scrape()
    if raw:
        return parse(raw)
    return []


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())
