"""
HTML parser + match score logic for DoraHacks listings.
Kept separate from scraper.py so it can be unit-tested without a browser.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any


# ─────────────────────────────────────────────
# SKILL KEYWORD → weight map
# Used to compute a match_score (0-100) per hackathon
# ─────────────────────────────────────────────
SKILL_WEIGHTS: dict[str, int] = {
    "python": 20,
    "ai": 18,
    "ml": 18,
    "machine learning": 18,
    "data": 15,
    "analytics": 12,
    "docker": 14,
    "devops": 12,
    "blockchain": 16,
    "stellar": 14,
    "avalanche": 14,
    "defi": 12,
    "nft": 8,
    "web3": 10,
    "smart contracts": 12,
    "fastapi": 10,
    "open track": 6,
}

MAX_POSSIBLE_SCORE: int = sum(SKILL_WEIGHTS.values())


@dataclass
class ParsedHackathon:
    id: str
    title: str
    prize_pool: int
    tags: list[str]
    deadline: str          # "YYYY-MM-DD"
    match_score: int
    source_url: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "prize_pool": self.prize_pool,
            "tags": self.tags,
            "deadline": self.deadline,
            "match_score": self.match_score,
            "source_url": self.source_url,
        }


# ─────────────────────────────────────────────
# Match score — dot-product-style ranking
# ─────────────────────────────────────────────
def compute_match_score(title: str, tags: list[str]) -> int:
    """
    Score a hackathon 0-100 based on how well its title/tags
    match our skill weights. Capped and normalized.
    """
    corpus = (title + " " + " ".join(tags)).lower()
    raw = sum(
        weight
        for kw, weight in SKILL_WEIGHTS.items()
        if kw in corpus
    )
    # Normalize to 0-100, minimum 5 to avoid 0% display
    score = min(100, max(5, round(raw / MAX_POSSIBLE_SCORE * 100)))
    return score


# ─────────────────────────────────────────────
# Prize parser — handles "$50,000", "50K", etc.
# ─────────────────────────────────────────────
def parse_prize(text: str) -> int:
    text = text.replace(",", "").replace("$", "").strip().upper()
    match = re.search(r"(\d+(?:\.\d+)?)\s*([KMB]?)", text)
    if not match:
        return 0
    value, suffix = float(match.group(1)), match.group(2)
    multiplier = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}.get(suffix, 1)
    return int(value * multiplier)


# ─────────────────────────────────────────────
# Deadline parser — multiple formats
# ─────────────────────────────────────────────
def parse_deadline(text: str) -> str:
    """Return ISO date string or a fallback 90 days ahead."""
    formats = ["%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%d/%m/%Y"]
    for fmt in formats:
        try:
            return datetime.strptime(text.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    # Fallback: 90 days from today
    from datetime import timedelta
    return (date.today() + timedelta(days=90)).isoformat()


# ─────────────────────────────────────────────
# Stable ID from title (no random UUIDs — idempotent upserts)
# ─────────────────────────────────────────────
def make_id(title: str) -> str:
    return hashlib.md5(title.lower().strip().encode()).hexdigest()[:12]


# ─────────────────────────────────────────────
# Main parser — takes raw HTML cards, returns list of ParsedHackathon
# ─────────────────────────────────────────────
def parse_hackathon_cards(cards: list[dict[str, str]], base_url: str) -> list[ParsedHackathon]:
    """
    Args:
        cards: list of dicts extracted from page HTML:
               {"title": ..., "prize": ..., "deadline": ..., "tags": ..., "url": ...}
        base_url: canonical base URL for source_url fallback

    Returns:
        List of ParsedHackathon dataclasses ready to upsert into PostgreSQL
    """
    results: list[ParsedHackathon] = []
    for card in cards:
        title = card.get("title", "Unknown").strip()
        raw_tags = card.get("tags", "")
        tags = [t.strip() for t in raw_tags.split(",") if t.strip()] if raw_tags else []
        prize_pool = parse_prize(card.get("prize", "0"))
        deadline = parse_deadline(card.get("deadline", ""))
        match_score = compute_match_score(title, tags)
        source_url = card.get("url") or base_url

        results.append(ParsedHackathon(
            id=make_id(title),
            title=title,
            prize_pool=prize_pool,
            tags=tags,
            deadline=deadline,
            match_score=match_score,
            source_url=source_url,
        ))

    return results
