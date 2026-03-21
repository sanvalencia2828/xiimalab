import asyncio
import logging
import os
import uuid

log = logging.getLogger("xiima.scraper.devfolio")

DEVFOLIO_MCP_URL = os.environ.get(
    "DEVFOLIO_MCP_URL",
    "https://mcp.devfolio.co/mcp"
)
DEVFOLIO_API_KEY = os.environ.get(
    "DEVFOLIO_MCP_API_KEY",
    os.environ.get("DEVFOLIO_API_KEY", "")
)


async def scrape() -> list[dict]:
    """Fetch hackathons using the Devfolio MCP server via SSE transport."""
    try:
        from mcp.client.sse import sse_client
        from mcp import ClientSession
    except ImportError:
        log.error("mcp package not installed. Run: pip install mcp")
        return []

    url = f"{DEVFOLIO_MCP_URL}?apiKey={DEVFOLIO_API_KEY}"
    log.info(f"Connecting to Devfolio MCP at {DEVFOLIO_MCP_URL} ...")

    try:
        async with sse_client(url) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                log.info("MCP session initialized. Calling list_hackathons...")
                result = await session.call_tool("list_hackathons", {})

                # result.content is a list of TextContent / ImageContent items
                raw_items = []
                for item in result.content:
                    if hasattr(item, "text"):
                        import json
                        try:
                            parsed = json.loads(item.text)
                            if isinstance(parsed, list):
                                raw_items.extend(parsed)
                            elif isinstance(parsed, dict):
                                raw_items.append(parsed)
                        except json.JSONDecodeError:
                            log.warning(f"Could not parse item text as JSON: {item.text[:80]}")

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
