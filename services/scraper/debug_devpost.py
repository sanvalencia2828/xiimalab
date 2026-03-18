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

            # Try to find the actual hackathon cards
            # Based on typical Devpost structure, cards might be in specific containers
            log.info("Looking for hackathon cards...")

            # Try various selectors that might work with current Devpost structure
            selectors_to_try = [
                '[class*="challenge"]',
                '[class*="hackathon"]',
                '[data-role="challenge"]',
                '.listing',
                '[class*="listing"]',
                '[class*="card"]',
                'a[href*="/hackathons/"]',
                '[class*="tile"]',
                '[class*="item"]'
            ]

            for selector in selectors_to_try:
                elements = await page.query_selector_all(selector)
                log.info(f"Selector '{selector}': Found {len(elements)} elements")
                if len(elements) > 0 and len(elements) < 10:
                    # Log some details about the first few elements
                    for i, elem in enumerate(elements[:3]):
                        text = await elem.text_content()
                        log.info(f"  Element {i+1} text preview: {text[:100]}...")

            # Try to get the actual challenge listings
            challenge_links = await page.query_selector_all('a[href*="/hackathons/"]')
            log.info(f"Found {len(challenge_links)} challenge links")

            if challenge_links:
                for i, link in enumerate(challenge_links[:5]):
                    href = await link.get_attribute('href')
                    text = await link.text_content()
                    log.info(f"  Link {i+1}: {text[:50]}... -> {href}")

            # Try to find elements with specific attributes
            title_elements = await page.query_selector_all('[class*="title"], h2, h3')
            log.info(f"Found {len(title_elements)} title elements")

            # Try to find prize elements
            prize_elements = await page.query_selector_all('[class*="prize"], [class*="reward"]')
            log.info(f"Found {len(prize_elements)} prize elements")

        except Exception as exc:
            log.error(f"Devpost debug error: {exc}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_devpost())