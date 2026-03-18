import asyncio
import logging
import os
import random
import re
from playwright.async_api import Page, async_playwright
from playwright_stealth import Stealth

log = logging.getLogger("xiima.scraper.devpost")

DEVPOST_URL = "https://devpost.com/hackathons?challenge_type=all&status=open"
HEADLESS: bool = os.environ.get("HEADLESS", "true").lower() == "true"
MAX_SCROLL_ROUNDS = 10
SCROLL_PAUSE = (1.5, 3.5)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

async def _extract_cards_js(page: Page) -> list[dict]:
    return await page.evaluate("""
        () => {
            const cards = document.querySelectorAll('article.challenge-listing, .challenge-listing, [data-challenge-id]');
            return Array.from(cards).map(card => {
                const titleEl = card.querySelector('h2.challenge-title, h3.challenge-title, [class*="title"] h2, [class*="title"] h3');
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

async def scrape() -> list[dict]:
    log.info("Starting Devpost Playwright scrape...")
    all_cards = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=HEADLESS,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()
        # Apply stealth to the page using the new API
        stealth = Stealth()
        await stealth.apply_stealth_async(page)

        try:
            await page.goto(DEVPOST_URL, wait_until="domcontentloaded", timeout=45_000)
            await asyncio.sleep(3)

            seen_titles = set()
            for r in range(MAX_SCROLL_ROUNDS):
                cards = await _extract_cards_js(page)
                new_found = 0
                for c in cards:
                    if c["title"] not in seen_titles:
                        seen_titles.add(c["title"])
                        all_cards.append(c)
                        new_found += 1

                if new_found == 0 and r > 1: break

                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(random.uniform(*SCROLL_PAUSE))

            log.info(f"Extracted {len(all_cards)} items from Devpost")
        except Exception as exc:
            log.error(f"Devpost scrape error: {exc}")
        finally:
            await browser.close()

    return all_cards

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
        slug = re.sub(r"[^a-z0-9]", "-", (title + url).lower())[:60]
        parsed.append({
            "id": f"devpost-{slug}",
            "title": title,
            "prize_pool": _parse_prize(item.get("prize", "0")),
            "tags": item.get("tags", []),
            "deadline": item.get("deadline", "")[:10] if item.get("deadline") else "2099-12-31",
            "match_score": 0,
            "source_url": url,
            "source": "devpost"
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

        try:
            await page.goto(DEVPOST_URL, wait_until="domcontentloaded", timeout=45_000)
            await asyncio.sleep(3)
            
            seen_titles = set()
            for r in range(MAX_SCROLL_ROUNDS):
                cards = await _extract_cards_js(page)
                new_found = 0
                for c in cards:
                    if c["title"] not in seen_titles:
                        seen_titles.add(c["title"])
                        all_cards.append(c)
                        new_found += 1
                
                if new_found == 0 and r > 1: break
                
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(random.uniform(*SCROLL_PAUSE))
                
            log.info(f"Extracted {len(all_cards)} items from Devpost")
        except Exception as exc:
            log.error(f"Devpost scrape error: {exc}")
        finally:
            await browser.close()
            
    return all_cards

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
        slug = re.sub(r"[^a-z0-9]", "-", (title + url).lower())[:60]
        parsed.append({
            "id": f"devpost-{slug}",
            "title": title,
            "prize_pool": _parse_prize(item.get("prize", "0")),
            "tags": item.get("tags", []),
            "deadline": item.get("deadline", "")[:10] if item.get("deadline") else "2099-12-31",
            "match_score": 0,
            "source_url": url,
            "source": "devpost"
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
