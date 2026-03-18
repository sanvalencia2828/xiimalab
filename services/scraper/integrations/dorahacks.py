import asyncio
import logging
import os
import random
import re
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

log = logging.getLogger("xiima.scraper.dorahacks")

DORAHACKS_URL = "https://dorahacks.io/hackathon"
HEADLESS: bool = os.environ.get("HEADLESS", "true").lower() == "true"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

async def _random_delay(min_s: float = 2.5, max_s: float = 6.0) -> None:
    await asyncio.sleep(random.uniform(min_s, max_s))

async def _simulate_scroll(page) -> None:
    total_height = await page.evaluate("document.body.scrollHeight")
    current = 0
    while current < total_height:
        current += random.randint(300, 600)
        await page.evaluate(f"window.scrollTo(0, {current})")
        await asyncio.sleep(random.uniform(0.3, 0.7))

async def scrape() -> list[dict]:
    """Scrape DoraHacks using Playwright."""
    log.info("Starting DoraHacks Playwright scrape...")
    results = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=HEADLESS,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": random.randint(1280, 1920), "height": random.randint(720, 1080)}
        )
        page = await context.new_page()
        # Apply stealth to the page using the new API
        stealth = Stealth()
        await stealth.apply_stealth_async(page)

        try:
            await page.goto(DORAHACKS_URL, wait_until="domcontentloaded", timeout=45_000)
            await _random_delay(3.0, 5.0)
            await _simulate_scroll(page)

            # Extraction logic migrated from scraper.py
            results = await page.evaluate("""
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
            log.info(f"Extracted {len(results)} items from DoraHacks")
        except Exception as exc:
            log.error(f"DoraHacks scrape error: {exc}")
        finally:
            await browser.close()

    return results

def _parse_prize(raw: str) -> int:
    if not raw: return 0
    raw = raw.upper().replace(",", "").replace(".", "")
    m = re.search(r"(\d+(?:\.\d+)?)\s*([KM]?)", raw)
    if not m: return 0
    value = float(m.group(1))
    if m.group(2) == "K": value *= 1000
    if m.group(2) == "M": value *= 1000000
    return int(value)

def parse(raw_items: list[dict]) -> list[dict]:
    parsed = []
    for item in raw_items:
        title = item.get("title", "").strip()
        if not title: continue

        url = item.get("url", "")
        # Generate stable ID
        slug = re.sub(r"[^a-z0-9]", "-", (title + url).lower())[:60]

        parsed.append({
            "id": f"dorahacks-{slug}",
            "title": title,
            "prize_pool": _parse_prize(item.get("prize", "0")),
            "tags": item.get("tags", "").split(",") if item.get("tags") else [],
            "deadline": item.get("deadline", "")[:10] if item.get("deadline") else "2099-12-31",
            "match_score": 0,
            "source_url": url,
            "source": "dorahacks"
        })
    return parsed

async def run():
    raw = await scrape()
    if raw:
        return parse(raw)
    return []

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())