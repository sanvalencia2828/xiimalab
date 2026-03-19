"""
Intelligent Hackathon Aggregator — Phase 4
╭─────────────────────────────────────────────────────────╮
│ Multi-source hackathon discovery & deduplication        │
│ • Combines Devfolio, DoraHacks, Devpost                 │
│ • Fuzzy title matching (>90% similarity)                │
│ • Priority ranking: Devfolio > DoraHacks > Devpost      │
│ • Preserves source attribution                          │
│ • Extends Phase 3 personalized scoring                  │
╰─────────────────────────────────────────────────────────╯
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Optional

log = logging.getLogger("xiima.services.aggregator")


# ─────────────────────────────────────────────
# Data Structures
# ─────────────────────────────────────────────

@dataclass
class HackathonSource:
    """Metadata about a hackathon source."""
    source_name: str        # "devfolio", "dorahacks", "devpost"
    priority: int           # 0=highest (Devfolio), 1=DoraHacks, 2=Devpost
    is_verified: bool       # Verification API available
    freshness_hours: int    # Cache validity in hours


# Source priorities and metadata
SOURCE_METADATA = {
    "devfolio": HackathonSource(
        source_name="devfolio",
        priority=0,          # Highest priority
        is_verified=True,
        freshness_hours=3,   # High freshness via MCP
    ),
    "dorahacks": HackathonSource(
        source_name="dorahacks",
        priority=1,          # Medium priority
        is_verified=True,
        freshness_hours=6,   # Browser-scraped
    ),
    "devpost": HackathonSource(
        source_name="devpost",
        priority=2,          # Lowest priority
        is_verified=False,
        freshness_hours=12,  # Browser-scraped
    ),
}


@dataclass
class AggregatedHackathon:
    """Consolidated hackathon from multiple sources."""
    id: str
    title: str
    description: str | None
    prize_pool: int
    tags: list[str]
    deadline: str
    
    # Multi-source tracking
    sources: list[str] = field(default_factory=list)  # All sources this appears in
    primary_source: str = "unknown"                    # Highest priority source
    
    # URL and metadata
    source_urls: dict[str, str] = field(default_factory=dict)  # source → URL mapping
    organizer: str | None = None
    city: str | None = None
    event_type: str | None = None
    
    # Scoring (from Phase 3)
    urgency_score: int | None = None
    value_score: int | None = None
    personalized_score: float | None = None
    match_breakdown: dict | None = None
    
    # Metadata from extended schema
    tech_stack: list[str] | None = None
    difficulty: str | None = None
    requirements: list[str] | None = None
    
    @property
    def is_multi_source(self) -> bool:
        """True if hackathon appears in multiple sources."""
        return len(self.sources) > 1
    
    @property
    def source_confidence(self) -> float:
        """
        Confidence score based on source count.
        Single source: 0.7, Two sources: 0.85, All three: 1.0
        """
        return 0.7 + (len(self.sources) - 1) * 0.15


class HackathonDeduplicator:
    """
    Detects and merges duplicate hackathons from different sources
    using fuzzy string matching on titles.
    """
    
    # Similarity threshold (0-1)
    SIMILARITY_THRESHOLD = 0.90
    
    # Common title variations
    TITLE_VARIATIONS = {
        "hackathon": ["hackathon", "hack", "competition", "contest"],
        "2025": ["2025", "'25", "25"],
        "global": ["global", "worldwide", "international"],
        "africa": ["africa", "african", "afri"],
    }
    
    def __init__(self, threshold: float = SIMILARITY_THRESHOLD):
        self.threshold = threshold
    
    @staticmethod
    def _normalize_title(title: str) -> str:
        """Normalize title for comparison."""
        # Remove special chars, lowercase, strip whitespace
        normalized = title.lower().strip()
        for char in "!@#$%^&*()_+-=[]{}|;:',.<>?/":
            normalized = normalized.replace(char, " ")
        # Collapse multiple spaces
        normalized = " ".join(normalized.split())
        return normalized
    
    @staticmethod
    def _similarity(s1: str, s2: str) -> float:
        """Compute similarity between two strings (0-1)."""
        n1 = HackathonDeduplicator._normalize_title(s1)
        n2 = HackathonDeduplicator._normalize_title(s2)
        return SequenceMatcher(None, n1, n2).ratio()
    
    def find_duplicates(
        self,
        hackathon: dict,
        candidates: list[dict],
    ) -> list[tuple[int, float]]:
        """
        Find potential duplicates in candidates list.
        
        Returns:
            List of (index, similarity) tuples for candidates above threshold.
        """
        duplicates = []
        for idx, candidate in enumerate(candidates):
            sim = self._similarity(hackathon["title"], candidate["title"])
            if sim >= self.threshold:
                duplicates.append((idx, sim))
        return duplicates
    
    def merge_hackathons(
        self,
        primary: dict,
        secondary: dict,
    ) -> dict:
        """
        Merge two hackathons, preserving best data from each.
        
        Priority: Primary > Secondary for most fields.
        Exception: Use secondary if primary is None/empty.
        """
        merged = primary.copy()
        
        # Enhance with secondary metadata if missing
        priority_fields = {
            "title": str,
            "description": str,
            "organizer": str,
        }
        
        optional_fields = {
            "tech_stack": list,
            "requirements": list,
            "city": str,
            "event_type": str,
            "difficulty": str,
        }
        
        for field_name, field_type in optional_fields.items():
            if not merged.get(field_name) and secondary.get(field_name):
                merged[field_name] = secondary[field_name]
        
        # Combine tags (union)
        primary_tags = set(primary.get("tags", []))
        secondary_tags = set(secondary.get("tags", []))
        merged["tags"] = list(primary_tags | secondary_tags)
        
        # Track both sources if different
        if primary.get("source") != secondary.get("source"):
            sources = merged.get("sources", [primary.get("source")])
            if secondary.get("source") not in sources:
                sources.append(secondary.get("source"))
            merged["sources"] = sources
        
        return merged


class HackathonAggregator:
    """
    Aggregates hackathons from multiple sources with intelligent deduplication
    and priority-based ranking.
    """
    
    def __init__(self, dedup_threshold: float = HackathonDeduplicator.SIMILARITY_THRESHOLD):
        self.deduplicator = HackathonDeduplicator(threshold=dedup_threshold)
    
    def aggregate(
        self,
        devfolio_hackathons: list[dict] = None,
        dorahacks_hackathons: list[dict] = None,
        devpost_hackathons: list[dict] = None,
    ) -> list[AggregatedHackathon]:
        """
        Combine hackathons from all sources with deduplication.
        
        Priority: Devfolio > DoraHacks > Devpost
        
        Returns:
            List of deduplicated AggregatedHackathon objects sorted by priority.
        """
        devfolio_hackathons = devfolio_hackathons or []
        dorahacks_hackathons = dorahacks_hackathons or []
        devpost_hackathons = devpost_hackathons or []
        
        # Phase 1: Start with highest-priority source (Devfolio)
        result_map = {}  # id → AggregatedHackathon
        
        for h in devfolio_hackathons:
            agg = self._to_aggregated(h, "devfolio")
            result_map[h["id"]] = agg
        
        # Phase 2: Add DoraHacks, deduping against Devfolio
        for h in dorahacks_hackathons:
            duplicate_ids = self._find_duplicates_in_map(h, result_map)
            
            if duplicate_ids:
                # Merge with highest-priority match
                primary_id = duplicate_ids[0]
                log.debug(f"DoraHacks {h['id']} merges with {primary_id}")
                result_map[primary_id] = self._merge_aggregated(
                    result_map[primary_id],
                    self._to_aggregated(h, "dorahacks"),
                )
            else:
                # Add as new
                agg = self._to_aggregated(h, "dorahacks")
                result_map[h["id"]] = agg
        
        # Phase 3: Add Devpost, dedup against both
        for h in devpost_hackathons:
            duplicate_ids = self._find_duplicates_in_map(h, result_map)
            
            if duplicate_ids:
                primary_id = duplicate_ids[0]
                log.debug(f"Devpost {h['id']} merges with {primary_id}")
                result_map[primary_id] = self._merge_aggregated(
                    result_map[primary_id],
                    self._to_aggregated(h, "devpost"),
                )
            else:
                agg = self._to_aggregated(h, "devpost")
                result_map[h["id"]] = agg
        
        # Phase 4: Convert to list and sort by primary source priority
        aggregated = list(result_map.values())
        aggregated.sort(
            key=lambda x: (
                SOURCE_METADATA.get(x.primary_source, HackathonSource("unknown", 999, False, 0)).priority,
                x.prize_pool,  # Secondary: prize pool descending
            )
        )
        
        return aggregated
    
    def _find_duplicates_in_map(
        self,
        hackathon: dict,
        result_map: dict[str, AggregatedHackathon],
    ) -> list[str]:
        """Find potential duplicates in aggregated result map."""
        duplicates = []
        for agg_id, agg_h in result_map.items():
            sim = self.deduplicator._similarity(hackathon["title"], agg_h.title)
            if sim >= self.deduplicator.threshold:
                duplicates.append(agg_id)
        return duplicates
    
    @staticmethod
    def _to_aggregated(hackathon: dict, source: str) -> AggregatedHackathon:
        """Convert DB hackathon to AggregatedHackathon."""
        return AggregatedHackathon(
            id=hackathon.get("id", "unknown"),
            title=hackathon.get("title", ""),
            description=hackathon.get("description"),
            prize_pool=hackathon.get("prize_pool", 0),
            tags=hackathon.get("tags", []),
            deadline=hackathon.get("deadline", ""),
            primary_source=source,
            sources=[source],
            source_urls={source: hackathon.get("source_url", "")},
            organizer=hackathon.get("organizer"),
            city=hackathon.get("city"),
            event_type=hackathon.get("event_type"),
            tech_stack=hackathon.get("tech_stack"),
            difficulty=hackathon.get("difficulty"),
            requirements=hackathon.get("requirements"),
            urgency_score=hackathon.get("urgency_score"),
            value_score=hackathon.get("value_score"),
            personalized_score=hackathon.get("personalized_score"),
            match_breakdown=hackathon.get("match_breakdown"),
        )
    
    @staticmethod
    def _merge_aggregated(
        primary: AggregatedHackathon,
        secondary: AggregatedHackathon,
    ) -> AggregatedHackathon:
        """Merge two AggregatedHackathon objects."""
        # Add secondary source
        if secondary.primary_source not in primary.sources:
            primary.sources.append(secondary.primary_source)
        
        # Merge URLs
        for source, url in secondary.source_urls.items():
            if url and source not in primary.source_urls:
                primary.source_urls[source] = url
        
        # Enhance metadata if secondary has better data
        if not primary.description and secondary.description:
            primary.description = secondary.description
        if not primary.organizer and secondary.organizer:
            primary.organizer = secondary.organizer
        if not primary.city and secondary.city:
            primary.city = secondary.city
        
        # Merge tags
        primary.tags = list(set(primary.tags) | set(secondary.tags))
        
        return primary
    
    def apply_personalized_scoring(
        self,
        aggregated: list[AggregatedHackathon],
        personalized_scores_map: dict[str, dict],
    ) -> list[AggregatedHackathon]:
        """
        Apply Phase 3 personalized scores to aggregated hackathons.
        
        Args:
            aggregated: List of aggregated hackathons
            personalized_scores_map: Dict mapping hackathon_id → {personalized_score, match_breakdown}
        
        Returns:
            Aggregated hackathons with personalized scores applied.
        """
        for agg_h in aggregated:
            if agg_h.id in personalized_scores_map:
                score_data = personalized_scores_map[agg_h.id]
                agg_h.personalized_score = score_data.get("personalized_score")
                agg_h.match_breakdown = score_data.get("match_breakdown")
        
        return aggregated


def get_aggregator(dedup_threshold: float = 0.90) -> HackathonAggregator:
    """Get or create global aggregator instance."""
    return HackathonAggregator(dedup_threshold=dedup_threshold)
