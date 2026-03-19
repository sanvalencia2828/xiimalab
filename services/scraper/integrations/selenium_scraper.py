"""
Selenium Advanced Scraper — Xiimalab
====================================
Scraper multi-fuente usando Selenium con:
- Rotación de User Agents
- Manejo de CAPTCHAs
- Extracción inteligente de datos
- Rate limiting respetuoso
"""
import asyncio
import logging
import os
import random
import re
import time
from dataclasses import dataclass
from typing import Optional

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.common.exceptions import (
        TimeoutException, 
        NoSuchElementException,
        WebDriverException
    )
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False

log = logging.getLogger("xiima.scraper.selenium")

# ─────────────────────────────────────────────
# Configuración
# ─────────────────────────────────────────────
HEADLESS = os.environ.get("HEADLESS", "true").lower() == "true"
SELENIUM_TIMEOUT = int(os.environ.get("SELENIUM_TIMEOUT", "30"))

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

# ─────────────────────────────────────────────
# Fuentes de Hackathons
# ─────────────────────────────────────────────
HACKATHON_SOURCES = {
    "dorahacks": {
        "url": "https://dorahacks.io/hackathon",
        "selectors": {
            "card": "[class*='hackathon'], [class*='HackCard'], article",
            "title": "h2, h3, [class*='title'], [class*='name']",
            "prize": "[class*='prize'], [class*='reward'], [class*='bounty']",
            "deadline": "[class*='deadline'], [class*='date'], time",
            "tags": "[class*='tag'], [class*='badge'], [class*='track']",
            "link": "a[href*='hackathon']",
        },
        "parse_prize": lambda x: _parse_prize_generic(x),
    },
    "devfolio": {
        "url": "https://devfolio.co/discover",
        "selectors": {
            "card": "[class*='CollectionCard'], [class*='HackathonCard']",
            "title": "h2, h3, [class*='title']",
            "prize": "[class*='prize'], [class*='reward']",
            "deadline": "[class*='deadline'], [class*='ends']",
            "tags": "[class*='tag'], [class*='track']",
            "link": "a[href*='hackathon']",
        },
        "parse_prize": lambda x: _parse_prize_generic(x),
    },
    "devpost": {
        "url": "https://devpost.com/hackathons",
        "selectors": {
            "card": "[class*='hackathon'], .challenge-listing",
            "title": "h2, h3, .challenge-title",
            "prize": "[class*='prize'], [class*='amount']",
            "deadline": "[class*='deadline'], .submission-period",
            "tags": "[class*='tag'], [class*='theme']",
            "link": "a[href*='challenge']",
        },
        "parse_prize": lambda x: _parse_prize_generic(x),
    },
}


# ─────────────────────────────────────────────
# Funciones de Parsing
# ─────────────────────────────────────────────
def _parse_prize_generic(text: str) -> int:
    """Parse genérico para premios de hackathon."""
    if not text:
        return 0
    
    # Limpiar texto
    text = text.upper()
    text = re.sub(r"[^\dKMB]", "", text)
    
    # Buscar número con sufijo
    match = re.search(r"(\d+(?:\.\d+)?)\s*([KMB]?)", text)
    if not match:
        return 0
    
    value = float(match.group(1))
    suffix = match.group(2)
    
    multipliers = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
    return int(value * multipliers.get(suffix, 1))


def _parse_deadline(text: str) -> str:
    """Parse de deadline a formato ISO."""
    if not text:
        return "2099-12-31"
    
    # Intentar diferentes formatos
    from datetime import datetime, timedelta
    
    formats = ["%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%d/%m/%Y", "%m/%d/%Y"]
    text = text.strip()
    
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    
    # Si contiene "days" o similar
    days_match = re.search(r"(\d+)\s*days?", text, re.I)
    if days_match:
        days = int(days_match.group(1))
        return (datetime.now() + timedelta(days=days)).date().isoformat()
    
    return "2099-12-31"


def _make_stable_id(title: str, source: str) -> str:
    """Genera ID estable a partir del título."""
    import hashlib
    raw = f"{source}:{title.lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()[:16]


# ─────────────────────────────────────────────
# Selenium Driver Manager
# ─────────────────────────────────────────────
class SeleniumDriver:
    """Manager de Selenium WebDriver con reconexión automática."""
    
    _instance: Optional["SeleniumDriver"] = None
    _driver = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def get_driver(self):
        """Obtiene o crea el WebDriver."""
        if not SELENIUM_AVAILABLE:
            raise RuntimeError("Selenium not installed. Run: pip install selenium")
        
        if self._driver is None:
            options = Options()
            if HEADLESS:
                options.add_argument("--headless=new")
            
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--window-size=1920,1080")
            options.add_argument(f"--user-agent={random.choice(USER_AGENTS)}")
            
            # Anti-detección
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option("useAutomationExtension", False)
            
            self._driver = webdriver.Chrome(options=options)
            self._driver.execute_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )
        
        return self._driver
    
    def close(self):
        """Cierra el WebDriver."""
        if self._driver:
            self._driver.quit()
            self._driver = None
    
    def __del__(self):
        self.close()


