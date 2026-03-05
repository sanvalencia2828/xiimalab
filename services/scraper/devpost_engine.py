"""
Devpost Scraper — Playwright + stealth, infinite scroll.

Anti-detection techniques (mirrors DoraHacks scraper):
  - playwright-stealth to mask WebDriver fingerprints
  - Random User-Agent rotation
  - Randomized delay between actions (2.5–7.0 s)
  - Viewport randomization
  - Simulated human scroll to trigger lazy-load / infinite scroll

Extracts: title, prize_pool (USD), deadline, tags[], source_url
Saves to hackathons table with source='devpost'.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import re
import uuid
from datetime import datetime, timezone

import asyncpg
from playwright.async_api import Page, async_playwright
from playwright_stealth import stealth_async

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql://xiima:secret@localhost:5432/xiimalab"
)
HEADLESS: bool = os.environ.get("HEADLESS", "true").lower() == "true"
DEVPOST_URL = "https://devpost.com/hackathons?challenge_type=all&status=open"
MAX_SCROLL_ROUNDS = 15          # safety cap on infinite scroll
SCROLL_PAUSE = (1.5, 3.5)       # seconds between scroll steps

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("xiima.devpost")


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
async def _random_delay(min_s: float = 2.5, max_s: float = 7.0) -> None:
    delay = random.uniform(min_s, max_s)
    log.debug(f"Sleeping {delay:.1f}s")
    await asyncio.sleep(delay)


def _parse_prize(raw: str) -> int:
    """Extract integer USD value from strings like '$50,000', '50K', '€20.000'."""
    if not raw:
        return 0
    raw = raw.upper().replace(",", "").replace(".", "")
    # Handle K / M suffixes
    m = re.search(r"(\d+(?:\.\d+)?)\s*([KM]?)", raw)
    if not m:
        return 0
    value = float(m.group(1))
    suffix = m.group(2)
    if suffix == "K":
        value *= 1_000
    elif suffix == "M":
        value *= 1_000_000
    return int(value)


def _parse_deadline(raw: str) -> str:
    """Normalize various date strings to ISO YYYY-MM-DD."""
    raw = raw.strip()
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Fallback: return as-is (may already be ISO)
    return raw[:10] if raw else "2099-12-31"


def _generate_id(title: str, url: str) -> str:
    """Stable ID: SHA-like from title+url slug."""
    slug = re.sub(r"[^a-z0-9]", "-", (title + url).lower())[:60]
    return f"devpost-{slug}"


# ─────────────────────────────────────────────
# Infinite-scroll extractor
# ─────────────────────────────────────────────
async def _extract_cards_js(page: Page) -> list[dict]:
    """Run JS extraction inside the browser context."""
    return await page.evaluate("""
        () => {
            const cards = document.querySelectorAll(
                'article.challenge-listing, .challenge-listing, [data-challenge-id]'
            );
            return Array.from(cards).map(card => {
                const titleEl = card.querySelector(
                    'h2.challenge-title, h3.challenge-title, [class*="title"] h2, [class*="title"] h3'
                );
                const prizeEl  = card.querySelector('[class*="prize"], [class*="total-prizes"], [class*="amount"]');
                const dateEl   = card.querySelector('time, [class*="deadline"], [class*="submission"]');
                const tagEls   = card.querySelectorAll('[class*="tag"], [class*="platform-tag"], [class*="category"]');
                const linkEl   = card.querySelector('a.challenge-title, a[href*="/hackathons/"]');
                return {
                    title:    titleEl?.textContent?.trim() ?? '',
                    prize:    prizeEl?.textContent?.trim()  ?? '0',
                    deadline: dateEl?.getAttribute('datetime') ?? dateEl?.textContent?.trim() ?? '',
                    tags:     Array.from(tagEls).map(t => t.textContent?.trim()).filter(Boolean),
                    url:      linkEl?.href ?? '',
                };
            }).filter(c => c.title.length > 3);
        }
    """)


async def _infinite_scroll(page: Page) -> list[dict]:
    """Keep scrolling to bottom until no new cards appear (or MAX_SCROLL_ROUNDS reached)."""
    seen_titles: set[str] = set()
    all_cards: list[dict] = []

    for round_num in range(1, MAX_SCROLL_ROUNDS + 1):
        cards = await _extract_cards_js(page)
        new_cards = [c for c in cards if c["title"] not in seen_titles]

        if not new_cards and round_num > 1:
            log.info(f"  No new cards after scroll round {round_num} — stopping.")
            break

        for c in new_cards:
            seen_titles.add(c["title"])
            all_cards.append(c)

        log.info(f"  Scroll round {round_num}: +{len(new_cards)} cards (total {len(all_cards)})")

        # Scroll to bottom
        prev_height = await page.evaluate("document.body.scrollHeight")
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(random.uniform(*SCROLL_PAUSE))

        new_height = await page.evaluate("document.body.scrollHeight")
        if new_height == prev_height and round_num > 2:
            log.info("  Page height unchanged — end of feed reached.")
            break

    return all_cards


# ─────────────────────────────────────────────
# Main scrape function
# ─────────────────────────────────────────────
async def scrape_devpost() -> list[dict]:
    log.info("🚀 Starting Devpost scrape run…")
    results: list[dict] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=HEADLESS,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ],
        )
        context = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={
                "width": random.randint(1280, 1920),
                "height": random.randint(720, 1080),
            },
            locale="en-US",
            timezone_id="America/New_York",
            extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
        )
        page = await context.new_page()
        await stealth_async(page)

        try:
            log.info(f"Navigating to {DEVPOST_URL}")
            await page.goto(DEVPOST_URL, wait_until="domcontentloaded", timeout=45_000)
            await _random_delay(2.0, 4.0)

            # Click "Load more" or scroll to trigger dynamic content
            results = await _infinite_scroll(page)
            log.info(f"✅ Extracted {len(results)} hackathons from Devpost")
        except Exception as exc:
            log.error(f"Devpost scrape error: {exc}", exc_info=True)
        finally:
            await browser.close()

    return results


# ─────────────────────────────────────────────
# Parse raw cards → structured dicts
# ─────────────────────────────────────────────
def parse_devpost_cards(raw_cards: list[dict]) -> list[dict]:
    parsed = []
    for card in raw_cards:
        title = card.get("title", "").strip()
        if not title:
            continue

        url = card.get("url", "")
        parsed.append({
            "id": _generate_id(title, url),
            "title": title,
            "prize_pool": _parse_prize(card.get("prize", "0")),
            "tags": card.get("tags", []),
            "deadline": _parse_deadline(card.get("deadline", "")),
            "match_score": 0,   # will be updated by AI engine
            "source_url": url,
            "source": "devpost",
        })
    return parsed


# ─────────────────────────────────────────────
# DB upsert (asyncpg — fast bulk write)
# ─────────────────────────────────────────────
async def upsert_devpost_hackathons(items: list[dict]) -> None:
    if not items:
        log.warning("No Devpost hackathons to upsert — skipping.")
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
        log.info(f"✅ Upserted {len(items)} Devpost hackathons to PostgreSQL")
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# Entry point (standalone run)
# ─────────────────────────────────────────────
async def run_devpost_job() -> None:
    raw = await scrape_devpost()
    parsed = parse_devpost_cards(raw)
    await upsert_devpost_hackathons(parsed)


if __name__ == "__main__":
    asyncio.run(run_devpost_job())
