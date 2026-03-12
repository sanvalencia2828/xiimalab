"""
services/scraper/snap_engine.py
─────────────────────────────────────────────────────────────────────────────
SNAP Engine — Scraper de Hackatones en Tiempo Real

Fuentes:
  • Devpost    → API pública JSON (sin autenticación)
  • DoraHacks  → Playwright (DOM scraping)
  • Devfolio   → MCP JSON-RPC 2.0

Persistencia:
  • PostgreSQL via asyncpg → tabla active_hackathons (upsert, sin duplicados)
  • Redis pub/sub → canal hackathons:new para SSE en tiempo real

Ejecución:
  • APScheduler cada 12 horas (configurable via SNAP_INTERVAL_HOURS)
  • Corrida inmediata al arrancar el contenedor
  • Modo standalone: python snap_engine.py

Docker: ver docker-compose.yml → servicio snap-engine
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import asyncpg
import httpx
import redis.asyncio as aioredis
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

load_dotenv()

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
DATABASE_URL          = os.environ.get("DATABASE_URL", "postgresql://xiima:secret@db:5432/xiimalab")
REDIS_URL             = os.environ.get("REDIS_URL", "redis://redis:6379")
DEVFOLIO_API_KEY      = os.environ.get("DEVFOLIO_MCP_API_KEY", "")
SNAP_INTERVAL_HOURS   = int(os.environ.get("SNAP_INTERVAL_HOURS", "12"))
HEADLESS              = os.environ.get("HEADLESS", "true").lower() == "true"
REDIS_CHANNEL         = "hackathons:new"

log = logging.getLogger("xiima.snap")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)

# ─────────────────────────────────────────────
# Tipo normalizado de hackatón
# ─────────────────────────────────────────────
HackathonRow = dict[str, Any]

def _make_id(source: str, slug_or_title: str) -> str:
    key = f"{source}-{slug_or_title}"
    return hashlib.md5(key.encode()).hexdigest()[:20]

SKILL_KEYWORDS = {
    "ai", "ml", "python", "blockchain", "web3", "defi", "stellar",
    "solidity", "evm", "avalanche", "typescript", "react", "rust",
    "nft", "ipfs", "data", "docker", "cloud", "api",
}

def _match_score(tags: list[str]) -> int:
    hits = sum(1 for t in tags if t.lower() in SKILL_KEYWORDS)
    return min(50 + hits * 15, 100)


# ─────────────────────────────────────────────
# 1. Devpost — API pública
# ─────────────────────────────────────────────
async def scrape_devpost(client: httpx.AsyncClient) -> list[HackathonRow]:
    """
    Devpost expone una API JSON pública en /hackathons.json
    Parámetros útiles: ?status=upcoming&page=1&per_page=20
    """
    log.info("Devpost — iniciando fetch...")
    rows: list[HackathonRow] = []

    try:
        for page in range(1, 4):  # máx 3 páginas = 60 hackatones
            resp = await client.get(
                "https://devpost.com/api/hackathons",
                params={
                    "status":   "upcoming",
                    "page":     page,
                    "per_page": 20,
                    "order_by": "prize-amount",
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
            hackathons: list[dict] = data.get("hackathons", [])

            if not hackathons:
                break

            for h in hackathons:
                title    = h.get("title", "").strip()
                slug     = h.get("url", title).split("/")[-1] or title[:32]
                deadline = h.get("submission_period_dates", "").split(" - ")[-1].strip()

                # Premio
                prize_raw = h.get("prize_amount", "0") or "0"
                try:
                    prize = int(str(prize_raw).replace(",", "").replace("$", "").split()[0])
                except (ValueError, IndexError):
                    prize = 0

                # Tags de tecnología
                tags = [
                    t.get("name", "")
                    for t in h.get("themes", []) + h.get("technologies", [])
                    if t.get("name")
                ]

                rows.append({
                    "id":         f"devpost-{slug[:40]}",
                    "title":      title[:256],
                    "prize_pool": prize,
                    "tags":       tags,
                    "deadline":   deadline[:32],
                    "match_score": _match_score(tags),
                    "source_url": h.get("url", f"https://devpost.com/hackathons/{slug}"),
                    "source":     "devpost",
                })

        log.info(f"Devpost → {len(rows)} hackatones")
    except Exception as exc:
        log.error(f"Devpost error: {exc}")

    return rows


# ─────────────────────────────────────────────
# 2. DoraHacks — Playwright
# ─────────────────────────────────────────────
async def scrape_dorahacks() -> list[HackathonRow]:
    """Scraper Playwright para DoraHacks usando el motor existente."""
    log.info("DoraHacks — iniciando Playwright...")
    rows: list[HackathonRow] = []

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=HEADLESS,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                )
            )
            page = await context.new_page()
            await stealth_async(page)

            await page.goto(
                "https://dorahacks.io/hackathon",
                wait_until="domcontentloaded",
                timeout=30_000,
            )
            await asyncio.sleep(3)

            cards = await page.evaluate("""
                () => {
                    const cards = document.querySelectorAll(
                        '[class*="hackathon-card"], [class*="HackCard"], article, [class*="BountyCard"]'
                    );
                    return Array.from(cards).map(card => {
                        const titleEl    = card.querySelector('h2, h3, [class*="title"]');
                        const prizeEl    = card.querySelector('[class*="prize"], [class*="reward"], [class*="bounty"]');
                        const deadlineEl = card.querySelector('[class*="deadline"], [class*="date"], time');
                        const tagEls     = card.querySelectorAll('[class*="tag"], [class*="badge"], [class*="skill"]');
                        const linkEl     = card.querySelector('a[href]');
                        return {
                            title:    titleEl?.textContent?.trim()  || '',
                            prize:    prizeEl?.textContent?.trim()  || '0',
                            deadline: deadlineEl?.getAttribute('datetime')
                                      || deadlineEl?.textContent?.trim() || '',
                            tags:     Array.from(tagEls)
                                        .map(t => t.textContent?.trim())
                                        .filter(Boolean)
                                        .join(','),
                            url:      linkEl?.href || '',
                        };
                    }).filter(c => c.title.length > 3);
                }
            """)

            await browser.close()

            for card in cards:
                title = card.get("title", "").strip()
                if not title:
                    continue

                tags = [t.strip() for t in card.get("tags", "").split(",") if t.strip()]

                prize_raw = card.get("prize", "0") or "0"
                try:
                    prize = int("".join(filter(str.isdigit, prize_raw.split(".")[0])) or "0")
                except ValueError:
                    prize = 0

                url = card.get("url", "")
                slug = url.split("/")[-1] if url else title[:32]

                rows.append({
                    "id":         f"dora-{_make_id('dora', slug)}",
                    "title":      title[:256],
                    "prize_pool": prize,
                    "tags":       tags,
                    "deadline":   card.get("deadline", "")[:32],
                    "match_score": _match_score(tags),
                    "source_url": url or f"https://dorahacks.io/hackathon/{slug}",
                    "source":     "dorahacks",
                })

        log.info(f"DoraHacks → {len(rows)} hackatones")
    except Exception as exc:
        log.error(f"DoraHacks error: {exc}")

    return rows


# ─────────────────────────────────────────────
# 3. Devfolio — MCP JSON-RPC 2.0
# ─────────────────────────────────────────────
async def scrape_devfolio(client: httpx.AsyncClient) -> list[HackathonRow]:
    """Cliente MCP directo para Devfolio (reutiliza lógica de devfolio_mcp.py)."""
    if not DEVFOLIO_API_KEY:
        log.warning("DEVFOLIO_MCP_API_KEY no configurada — omitiendo Devfolio")
        return []

    log.info("Devfolio MCP — iniciando...")
    url     = f"https://mcp.devfolio.co/mcp?apiKey={DEVFOLIO_API_KEY}"
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    rows: list[HackathonRow] = []

    def _parse_sse(text: str) -> Any:
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

    async def _rpc(method: str, params: dict | None = None, session_id: str | None = None) -> tuple[Any, str | None]:
        hdrs = {**headers}
        if session_id:
            hdrs["Mcp-Session-Id"] = session_id
        body = {"jsonrpc": "2.0", "method": method, "id": 1}
        if params:
            body["params"] = params
        resp = await client.post(url, json=body, headers=hdrs, timeout=20.0)
        sid  = resp.headers.get("Mcp-Session-Id") or resp.headers.get("mcp-session-id") or session_id
        text = resp.text
        ct   = resp.headers.get("content-type", "")
        if "text/event-stream" in ct or text.startswith("event:") or text.startswith("data:"):
            return _parse_sse(text), sid
        try:
            data = resp.json()
            return data.get("result"), sid
        except Exception:
            return _parse_sse(text), sid

    try:
        _, sid = await _rpc("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "clientInfo": {"name": "snap-engine", "version": "1.0.0"},
        })

        tools_result, sid = await _rpc("tools/list", session_id=sid)
        tools: list[str] = [t["name"] for t in (tools_result or {}).get("tools", [])]
        hack_tool = next((t for t in tools if "hackathon" in t.lower()), "get_hackathons")

        result, _ = await _rpc(
            "tools/call",
            {"name": hack_tool, "arguments": {"status": "open"}},
            session_id=sid,
        )

        raw_list: list[dict] = []
        if isinstance(result, list):
            raw_list = result
        elif isinstance(result, dict):
            for item in result.get("content", []):
                if item.get("type") == "text":
                    try:
                        parsed = json.loads(item["text"])
                        raw_list = parsed if isinstance(parsed, list) else parsed.get("hackathons", [])
                        break
                    except Exception:
                        pass
            if not raw_list:
                for k in ("hackathons", "data", "results"):
                    if isinstance(result.get(k), list):
                        raw_list = result[k]
                        break

        for h in raw_list:
            title = (h.get("name") or h.get("title") or "").strip()
            if not title:
                continue
            slug  = h.get("slug") or h.get("id") or title[:32]
            tags  = h.get("tags") or h.get("technologies") or []
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(",") if t.strip()]
            prize_raw = h.get("prize_amount") or h.get("total_prize") or "0"
            try:
                prize = int(str(prize_raw).replace(",", "").replace("$", "").split()[0])
            except (ValueError, IndexError):
                prize = 0
            deadline = (h.get("ends_at") or h.get("deadline") or h.get("end_date") or "")
            rows.append({
                "id":          f"devfolio-{slug[:40]}",
                "title":       title[:256],
                "prize_pool":  prize,
                "tags":        tags,
                "deadline":    str(deadline)[:32],
                "match_score": _match_score(tags),
                "source_url":  h.get("url") or f"https://devfolio.co/hackathons/{slug}",
                "source":      "devfolio",
            })

        log.info(f"Devfolio → {len(rows)} hackatones")
    except Exception as exc:
        log.error(f"Devfolio MCP error: {exc}")

    return rows


# ─────────────────────────────────────────────
# Persistencia — tabla active_hackathons
# ─────────────────────────────────────────────
async def upsert_active_hackathons(
    rows: list[HackathonRow],
    redis_client: aioredis.Redis,
) -> int:
    """
    Inserta o actualiza hackatones en active_hackathons.
    Publica en Redis las que son nuevas (para SSE en tiempo real).
    Retorna el número de nuevas insertadas.
    """
    if not rows:
        return 0

    conn = await asyncpg.connect(DATABASE_URL)
    new_count = 0

    try:
        for h in rows:
            existing = await conn.fetchval(
                "SELECT id FROM active_hackathons WHERE id = $1", h["id"]
            )
            is_new = existing is None

            await conn.execute(
                """
                INSERT INTO active_hackathons
                    (id, title, prize_pool, tags, deadline,
                     match_score, source_url, source, last_seen_at)
                VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    title        = EXCLUDED.title,
                    prize_pool   = EXCLUDED.prize_pool,
                    tags         = EXCLUDED.tags,
                    deadline     = EXCLUDED.deadline,
                    match_score  = EXCLUDED.match_score,
                    source_url   = EXCLUDED.source_url,
                    last_seen_at = NOW(),
                    updated_at   = NOW()
                """,
                h["id"],
                h["title"],
                h["prize_pool"],
                json.dumps(h["tags"]),
                h["deadline"],
                h["match_score"],
                h["source_url"],
                h["source"],
            )

            if is_new:
                new_count += 1
                await redis_client.publish(
                    REDIS_CHANNEL,
                    json.dumps({
                        **h,
                        "tags":       h["tags"],
                        "scraped_at": datetime.now(timezone.utc).isoformat(),
                    }),
                )

    finally:
        await conn.close()

    return new_count


# ─────────────────────────────────────────────
# Job principal
# ─────────────────────────────────────────────
async def snap_job(redis_client: aioredis.Redis) -> None:
    """Corre los 3 scrapers, unifica resultados y persiste."""
    log.info("⚡ SNAP job iniciado...")
    start = datetime.now(timezone.utc)

    async with httpx.AsyncClient(
        headers={"User-Agent": "xiimalab-snap/1.0 (+https://xiimalab.dev)"},
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        devpost_rows, dorahacks_rows, devfolio_rows = await asyncio.gather(
            scrape_devpost(client),
            scrape_dorahacks(),
            scrape_devfolio(client),
            return_exceptions=True,
        )

    # Consolidar (ignorar errores de scrapers individuales)
    all_rows: list[HackathonRow] = []
    for result in (devpost_rows, dorahacks_rows, devfolio_rows):
        if isinstance(result, list):
            all_rows.extend(result)
        else:
            log.error(f"Scraper falló: {result}")

    # Deduplicar por ID
    seen: set[str] = set()
    unique: list[HackathonRow] = []
    for row in all_rows:
        if row["id"] not in seen:
            seen.add(row["id"])
            unique.append(row)

    new_count = await upsert_active_hackathons(unique, redis_client)

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    log.info(
        f"✅ SNAP job completado en {elapsed:.1f}s — "
        f"{len(unique)} total · {new_count} nuevas publicadas en Redis"
    )


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
async def main() -> None:
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

    # Correr inmediatamente al iniciar
    await snap_job(redis_client)

    # Scheduler periódico
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        snap_job,
        "interval",
        hours=SNAP_INTERVAL_HOURS,
        args=[redis_client],
        id="snap_job",
        max_instances=1,
        misfire_grace_time=300,
    )
    scheduler.start()
    log.info(f"⏰ SNAP scheduler activo — intervalo: {SNAP_INTERVAL_HOURS}h")

    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        await redis_client.close()
        log.info("SNAP Engine detenido")


if __name__ == "__main__":
    asyncio.run(main())
