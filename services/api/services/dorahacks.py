"""
DoraHacks Scraper Service
Fetches hackathons from DoraHacks.io and extracts structured data.
"""
import hashlib
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

import httpx

log = logging.getLogger("xiima.dorahacks_scraper")

DORAHACKS_BASE_URL = "https://dorahacks.com"
DORAHACKS_API_URL = "https://dorahacks.io/hackathon"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://dorahacks.io/",
}


@dataclass
class DoraHackathon:
    """Structured hackathon data from DoraHacks."""
    id: str
    title: str
    description: Optional[str]
    prize_pool: int
    deadline: str
    tags: list[str]
    source_url: str
    source: str = "dorahacks"
    match_score: int = 0
    tech_stack: Optional[list[str]] = None
    difficulty: Optional[str] = None
    organizer: Optional[str] = None
    city: Optional[str] = None
    event_type: Optional[str] = None
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "prize_pool": self.prize_pool,
            "deadline": self.deadline,
            "tags": self.tags,
            "source_url": self.source_url,
            "source": self.source,
            "match_score": self.match_score,
            "tech_stack": self.tech_stack,
            "difficulty": self.difficulty,
            "organizer": self.organizer,
            "city": self.city,
            "event_type": self.event_type,
        }


def generate_hackathon_id(title: str) -> str:
    """Generate deterministic ID from title."""
    return hashlib.md5(title.lower().encode()).hexdigest()[:12]


