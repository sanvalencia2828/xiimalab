import asyncio
import logging
import os
import random
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("debug.devpost")

async def debug_devpost():
    DEVPOST_URL = "https://devpost.com/hackathons?challenge_type=all&status=open"
    HEADLESS: bool = os.environ.get("HEADLESS", "true").lower() == "true"

    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ]

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
            log.info("Navigating to Devpost...")
            await page.goto(DEVPOST_URL, wait_until="domcontentloaded", timeout=45_000)
            await asyncio.sleep(5)  # Wait for content to load

            # Take a screenshot to see what's loaded
            await page.screenshot(path="devpost_debug.png", full_page=True)
            log.info("Screenshot saved as devpost_debug.png")

            # Try different selectors to see what's available
            log.info("Trying different selectors...")

            # Try the original selectors
            cards = await page.query_selector_all('article.challenge-listing, .challenge-listing, [data-challenge-id]')
            log.info(f"Found {len(cards)} cards with original selectors")

            # Try simpler selectors
            simple_cards = await page.query_selector_all('article, [class*="challenge"], [class*="hackathon"]')
            log.info(f"Found {len(simple_cards)} cards with simple selectors")

            # Try looking for any listing elements
            listing_elements = await page.query_selector_all('[class*="listing"], [class*="card"], [class*="item"]')
            log.info(f"Found {len(listing_elements)} listing elements")

            # Print page title
            title = await page.title()
            log.info(f"Page title: {title}")

            # Print some HTML content for debugging
            html_content = await page.content()
            log.info(f"Page content length: {len(html_content)}")

            # Look for specific text that should be on the page
            if "hackathon" in html_content.lower():
                log.info("Found 'hackathon' text in page content")
            else:
                log.info("Did not find 'hackathon' text in page content")

        except Exception as exc:
            log.error(f"Devpost debug error: {exc}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_devpost())