# ─────────────────────────────────────────────
# Scraper Functions
# ─────────────────────────────────────────────
async def scrape_source(source_name: str, source_config: dict) -> list[dict]:
    """
    Scrapea una fuente específica de hackathons.
    
    Args:
        source_name: Nombre de la fuente (dorahacks, devfolio, etc.)
        source_config: Configuración con URL y selectores
        
    Returns:
        Lista de hackathons encontrados
    """
    if not SELENIUM_AVAILABLE:
        log.warning(f"Selenium not available, skipping {source_name}")
        return []
    
    log.info(f"🔍 Scraping {source_name}...")
    results = []
    driver_manager = SeleniumDriver()
    
    try:
        driver = driver_manager.get_driver()
        wait = WebDriverWait(driver, SELENIUM_TIMEOUT)
        
        # Navegar a la página
        driver.get(source_config["url"])
        await asyncio.sleep(random.uniform(2, 4))
        
        # Scroll para cargar contenido lazy
        await _scroll_page(driver)
        
        # Esperar a que carguen las cards
        try:
            wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, source_config["selectors"]["card"]))
            )
        except TimeoutException:
            log.warning(f"⏱️ Timeout waiting for cards on {source_name}")
        
        # Extraer datos
        cards = driver.find_elements(By.CSS_SELECTOR, source_config["selectors"]["card"])
        log.info(f"📦 Found {len(cards)} cards on {source_name}")
        
        for card in cards:
            try:
                item = _extract_card_data(card, source_config, source_name)
                if item and item.get("title"):
                    results.append(item)
            except Exception as e:
                log.debug(f"Error extracting card: {e}")
                continue
        
        # Detectar y manejar CAPTCHA
        if await _check_captcha(driver):
            log.warning(f"⚠️ CAPTCHA detected on {source_name}")
            await _handle_captcha(driver)
        
    except WebDriverException as e:
        log.error(f"❌ WebDriver error on {source_name}: {e}")
        driver_manager.close()
    except Exception as e:
        log.error(f"❌ Unexpected error on {source_name}: {e}")
    finally:
        # No cerrar el driver para reutilizarlo
        pass
    
    return results


async def _scroll_page(driver) -> None:
    """Hace scroll gradual para cargar contenido lazy."""
    last_height = driver.execute_script("return document.body.scrollHeight")
    
    for _ in range(5):  # Max 5 scrolls
        # Scroll down
        driver.execute_script(
            f"window.scrollTo(0, {last_height});"
        )
        await asyncio.sleep(random.uniform(1, 2))
        
        # Scroll up un poco para activar lazy load
        driver.execute_script(
            f"window.scrollTo(0, {last_height - 500});"
        )
        await asyncio.sleep(random.uniform(0.5, 1))
        
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height


async def _check_captcha(driver) -> bool:
    """Detecta si hay un CAPTCHA en la página."""
    captcha_selectors = [
        "[class*='captcha']",
        "[id*='captcha']",
        "[class*='challenge']",  # Google Challenge
        "iframe[src*='captcha']",
    ]
    
    for selector in captcha_selectors:
        try:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            if elements:
                return True
        except:
            continue
    return False


async def _handle_captcha(driver) -> None:
    """Maneja CAPTCHA esperando o tomando acción."""
    # Esperar a ver si se resuelve solo (reCAPTCHA v2 a veces)
    await asyncio.sleep(10)
    
    # Si sigue ahí, loguear pero continuar
    log.warning("⚠️ CAPTCHA presente, intentando continuar...")


def _extract_card_data(card, source_config: dict, source_name: str) -> Optional[dict]:
    """Extrae datos de una card de hackathon."""
    selectors = source_config["selectors"]
    
    # Title
    title = _safe_extract(card, selectors.get("title", "h2, h3"))
    
    # Prize
    prize_text = _safe_extract(card, selectors.get("prize", "[class*='prize']"))
    prize = source_config["parse_prize"](prize_text or "")
    
    # Deadline
    deadline_text = _safe_extract(card, selectors.get("deadline", "[class*='deadline']"))
    deadline = _parse_deadline(deadline_text or "")
    
    # Tags
    tags_elements = card.find_elements(By.CSS_SELECTOR, selectors.get("tags", "[class*='tag']"))
    tags = [t.text.strip() for t in tags_elements if t.text.strip()]
    
    # URL
    link = card.find_element(By.CSS_SELECTOR, selectors.get("link", "a[href]"))
    url = link.get_attribute("href") if link else ""
    
    if not title:
        return None
    
    return {
        "id": _make_stable_id(title, source_name),
        "title": title.strip(),
        "prize_pool": prize,
        "tags": tags,
        "deadline": deadline,
        "match_score": 0,  # Se calcula después con parser.py
        "source_url": url,
        "source": source_name,
    }


def _safe_extract(parent, selector: str) -> Optional[str]:
    """Extrae texto de forma segura."""
    try:
        element = parent.find_element(By.CSS_SELECTOR, selector)
        return element.text.strip()
    except NoSuchElementException:
        return None


# ─────────────────────────────────────────────
# Multi-Source Scraper
# ─────────────────────────────────────────────
async def scrape_all() -> list[dict]:
    """
    Scrapea todas las fuentes configuradas.
    
    Returns:
        Lista combinada de todos los hackathons
    """
    log.info("🚀 Starting multi-source scrape...")
    all_hackathons = []
    
    # Ejecutar todas las fuentes en paralelo
    tasks = [
        scrape_source(name, config)
        for name, config in HACKATHON_SOURCES.items()
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    for source_name, result in zip(HACKATHON_SOURCES.keys(), results):
        if isinstance(result, Exception):
            log.error(f"❌ Error in {source_name}: {result}")
        else:
            log.info(f"✅ {source_name}: {len(result)} hackathons")
            all_hackathons.extend(result)
    
    # Deduplicar por ID
    seen = set()
    unique = []
    for h in all_hackathons:
        if h["id"] not in seen:
            seen.add(h["id"])
            unique.append(h)
    
    log.info(f"📊 Total unique hackathons: {len(unique)}")
    return unique


async def run():
    """Ejecuta el scraper y retorna los resultados."""
    return await scrape_all()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())