def extract_prize_amount(prize_text: str) -> int:
    """Extract prize amount from text like '$50,000' or '50k USD'."""
    if not prize_text:
        return 0
    
    prize_text = prize_text.upper().replace(",", "").replace(" ", "")
    
    patterns = [
        r"\$?(\d+)\s*K\s*USD",
        r"\$?(\d+)\s*K",
        r"\$(\d+)",
        r"(\d+)\s*K",
        r"(\d+)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, prize_text)
        if match:
            amount = int(match.group(1))
            if "K" in prize_text.upper():
                amount *= 1000
            return amount
    
    return 0


def extract_deadline(date_text: str) -> str:
    """Extract and normalize deadline date."""
    if not date_text:
        return datetime.now().strftime("%Y-%m-%d")
    
    date_text = date_text.strip()
    
    date_patterns = [
        (r"(\d{4})-(\d{2})-(\d{2})", "%Y-%m-%d"),
        (r"(\d{2})/(\d{2})/(\d{4})", "%m/%d/%Y"),
        (r"(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})", "%d %b %Y"),
    ]
    
    for pattern, date_format in date_patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            try:
                parsed = datetime.strptime(date_text, date_format)
                return parsed.strftime("%Y-%m-%d")
            except ValueError:
                continue
    
    return datetime.now().strftime("%Y-%m-%d")


def extract_tags(text: str) -> list[str]:
    """Extract skill tags from hackathon text."""
    if not text:
        return []
    
    text_lower = text.lower()
    tags = []
    
    skill_keywords = {
        "AI": ["ai", "artificial intelligence", "machine learning", "ml", "llm", "gpt", "openai", "deep learning"],
        "Blockchain": ["blockchain", "web3", "web 3", "crypto", "defi", "nft", "defi", "smart contract"],
        "Python": ["python"],
        "Rust": ["rust"],
        "Solidity": ["solidity", "ethereum", "evm"],
        "JavaScript": ["javascript", "js", "node", "nodejs"],
        "TypeScript": ["typescript", "ts"],
        "React": ["react"],
        "Next.js": ["nextjs", "next.js", "next"],
        "Data Science": ["data science", "data analytics", "analytics", "pandas", "numpy"],
        "Cloud": ["aws", "gcp", "azure", "cloud", "docker", "kubernetes"],
        "IoT": ["iot", "internet of things", "embedded"],
        "AR/VR": ["ar", "vr", "metaverse", "xr", "virtual reality", "augmented"],
        "Security": ["security", "cybersecurity", "cryptography", "zkp"],
        "Social Good": ["social good", "sustainability", "climate", "healthcare"],
    }
    
    for skill, keywords in skill_keywords.items():
        if any(kw in text_lower for kw in keywords):
            tags.append(skill)
    
    return tags[:6]


async def fetch_dorahacks_api() -> list[dict[str, Any]]:
    """
    Fetch hackathons from DoraHacks API/GraphQL endpoint.
    Falls back to web scraping if API is unavailable.
    """
    async with httpx.AsyncClient(timeout=30.0, headers=HEADERS) as client:
        try:
            response = await client.get(
                "https://api.dorahacks.com/v1/hackathon/list",
                params={
                    "status": "ongoing",
                    "page": 1,
                    "pageSize": 50,
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if "data" in data and "hackathons" in data["data"]:
                    return data["data"]["hackathons"]
                elif isinstance(data, list):
                    return data
                    
        except httpx.RequestError as exc:
            log.warning(f"DoraHacks API request failed: {exc}")
        
        return []


async def scrape_dorahacks_page() -> list[dict[str, Any]]:
    """Fallback web scraper for DoraHacks."""
    hackathons = []
    
    async with httpx.AsyncClient(timeout=30.0, headers=HEADERS) as client:
        try:
            response = await client.get(DORAHACKS_API_URL)
            response.raise_for_status()
            
            html = response.text
            
            json_pattern = r'window\.__INITIAL_STATE__\s*=\s*({.*?});'
            match = re.search(json_pattern, html, re.DOTALL)
            
            if match:
                try:
                    state = json.loads(match.group(1))
                    if "hackathons" in state:
                        return state["hackathons"]
                except json.JSONDecodeError:
                    pass
            
            script_pattern = r'"id"\s*:\s*["\']?([\w-]+)["\']?[^}]*"title"\s*:\s*"([^"]+)"'
            matches = re.findall(script_pattern, html)
            
            for hack_id, title in matches:
                hackathons.append({
                    "id": hack_id,
                    "title": title,
                    "description": "",
                    "prize": 0,
                    "deadline": "",
                    "source_url": f"{DORAHACKS_BASE_URL}/hackathon/{hack_id}",
                })
                
        except httpx.RequestError as exc:
            log.error(f"DoraHacks page scrape failed: {exc}")
    
    return hackathons


def parse_dorahacks_hackathon(raw: dict[str, Any]) -> DoraHackathon:
    """Parse raw DoraHacks data into structured format."""
    title = raw.get("title", raw.get("name", "Untitled"))
    hack_id = raw.get("id", generate_hackathon_id(title))
    
    prize_raw = raw.get("prize", raw.get("prize_pool", raw.get("reward", "")))
    prize_pool = extract_prize_amount(str(prize_raw))
    
    deadline_raw = raw.get("deadline", raw.get("end_time", raw.get("due_time", "")))
    deadline = extract_deadline(str(deadline_raw))
    
    description = raw.get("description", raw.get("brief", ""))
    
    tags = extract_tags(f"{title} {description}")
    
    source_url = raw.get("source_url", raw.get("url", raw.get("link", "")))
    if not source_url:
        source_url = f"{DORAHACKS_BASE_URL}/hackathon/{hack_id}"
    
    tech_stack = raw.get("tech_stack", raw.get("technologies", []))
    if isinstance(tech_stack, str):
        tech_stack = [t.strip() for t in tech_stack.split(",")]
    
    difficulty = raw.get("difficulty", raw.get("level", ""))
    organizer = raw.get("organizer", raw.get("org", ""))
    city = raw.get("city", raw.get("location", ""))
    event_type = raw.get("type", raw.get("format", "online"))
    
    return DoraHackathon(
        id=str(hack_id),
        title=title,
        description=description[:500] if description else None,
        prize_pool=prize_pool,
        deadline=deadline,
        tags=tags,
        source_url=source_url,
        source="dorahacks",
        match_score=0,
        tech_stack=tech_stack,
        difficulty=difficulty,
        organizer=organizer,
        city=city,
        event_type=event_type,
    )


async def fetch_all_dorahacks() -> list[DoraHackathon]:
    """
    Main entry point: fetch all active DoraHacks hackathons.
    Tries API first, falls back to web scraping.
    """
    log.info("[DoraHacks] Starting hackathon fetch...")
    
    raw_data = await fetch_dorahacks_api()
    
    if not raw_data:
        log.info("[DoraHacks] API empty, trying web scraper...")
        raw_data = await scrape_dorahacks_page()
    
    hackathons = []
    for raw in raw_data:
        try:
            hackathon = parse_dorahacks_hackathon(raw)
            hackathons.append(hackathon)
        except Exception as exc:
            log.warning(f"Failed to parse hackathon: {exc}")
            continue
    
    log.info(f"[DoraHacks] Fetched {len(hackathons)} hackathons")
    return hackathons


def get_mock_hackathons() -> list[DoraHackathon]:
    """Return mock hackathons for testing when DoraHacks is unavailable."""
    return [
        DoraHackathon(
            id="mock_001",
            title="AI x Blockchain Global Hackathon 2026",
            description="Build innovative solutions combining AI and Web3 technologies.",
            prize_pool=50000,
            deadline="2026-04-15",
            tags=["AI", "Blockchain", "Python", "Solidity"],
            source_url="https://dorahacks.io/h/ai-blockchain",
            tech_stack=["Python", "OpenAI", "Solidity", "React"],
            difficulty="advanced",
            organizer="DoraHacks",
            event_type="online",
        ),
        DoraHackathon(
            id="mock_002",
            title="Social Good Hackathon",
            description="Create impactful solutions for environmental sustainability.",
            prize_pool=25000,
            deadline="2026-04-20",
            tags=["Social Good", "Python", "Data Science", "IoT"],
            source_url="https://dorahacks.io/h/social-good",
            tech_stack=["Python", "TensorFlow", "IoT", "React"],
            difficulty="intermediate",
            organizer="DoraHacks",
            event_type="hybrid",
        ),
        DoraHackathon(
            id="mock_003",
            title="DeFi Innovation Challenge",
            description="Build the next generation of decentralized finance protocols.",
            prize_pool=75000,
            deadline="2026-05-01",
            tags=["DeFi", "Blockchain", "Rust", "Solidity"],
            source_url="https://dorahacks.io/h/defi-challenge",
            tech_stack=["Rust", "Solidity", "TypeScript", "Hardhat"],
            difficulty="advanced",
            organizer="Dora Factory",
            event_type="online",
        ),
    ]
