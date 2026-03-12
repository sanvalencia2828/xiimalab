"""
DoraHacks scraper — Playwright + stealth, scheduled execution.
Anti-detection techniques:
  - playwright-stealth to mask WebDriver fingerprints
  - Random User-Agent rotation
  - Randomized delay between requests (3.5–8.2 s)
  - Viewport randomization
  - Scrolls page to simulate human behavior
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread

import asyncpg
import redis.asyncio as aioredis
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

from parser import parse_hackathon_cards

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql://xiima:secret@localhost:5432/xiimalab"
)
REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
SCRAPER_INTERVAL_MINUTES: int = int(os.environ.get("SCRAPER_INTERVAL_MINUTES", 30))
HEADLESS: bool = os.environ.get("HEADLESS", "true").lower() == "true"
DORAHACKS_URL = "https://dorahacks.io/hackathon"
REDIS_HACKATHONS_CHANNEL = "hackathons:new"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("xiima.scraper")


# ─────────────────────────────────────────────
# Human simulation helpers
# ─────────────────────────────────────────────
async def _random_delay(min_s: float = 3.5, max_s: float = 8.2) -> None:
    delay = random.uniform(min_s, max_s)
    log.debug(f"Sleeping {delay:.1f}s (human simulation)")
    await asyncio.sleep(delay)


async def _simulate_scroll(page) -> None:
    """Scroll down the page in steps to trigger lazy loading."""
    total_height = await page.evaluate("document.body.scrollHeight")
    viewport_height = 800
    current = 0
    while current < total_height:
        current += random.randint(200, 500)
        await page.evaluate(f"window.scrollTo(0, {current})")
        await asyncio.sleep(random.uniform(0.2, 0.6))


# ─────────────────────────────────────────────
# Core scrape function
# ─────────────────────────────────────────────
async def scrape_dorahacks() -> list[dict]:
    log.info("Starting DoraHacks scrape run...")
    raw_cards: list[dict] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=HEADLESS,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
            ],
        )

        context = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": random.randint(1280, 1920), "height": random.randint(720, 1080)},
            locale="en-US",
            timezone_id="America/New_York",
        )

        page = await context.new_page()
        await stealth_async(page)

        try:
            await page.goto(DORAHACKS_URL, wait_until="domcontentloaded", timeout=30_000)
            await _random_delay(2.0, 4.0)
            await _simulate_scroll(page)
            await _random_delay()

            # Extract hackathon card data from the page
            raw_cards = await page.evaluate("""
                () => {
                    const cards = document.querySelectorAll('[class*="hackathon-card"], [class*="HackCard"], article');
                    return Array.from(cards).map(card => {
                        const titleEl = card.querySelector('h2, h3, [class*="title"]');
                        const prizeEl = card.querySelector('[class*="prize"], [class*="reward"]');
                        const deadlineEl = card.querySelector('[class*="deadline"], [class*="date"], time');
                        const tagEls = card.querySelectorAll('[class*="tag"], [class*="badge"]');
                        const linkEl = card.querySelector('a[href]');
                        return {
                            title: titleEl?.textContent?.trim() || '',
                            prize: prizeEl?.textContent?.trim() || '0',
                            deadline: deadlineEl?.getAttribute('datetime') || deadlineEl?.textContent?.trim() || '',
                            tags: Array.from(tagEls).map(t => t.textContent?.trim()).filter(Boolean).join(','),
                            url: linkEl?.href || '',
                        };
                    }).filter(c => c.title.length > 3);
                }
            """)

            log.info(f"Extracted {len(raw_cards)} raw cards from DoraHacks")
        except Exception as exc:
            log.error(f"Scrape error: {exc}")
        finally:
            await browser.close()

    return raw_cards


# ─────────────────────────────────────────────
# DB writer (asyncpg directly — faster than ORM for bulk upserts)
# ─────────────────────────────────────────────
async def upsert_hackathons(parsed: list) -> None:
    if not parsed:
        log.warning("No hackathons to upsert — skipping DB write")
        return

    conn = await asyncpg.connect(DATABASE_URL)
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    new_count = 0

    try:
        for h in parsed:
            # Detectar si es nuevo para publicar en Redis
            existing = await conn.fetchval(
                "SELECT id FROM hackathons WHERE id = $1", h.id
            )
            is_new = existing is None

            await conn.execute(
                """
                INSERT INTO hackathons (id, title, prize_pool, tags, deadline, match_score, source_url, source)
                VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, 'dorahacks')
                ON CONFLICT (id) DO UPDATE SET
                    title       = EXCLUDED.title,
                    prize_pool  = EXCLUDED.prize_pool,
                    tags        = EXCLUDED.tags,
                    deadline    = EXCLUDED.deadline,
                    match_score = EXCLUDED.match_score,
                    source_url  = EXCLUDED.source_url,
                    updated_at  = NOW()
                """,
                h.id, h.title, h.prize_pool,
                str(h.tags).replace("'", '"'),
                h.deadline, h.match_score, h.source_url,
            )

            if is_new:
                new_count += 1
                import json as _json
                from datetime import datetime, timezone
                await redis_client.publish(
                    REDIS_HACKATHONS_CHANNEL,
                    _json.dumps({
                        "id": h.id,
                        "title": h.title,
                        "prize_pool": h.prize_pool,
                        "tags": h.tags,
                        "deadline": h.deadline,
                        "match_score": h.match_score,
                        "source_url": h.source_url,
                        "source": "dorahacks",
                        "scraped_at": datetime.now(timezone.utc).isoformat(),
                    }),
                )

        log.info(f"✅ Upserted {len(parsed)} hackathons — {new_count} new published to Redis")
    finally:
        await conn.close()
        await redis_client.close()


# ─────────────────────────────────────────────
# Scheduled job
# ─────────────────────────────────────────────
async def run_scrape_job() -> None:
    log.info(f"🤖 Scrape job triggered (interval: {SCRAPER_INTERVAL_MINUTES}m)")
    raw = await scrape_dorahacks()
    parsed = parse_hackathon_cards(raw, DORAHACKS_URL)
    await upsert_hackathons(parsed)


# ─────────────────────────────────────────────
# Minimal health HTTP server (for docker healthcheck)
# ─────────────────────────────────────────────
class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"status":"ok","service":"xiima-scraper"}')

    def log_message(self, *_):
        pass  # suppress access logs


def _start_health_server():
    server = HTTPServer(("0.0.0.0", 9000), _HealthHandler)
    Thread(target=server.serve_forever, daemon=True).start()
    log.info("Health server listening on :9000")


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
async def main():
    _start_health_server()

    # Run immediately on startup
    await run_scrape_job()

    # Schedule recurring runs
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_scrape_job,
        "interval",
        minutes=SCRAPER_INTERVAL_MINUTES,
        id="dorahacks_scrape",
        max_instances=1,  # prevent overlapping runs
    )
    scheduler.start()
    log.info(f"Scheduler started — next run in {SCRAPER_INTERVAL_MINUTES} minutes")

    # Keep alive
    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        log.info("Scraper shut down gracefully")


if __name__ == "__main__":
    asyncio.run(main())
