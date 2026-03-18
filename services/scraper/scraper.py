"""
Xiimalab Scraper — Modular Orchestrator
Schedules and runs multiple hackathon scraper integrations:
- Devfolio (MCP API)
- DoraHacks (Playwright)
- Devpost (Playwright)

Autonomous ML Pipeline:
- Automatically triggers AI analysis for all active hackathons after sync.
"""
import asyncio
import json
import logging
import os
import httpx
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread

import asyncpg
import redis.asyncio as aioredis
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Import integrations
from integrations import devfolio, dorahacks, devpost

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql://xiima:secret@localhost:5432/xiimalab"
)
REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
SCRAPER_INTERVAL_MINUTES: int = int(os.environ.get("SCRAPER_INTERVAL_MINUTES", 30))
API_URL: str = os.environ.get("NEXT_PUBLIC_API_URL", "http://localhost:8000")
HEADLESS: bool = os.environ.get("HEADLESS", "true").lower() == "true"
DORAHACKS_URL = "https://dorahacks.io/hackathon"
REDIS_HACKATHONS_CHANNEL = "hackathons:new"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("xiima.scraper")

# ─────────────────────────────────────────────
# DB Engine
# ─────────────────────────────────────────────
async def upsert_hackathons(items: list[dict]) -> None:
    if not items:
        return

    conn = await asyncpg.connect(DATABASE_URL)
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    new_count = 0

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

        # Publish new hackathons to Redis channel
        from datetime import datetime, timezone
        for item in items:
            await redis_client.publish(
                REDIS_HACKATHONS_CHANNEL,
                json.dumps({
                    "id": item["id"],
                    "title": item["title"],
                    "prize_pool": item["prize_pool"],
                    "tags": item["tags"],
                    "deadline": item["deadline"],
                    "match_score": item["match_score"],
                    "source_url": item["source_url"],
                    "source": item["source"],
                    "scraped_at": datetime.now(timezone.utc).isoformat(),
                }),
            )

        log.info(f"✅ Successfully upserted {len(items)} hackathons to PostgreSQL")
    except Exception as e:
        log.error(f"❌ DB Upsert Error: {e}")
    finally:
        await conn.close()
        await redis_client.close()

# ─────────────────────────────────────────────
# ML Pipeline Automation
# ─────────────────────────────────────────────
async def trigger_ai_analysis(items: list[dict]):
    """Call the API analyze endpoint for each newly found hackathon."""
    if not items:
        return
    
    log.info(f"🧠 Triggering AI analysis for {len(items)} items...")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        for item in items:
            try:
                # We use the internal API URL
                analyze_url = f"{API_URL}/analyze/hackathon"
                payload = {
                    "id": item["id"],
                    "title": item["title"],
                    "tags": item["tags"],
                    "prize_pool": item["prize_pool"],
                    "description": "" # description will be fetched by engine if needed or kept empty
                }
                resp = await client.post(analyze_url, json=payload)
                if resp.status_code == 200:
                    log.info(f"  ✅ Analysis synced for: {item['title'][:30]}...")
                else:
                    log.error(f"  ❌ Analysis failed for {item['id']}: {resp.status_code}")
            except Exception as e:
                log.error(f"  ⚠️ Error triggering analysis for {item['id']}: {e}")

# ─────────────────────────────────────────────
# Core Job
# ─────────────────────────────────────────────
async def run_all_scrapers():
    log.info("🚀 Starting full scraper synchronization...")
    
    tasks = [
        ("Devfolio", devfolio.run()),
        ("DoraHacks", dorahacks.run()),
        ("Devpost", devpost.run())
    ]
    
    all_hackathons = []
    
    for name, coro in tasks:
        try:
            log.info(f"Running {name} integration...")
            items = await coro
            log.info(f"Found {len(items)} hackathons from {name}")
            all_hackathons.extend(items)
        except Exception as e:
            log.error(f"Error in {name} integration: {e}")

    if all_hackathons:
        await upsert_hackathons(all_hackathons)
        # Automate the ML analysis
        await trigger_ai_analysis(all_hackathons)
    else:
        log.warning("No hackathons found in any integration.")

# ─────────────────────────────────────────────
# Health & Sync Server
# ─────────────────────────────────────────────
_scheduler: AsyncIOScheduler | None = None
_loop: asyncio.AbstractEventLoop | None = None

class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"status":"ok","service":"xiima-scraper-modular"}')

    def do_POST(self):
        if self.path == "/sync":
            log.info("📡 Manual sync requested via API...")
            if _scheduler and _loop:
                try:
                    # Trigger the job immediately
                    _loop.call_soon_threadsafe(lambda: _scheduler.get_job("full_sync").modify(next_run_time=None))
                    self.send_response(202)
                    self.end_headers()
                    self.wfile.write(b'{"status":"sync_triggered"}')
                except Exception as e:
                    self.send_response(500)
                    self.end_headers()
                    self.wfile.write(f'{{"error":"{str(e)}"}}'.encode())
            else:
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b'{"error":"scheduler_not_initialized"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *_): pass

def _start_health_server():
    server = HTTPServer(("0.0.0.0", 9000), _HealthHandler)
    Thread(target=server.serve_forever, daemon=True).start()
    log.info("Health & Sync server listening on port 9000")

# ─────────────────────────────────────────────
# Main Entry Point
# ─────────────────────────────────────────────
async def main():
    global _scheduler, _loop
    _loop = asyncio.get_running_loop()
    _start_health_server()

    # Initial run
    await run_all_scrapers()

    # Scheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        run_all_scrapers,
        "interval",
        minutes=SCRAPER_INTERVAL_MINUTES,
        id="full_sync",
        max_instances=1
    )
    _scheduler.start()
    log.info(f"Scheduler active. Sync interval: {SCRAPER_INTERVAL_MINUTES} minutes.")

    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, SystemExit):
        _scheduler.shutdown()
        log.info("Scraper shutdown.")

if __name__ == "__main__":
    asyncio.run(main())
