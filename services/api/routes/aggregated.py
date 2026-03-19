"""
Aggregated Hackathon Router — Phase 4
╭─────────────────────────────────────────────────────────╮
│ GET /hackathons/aggregated — Multi-source discovery     │
│ • Combines Devfolio + DoraHacks + Devpost               │
│ • Fuzzy deduplication (>90% similarity)                 │
│ • Priority ranking by source quality                    │
│ • Extends Phase 3 personalized scoring                  │
╰─────────────────────────────────────────────────────────╯
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Hackathon, UserSkillProfile
from schemas import (
    HackathonExtendedRead,
    PersonalizedMatchScore,
    SourceMetadata,
    AggregatedHackathonResponse,
)
from services.aggregator import HackathonAggregator, AggregatedHackathon
from services.matcher import HackathonMatcher

log = logging.getLogger("xiima.routes.aggregated")
router = APIRouter()


# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────

class AggregatedListResponse(BaseModel):
    """Paginated response for aggregated hackathons."""
    total: int
    page: int
    page_size: int
    total_sources_combined: int          # Total unique hackathons across all sources
    aggregated_count: int                 # After deduplication
    multi_source_count: int               # Count appearing in 2+ sources
    hackathons: list[AggregatedHackathonResponse]
    cache_hit: bool = False
    personalized_for_wallet: str | None = None


# ─────────────────────────────────────────────
# Cache utilities
# ─────────────────────────────────────────────

async def get_redis_client() -> aioredis.Redis | None:
    """Get Redis client for caching. Returns None if not available."""
    try:
        redis_url = "redis://localhost:6379"
        client = aioredis.from_url(redis_url, decode_responses=True)
        await client.ping()
        return client
    except Exception as e:
        log.warning(f"Redis not available: {e}")
        return None


def _make_aggregated_cache_key(
    filters: dict,
    sort_by: str,
    limit: int,
    offset: int,
    wallet: str | None = None,
) -> str:
    """Generate cache key for aggregated results."""
    tags_key = ",".join(sorted(filters.get("tags", [])))
    wallet_part = f"wallet_{wallet}" if wallet else "no-wallet"
    sources_part = ",".join(sorted(filters.get("sources", ["devfolio", "dorahacks"])))
    
    key_parts = [
        "aggregated",
        tags_key or "all-tags",
        f"prize_{filters.get('min_prize', 0)}_{filters.get('max_prize', 999999)}",
        f"deadline_{filters.get('days_until_deadline', 999)}",
        f"sort_{sort_by}",
        f"p_{offset // limit}",
        f"sources_{sources_part}",
        wallet_part,
    ]
    return ":".join(key_parts)


# ─────────────────────────────────────────────
# Main router
# ─────────────────────────────────────────────

@router.get("", response_model=AggregatedListResponse)
async def list_aggregated_hackathons(
    tags: Optional[str] = Query(None, description="Comma-separated tags (e.g., 'AI,blockchain')"),
    min_prize: Optional[int] = Query(None, ge=0, description="Minimum prize pool"),
    max_prize: Optional[int] = Query(None, ge=0, description="Maximum prize pool"),
    days_until_deadline: Optional[int] = Query(None, ge=0, description="Filter ending within N days"),
    sources: Optional[str] = Query(
        "devfolio,dorahacks",
        description="Comma-separated sources to include (devfolio,dorahacks,devpost)"
    ),
    sort_by: str = Query("match_score", description="Sort by: match_score, urgency, prize, deadline, sources, confidence"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    wallet: Optional[str] = Query(None, description="Wallet address for personalized scoring"),
    dedup_threshold: float = Query(0.90, ge=0.80, le=0.99, description="Fuzzy dedup similarity (0.80-0.99)"),
    db: AsyncSession = Depends(get_db),
) -> AggregatedListResponse:
    """
    Get aggregated hackathons from multiple sources with intelligent deduplication.
    
    **Phase 4 Features:**
    - Combines Devfolio, DoraHacks, and Devpost
    - Fuzzy title matching (>90% similarity by default)
    - Priority ranking: Devfolio > DoraHacks > Devpost
    - Tracks original URLs for each source
    - Extends Phase 3 personalized scoring
    
    **Filters:**
    - `tags`: Tech stack filtering
    - `min_prize` / `max_prize`: Prize range
    - `days_until_deadline`: Urgency window
    - `sources`: Which platforms to include
    - `dedup_threshold`: Fuzzy matching sensitivity (0.80-0.99)
    
    **Sort Options:**
    - `match_score`: Default skill matching
    - `urgency`: Days to deadline
    - `prize`: Prize pool
    - `deadline`: Earliest first
    - `sources`: Multi-source priority
    - `confidence`: Consolidation confidence
    - `personalized_score`: (if wallet provided)
    
    **Example:**
    ```
    GET /aggregated?tags=AI,Python&sort_by=urgency&wallet=0x123abc&limit=10
    ```
    """
    
    # Parse inputs
    filter_dict = {}
    parsed_tags = []
    if tags:
        parsed_tags = [t.strip().lower() for t in tags.split(",") if t.strip()]
        filter_dict["tags"] = parsed_tags
    
    if min_prize is not None:
        filter_dict["min_prize"] = min_prize
    if max_prize is not None:
        filter_dict["max_prize"] = max_prize
    if days_until_deadline is not None:
        filter_dict["days_until_deadline"] = days_until_deadline
    
    # Parse sources
    enabled_sources = []
    if sources:
        parsed_sources = [s.strip().lower() for s in sources.split(",") if s.strip()]
        enabled_sources = [s for s in parsed_sources if s in ["devfolio", "dorahacks", "devpost"]]
    if not enabled_sources:
        enabled_sources = ["devfolio", "dorahacks"]
    filter_dict["sources"] = enabled_sources
    
    # Try cache
    cache_key = _make_aggregated_cache_key(filter_dict, sort_by, limit, offset, wallet)
    redis_client = await get_redis_client()
    cache_hit = False
    
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                log.debug(f"Cache HIT (aggregated): {cache_key}")
                data = json.loads(cached)
                data["cache_hit"] = True
                return AggregatedListResponse(**data)
        except Exception as e:
            log.warning(f"Cache read failed: {e}")
    
    # Load user profile if wallet provided
    user_profile = None
    if wallet:
        query = select(UserSkillProfile).where(UserSkillProfile.wallet_address == wallet)
        result = await db.execute(query)
        user_profile = result.scalars().first()
        if not user_profile:
            log.warning(f"No skill profile found for wallet: {wallet}")
    
    # Query each enabled source
    devfolio_hackathons = []
    dorahacks_hackathons = []
    devpost_hackathons = []
    
    for source_name in enabled_sources:
        query = select(Hackathon).where(Hackathon.source == source_name)
        
        # Apply filters
        if parsed_tags:
            tag_conditions = []
            for tag in parsed_tags:
                tag_conditions.append(
                    func.lower(func.array_to_string(Hackathon.tags, ",")).contains(tag)
                )
            query = query.where(or_(*tag_conditions))
        
        if min_prize is not None:
            query = query.where(Hackathon.prize_pool >= min_prize)
        if max_prize is not None:
            query = query.where(Hackathon.prize_pool <= max_prize)
        
        if days_until_deadline is not None:
            now = datetime.now(timezone.utc)
            future_deadline = now + timedelta(days=days_until_deadline)
            query = query.where(
                and_(
                    Hackathon.deadline >= now.isoformat(),
                    Hackathon.deadline <= future_deadline.isoformat(),
                )
            )
        
        # Execute
        result = await db.execute(query)
        hackathons = result.scalars().all()
        
        hackathons_list = [
            {
                "id": h.id,
                "title": h.title,
                "description": h.description,
                "prize_pool": h.prize_pool,
                "tags": h.tags or [],
                "deadline": h.deadline,
                "source": h.source,
                "source_url": h.source_url,
                "organizer": h.organizer,
                "city": h.city,
                "event_type": h.event_type,
                "tech_stack": h.tech_stack,
                "difficulty": h.difficulty,
                "requirements": h.requirements,
            }
            for h in hackathons
        ]
        
        if source_name == "devfolio":
            devfolio_hackathons = hackathons_list
        elif source_name == "dorahacks":
            dorahacks_hackathons = hackathons_list
        elif source_name == "devpost":
            devpost_hackathons = hackathons_list
    
    # Aggregate with deduplication
    aggregator = HackathonAggregator(dedup_threshold=dedup_threshold)
    aggregated = aggregator.aggregate(
        devfolio_hackathons=devfolio_hackathons,
        dorahacks_hackathons=dorahacks_hackathons,
        devpost_hackathons=devpost_hackathons,
    )
    
    total_before_dedup = len(devfolio_hackathons) + len(dorahacks_hackathons) + len(devpost_hackathons)
    multi_source_count = sum(1 for h in aggregated if h.is_multi_source)
    
    # Apply personalization scores if wallet provided
    if wallet and user_profile:
        matcher = HackathonMatcher()
        personalized_scores_map = {}
        
        for agg_h in aggregated:
            try:
                results = matcher.match_hackathon(
                    user_skills=user_profile.verified_skills,
                    user_tech_stack=user_profile.preferred_tech_stack,
                    user_neuroplasticity=user_profile.neuroplasticity_score,
                    hackathon_tags=agg_h.tags,
                    hackathon_tech_stack=agg_h.tech_stack or [],
                    hackathon_difficulty=agg_h.difficulty,
                    deadline_str=agg_h.deadline,
                    prize_pool=agg_h.prize_pool,
                )
                personalized_scores_map[agg_h.id] = {
                    "personalized_score": results.personalized_score,
                    "match_breakdown": {
                        "skill_overlap_score": results.skill_overlap_score,
                        "urgency_score": results.urgency_score,
                        "value_score": results.value_score,
                        "tech_stack_score": results.tech_stack_score,
                        "neuro_score": results.neuro_score,
                        "personalized_score": results.personalized_score,
                        "reasoning": results.reasoning,
                    }
                }
            except Exception as e:
                log.warning(f"Error computing personalized score for {agg_h.id}: {e}")
        
        aggregator.apply_personalized_scoring(aggregated, personalized_scores_map)
    
    # Sort
    sort_mapping = {
        "match_score": lambda h: (h.personalized_score or 0, -h.prize_pool),
        "urgency": lambda h: h.deadline,
        "prize": lambda h: (-h.prize_pool, h.deadline),
        "deadline": lambda h: h.deadline,
        "sources": lambda h: (-len(h.sources), -h.prize_pool),
        "confidence": lambda h: (-h.source_confidence, -h.prize_pool),
        "personalized_score": lambda h: (-(h.personalized_score or 0), -h.prize_pool),
    }
    
    sort_key = sort_mapping.get(sort_by, sort_mapping["match_score"])
    if sort_by == "personalized_score" and not user_profile:
        # Fall back to match_score if wallet not provided
        sort_key = sort_mapping["match_score"]
    
    aggregated.sort(key=sort_key)
    
    # Paginate
    page = offset // limit if limit > 0 else 0
    total = len(aggregated)
    paginated = aggregated[offset : offset + limit]
    
    # Build response
    response_hackathons = []
    for agg_h in paginated:
        response_h = AggregatedHackathonResponse(
            id=agg_h.id,
            title=agg_h.title,
            description=agg_h.description,
            prize_pool=agg_h.prize_pool,
            tags=agg_h.tags,
            deadline=agg_h.deadline,
            source_url=agg_h.source_urls.get(agg_h.primary_source),
            source=agg_h.primary_source,
            ai_analysis=None,
            scraped_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            tech_stack=agg_h.tech_stack,
            difficulty=agg_h.difficulty,
            requirements=agg_h.requirements,
            organizer=agg_h.organizer,
            city=agg_h.city,
            event_type=agg_h.event_type,
            source_metadata=SourceMetadata(
                sources=agg_h.sources,
                primary_source=agg_h.primary_source,
                source_urls=agg_h.source_urls,
                is_multi_source=agg_h.is_multi_source,
                source_confidence=agg_h.source_confidence,
            ),
            urgency_score=agg_h.urgency_score,
            value_score=agg_h.value_score,
            personalized_score=agg_h.personalized_score,
            match_breakdown=agg_h.match_breakdown,
        )
        response_hackathons.append(response_h)
    
    response = AggregatedListResponse(
        total=total,
        page=page,
        page_size=limit,
        total_sources_combined=total_before_dedup,
        aggregated_count=total,
        multi_source_count=multi_source_count,
        hackathons=response_hackathons,
        cache_hit=cache_hit,
        personalized_for_wallet=wallet if user_profile else None,
    )
    
    # Cache for 30 minutes (longer than Phase 3 since aggregation is more expensive)
    if redis_client:
        try:
            await redis_client.setex(cache_key, 1800, response.model_dump_json())
            log.debug(f"Cached (30min): {cache_key}")
        except Exception as e:
            log.warning(f"Cache write failed: {e}")
    
    return response


@router.get("/stats", response_model=dict)
async def get_aggregated_stats(
    sources: Optional[str] = Query("devfolio,dorahacks", description="Comma-separated sources"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregate statistics across all enabled sources.
    """
    enabled_sources = []
    if sources:
        parsed_sources = [s.strip().lower() for s in sources.split(",") if s.strip()]
        enabled_sources = [s for s in parsed_sources if s in ["devfolio", "dorahacks", "devpost"]]
    if not enabled_sources:
        enabled_sources = ["devfolio", "dorahacks"]
    
    stats = {
        "sources": {},
        "combined": {
            "total": 0,
            "total_prize_pool": 0,
            "avg_prize": 0,
            "earliest_deadline": None,
            "latest_deadline": None,
            "top_tags": [],
        }
    }
    
    all_hackathons = []
    
    for source_name in enabled_sources:
        query = select(Hackathon).where(Hackathon.source == source_name)
        result = await db.execute(query)
        hackathons = result.scalars().all()
        
        prizes = [h.prize_pool for h in hackathons if h.prize_pool]
        all_hackathons.extend(hackathons)
        
        stats["sources"][source_name] = {
            "count": len(hackathons),
            "total_prize_pool": sum(prizes),
            "avg_prize": sum(prizes) // len(prizes) if prizes else 0,
            "earliest_deadline": min((h.deadline for h in hackathons), default=None),
            "latest_deadline": max((h.deadline for h in hackathons), default=None),
        }
    
    # Combined stats
    all_prizes = [h.prize_pool for h in all_hackathons if h.prize_pool]
    all_tags = {}
    for h in all_hackathons:
        for tag in (h.tags or []):
            tag_lower = str(tag).lower()
            all_tags[tag_lower] = all_tags.get(tag_lower, 0) + 1
    
    top_tags = sorted(all_tags.items(), key=lambda x: x[1], reverse=True)[:10]
    
    stats["combined"] = {
        "total": len(all_hackathons),
        "total_prize_pool": sum(all_prizes),
        "avg_prize": sum(all_prizes) // len(all_prizes) if all_prizes else 0,
        "earliest_deadline": min((h.deadline for h in all_hackathons), default=None),
        "latest_deadline": max((h.deadline for h in all_hackathons), default=None),
        "top_tags": [{"tag": tag, "count": count} for tag, count in top_tags],
    }
    
    return stats
