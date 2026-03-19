"""
Devfolio MCP Integration Router — MVP Phase 1 + Phase 3 Personalization
╭─────────────────────────────────────────────────────────╮
│ GET /devfolio — Hackathons from Devfolio source         │
│ • Filterable by tags, prize range, deadline days       │
│ • Sortable by score, urgency, prize value              │
│ • Cached in Redis (1 hour TTL)                         │
│ • Paginated with limit/offset                          │
│ • PHASE 3: Personalized scoring by wallet              │
│   - Skill overlap (40%), Urgency (20%)                 │
│   - Prize value (15%), Tech stack (15%)                │
│   - Neuroplasticity (10%)                              │
╰─────────────────────────────────────────────────────────╯
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Hackathon, UserSkillProfile
from schemas import DevfolioHackathonPersonalizedResponse, HackathonExtendedRead, PersonalizedMatchScore
from services.matcher import HackathonMatcher

log = logging.getLogger("xiima.routes.devfolio")
router = APIRouter()

# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────
class DevfolioHackathonResponse(HackathonExtendedRead):
    """Extended hackathon response with scoring metrics."""
    model_config = ConfigDict(from_attributes=True)
    
    urgency_score: int | None = None  # Days until deadline (0-100)
    value_score: int | None = None     # Prize percentile (0-100)


class DevfolioListResponse(BaseModel):
    """Paginated response with metadata."""
    total: int
    page: int
    page_size: int
    hackathons: list[DevfolioHackathonResponse | DevfolioHackathonPersonalizedResponse]
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


def _make_cache_key(filters: dict, sort_by: str, limit: int, offset: int, wallet: str | None = None) -> str:
    """Generate cache key from query params."""
    tags_key = ",".join(sorted(filters.get("tags", [])))
    wallet_part = f"wallet_{wallet}" if wallet else "no-wallet"
    key_parts = [
        "devfolio",
        tags_key or "all-tags",
        f"prize_{filters.get('min_prize', 0)}_{filters.get('max_prize', 999999)}",
        f"deadline_{filters.get('days_until_deadline', 999)}",
        f"sort_{sort_by}",
        f"p_{offset // limit}",  # page-based cache
        wallet_part,
    ]
    return ":".join(key_parts)


# ─────────────────────────────────────────────
# Scoring utilities
# ─────────────────────────────────────────────
def _compute_urgency_score(deadline_str: str) -> int:
    """
    Compute urgency score (0-100) based on days until deadline.
    
    - 0-7 days: 100 (urgent)
    - 8-30 days: 80-100 (high)
    - 31-90 days: 50-80 (medium)
    - 90+ days: 5-50 (low)
    """
    try:
        deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        days_left = (deadline - now).days
        
        if days_left <= 0:
            return 0
        elif days_left <= 7:
            return 100
        elif days_left <= 30:
            return 80 + min(20, (30 - days_left) * 2 // 30)
        elif days_left <= 90:
            return 50 + (days_left - 30) * 30 // 60
        else:
            return 5 + min(45, (180 - days_left) // 10)
    except Exception as e:
        log.debug(f"Error computing urgency: {e}")
        return 50  # Neutral default


def _compute_value_score(prize_pool: int, median_prize: int = 50000) -> int:
    """
    Compute value score (0-100) as percentile of prize pool.
    
    - Hackathon at median: 50 points
    - 2x median: 75 points
    - 0.5x median: 25 points
    """
    if prize_pool == 0:
        return 10
    
    ratio = prize_pool / max(median_prize, 1)
    # Logarithmic scale: log(ratio) normalized
    import math
    
    base_score = 50 + 25 * math.log(ratio) / math.log(2)  # log base 2
    return max(5, min(100, int(base_score)))


# ─────────────────────────────────────────────
# Personalization utilities (Phase 3)
# ─────────────────────────────────────────────
async def load_user_skill_profile(wallet: str, db: AsyncSession) -> UserSkillProfile | None:
    """Load user skill profile for personalized matching."""
    query = select(UserSkillProfile).where(UserSkillProfile.wallet_address == wallet)
    result = await db.execute(query)
    return result.scalars().first()


def _compute_personalized_scores(
    hackathon: Hackathon,
    user_profile: UserSkillProfile,
) -> PersonalizedMatchScore:
    """
    Compute personalized matching scores using Phase 3 scoring logic.
    """
    matcher = HackathonMatcher()
    
    results = matcher.match_hackathon(
        user_skills=user_profile.verified_skills,
        user_tech_stack=user_profile.preferred_tech_stack,
        user_neuroplasticity=user_profile.neuroplasticity_score,
        hackathon_tags=hackathon.tags or [],
        hackathon_tech_stack=hackathon.tech_stack or [],
        hackathon_difficulty=hackathon.difficulty,
        deadline_str=hackathon.deadline,
        prize_pool=hackathon.prize_pool,
    )
    
    return PersonalizedMatchScore(
        skill_overlap_score=results.skill_overlap_score,
        urgency_score=results.urgency_score,
        value_score=results.value_score,
        tech_stack_score=results.tech_stack_score,
        neuro_score=results.neuro_score,
        personalized_score=results.personalized_score,
        reasoning=results.reasoning,
    )


# ─────────────────────────────────────────────
# Main router
# ─────────────────────────────────────────────
@router.get("", response_model=DevfolioListResponse)
async def list_devfolio_hackathons(
    tags: Optional[str] = Query(None, description="Comma-separated tags to filter (e.g., 'AI,blockchain')"),
    min_prize: Optional[int] = Query(None, ge=0, description="Minimum prize pool"),
    max_prize: Optional[int] = Query(None, ge=0, description="Maximum prize pool"),
    days_until_deadline: Optional[int] = Query(None, ge=0, description="Filter hackathons ending within N days"),
    sort_by: str = Query("match_score", description="Sort by: match_score, urgency, prize, deadline"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    wallet: Optional[str] = Query(None, description="Wallet address for personalized scoring (optional)"),
    db: AsyncSession = Depends(get_db),
) -> DevfolioListResponse:
    """
    Get Devfolio hackathons with advanced filtering and sorting.
    
    **Phase 1 Filters:**
    - `tags`: Filter by tech stack (e.g., `AI,Web3,Python`)
    - `min_prize` / `max_prize`: Prize range filtering
    - `days_until_deadline`: Only hackathons ending in next N days
    
    **Phase 3 Personalization (NEW):**
    - `wallet`: Optional wallet address to enable personalized scoring
      * Returns detailed matching breakdown
      * Scores: skill overlap (40%), urgency (20%), prize (15%), tech stack (15%), neuro (10%)
      * Results cached 1 hour per (wallet, filters) combination
    
    **Sort Options:**
    - `match_score`: User skill match (default)
    - `urgency`: Days to deadline (most urgent first)
    - `prize`: Prize pool (highest first)
    - `deadline`: Earliest deadline first
    
    **Examples:**
    ```
    # Basic filtering
    GET /devfolio?tags=AI,Python&min_prize=50000&sort_by=urgency&limit=10
    
    # Personalized scoring
    GET /devfolio?wallet=0xabc123...&sort_by=personalized_score&limit=10
    ```
    """
    
    # Parse filters
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
    
    # Try cache first (include wallet in key if provided)
    cache_key = _make_cache_key(filter_dict, sort_by, limit, offset, wallet)
    redis_client = await get_redis_client()
    cache_hit = False
    
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                log.debug(f"Cache HIT: {cache_key}")
                data = json.loads(cached)
                data["cache_hit"] = True
                return DevfolioListResponse(**data)
        except Exception as e:
            log.warning(f"Cache read failed: {e}")
    
    # Load user profile if wallet provided (Phase 3)
    user_profile = None
    if wallet:
        user_profile = await load_user_skill_profile(wallet, db)
        if not user_profile:
            log.warning(f"No skill profile found for wallet: {wallet}")
    
    # Build query
    query = select(Hackathon).where(Hackathon.source == "devfolio")
    
    # Apply tag filters (case-insensitive JSON containment)
    if parsed_tags:
        # Filter hackathons where at least one tag matches
        tag_conditions = []
        for tag in parsed_tags:
            # PostgreSQL ILIKE for case-insensitive matching
            tag_conditions.append(
                func.lower(func.array_to_string(Hackathon.tags, ",")).contains(tag)
            )
        query = query.where(or_(*tag_conditions))
    
    # Prize range
    if min_prize is not None:
        query = query.where(Hackathon.prize_pool >= min_prize)
    if max_prize is not None:
        query = query.where(Hackathon.prize_pool <= max_prize)
    
    # Deadline filter
    if days_until_deadline is not None:
        now = datetime.now(timezone.utc)
        future_deadline = now + timedelta(days=days_until_deadline)
        query = query.where(
            and_(
                Hackathon.deadline >= now.isoformat(),
                Hackathon.deadline <= future_deadline.isoformat(),
            )
        )
    
    # Total count (before offset/limit)
    total_result = await db.execute(
        select(func.count(Hackathon.id)).where(query.whereclause)
    )
    total = total_result.scalar() or 0
    
    # Sorting
    sort_mapping = {
        "match_score": Hackathon.match_score.desc(),
        "prize": Hackathon.prize_pool.desc(),
        "deadline": Hackathon.deadline.asc(),
        "urgency": Hackathon.deadline.asc(),
        "updated": Hackathon.updated_at.desc(),
    }
    sort_col = sort_mapping.get(sort_by, Hackathon.match_score.desc())
    query = query.order_by(sort_col)
    
    # Pagination
    page = offset // limit if limit > 0 else 0
    query = query.limit(limit).offset(offset)
    
    # Execute
    result = await db.execute(query)
    hackathons = result.scalars().all()
    
    # Compute extended scores
    response_hackathons = []
    for h in hackathons:
        h_dict = {
            "id": h.id,
            "title": h.title,
            "prize_pool": h.prize_pool,
            "tags": h.tags,
            "deadline": h.deadline,
            "match_score": h.match_score,
            "source_url": h.source_url,
            "source": h.source,
            "ai_analysis": h.ai_analysis,
            "scraped_at": h.scraped_at,
            "updated_at": h.updated_at,
            "urgency_score": _compute_urgency_score(h.deadline),
            "value_score": _compute_value_score(h.prize_pool),
            # Extended fields
            "tech_stack": h.tech_stack,
            "difficulty": h.difficulty,
            "requirements": h.requirements,
            "talent_pool_estimate": h.talent_pool_estimate,
            "organizer": h.organizer,
            "city": h.city,
            "event_type": h.event_type,
            "description": h.description,
            "participation_count_estimate": h.participation_count_estimate,
        }
        
        # Phase 3: Add personalized scoring if wallet provided
        if wallet and user_profile:
            try:
                match_breakdown = _compute_personalized_scores(h, user_profile)
                h_dict["match_breakdown"] = match_breakdown
                h_dict["personalized_score"] = match_breakdown.personalized_score
                response_hackathons.append(DevfolioHackathonPersonalizedResponse(**h_dict))
            except Exception as e:
                log.warning(f"Error computing personalized score: {e}")
                response_hackathons.append(DevfolioHackathonResponse(**h_dict))
        else:
            response_hackathons.append(DevfolioHackathonResponse(**h_dict))
    
    # If personalized scores were computed, re-sort by personalized_score
    if wallet and user_profile and sort_by == "personalized_score":
        response_hackathons.sort(
            key=lambda h: getattr(h, "personalized_score", 0),
            reverse=True
        )
    
    # Build response
    response = DevfolioListResponse(
        total=total,
        page=page,
        page_size=limit,
        hackathons=response_hackathons,
        cache_hit=cache_hit,
        personalized_for_wallet=wallet if user_profile else None,
    )
    
    # Cache for 1 hour
    if redis_client:
        try:
            await redis_client.setex(cache_key, 3600, response.model_dump_json())
            log.debug(f"Cached: {cache_key}")
        except Exception as e:
            log.warning(f"Cache write failed: {e}")
    
    return response


@router.get("/stats", response_model=dict)
async def get_devfolio_stats(
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregate stats about Devfolio hackathons:
    - Total count
    - Date range
    - Prize pool distribution
    - Top tags
    """
    query = select(Hackathon).where(Hackathon.source == "devfolio")
    result = await db.execute(query)
    hackathons = result.scalars().all()
    
    if not hackathons:
        return {
            "total": 0,
            "earliest_deadline": None,
            "latest_deadline": None,
            "total_prize_pool": 0,
            "avg_prize": 0,
            "top_tags": [],
        }
    
    prizes = [h.prize_pool for h in hackathons if h.prize_pool]
    all_tags: dict[str, int] = {}
    
    for h in hackathons:
        for tag in (h.tags or []):
            tag_lower = str(tag).lower()
            all_tags[tag_lower] = all_tags.get(tag_lower, 0) + 1
    
    top_tags = sorted(all_tags.items(), key=lambda x: x[1], reverse=True)[:10]
    
    return {
        "total": len(hackathons),
        "earliest_deadline": min((h.deadline for h in hackathons), default=None),
        "latest_deadline": max((h.deadline for h in hackathons), default=None),
        "total_prize_pool": sum(prizes),
        "avg_prize": sum(prizes) // len(prizes) if prizes else 0,
        "top_tags": [{"tag": tag, "count": count} for tag, count in top_tags],
    }


log = logging.getLogger("xiima.routes.devfolio")
router = APIRouter()

# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────
class DevfolioHackathonResponse(HackathonExtendedRead):
    """Extended hackathon response with scoring metrics."""
    model_config = ConfigDict(from_attributes=True)
    
    urgency_score: int | None = None  # Days until deadline (0-100)
    value_score: int | None = None     # Prize percentile (0-100)


class DevfolioListResponse(BaseModel):
    """Paginated response with metadata."""
    total: int
    page: int
    page_size: int
    hackathons: list[DevfolioHackathonResponse | DevfolioHackathonPersonalizedResponse]
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


def _make_cache_key(filters: dict, sort_by: str, limit: int, offset: int, wallet: str | None = None) -> str:
    """Generate cache key from query params."""
    tags_key = ",".join(sorted(filters.get("tags", [])))
    wallet_part = f"wallet_{wallet}" if wallet else "no-wallet"
    key_parts = [
        "devfolio",
        tags_key or "all-tags",
        f"prize_{filters.get('min_prize', 0)}_{filters.get('max_prize', 999999)}",
        f"deadline_{filters.get('days_until_deadline', 999)}",
        f"sort_{sort_by}",
        f"p_{offset // limit}",  # page-based cache
        wallet_part,
    ]
    return ":".join(key_parts)


# ─────────────────────────────────────────────
# Scoring utilities
# ─────────────────────────────────────────────
def _compute_urgency_score(deadline_str: str) -> int:
    """
    Compute urgency score (0-100) based on days until deadline.
    
    - 0-7 days: 100 (urgent)
    - 8-30 days: 80-100 (high)
    - 31-90 days: 50-80 (medium)
    - 90+ days: 5-50 (low)
    """
    try:
        deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        days_left = (deadline - now).days
        
        if days_left <= 0:
            return 0
        elif days_left <= 7:
            return 100
        elif days_left <= 30:
            return 80 + min(20, (30 - days_left) * 2 // 30)
        elif days_left <= 90:
            return 50 + (days_left - 30) * 30 // 60
        else:
            return 5 + min(45, (180 - days_left) // 10)
    except Exception as e:
        log.debug(f"Error computing urgency: {e}")
        return 50  # Neutral default


def _compute_value_score(prize_pool: int, median_prize: int = 50000) -> int:
    """
    Compute value score (0-100) as percentile of prize pool.
    
    - Hackathon at median: 50 points
    - 2x median: 75 points
    - 0.5x median: 25 points
    """
    if prize_pool == 0:
        return 10
    
    ratio = prize_pool / max(median_prize, 1)
    # Logarithmic scale: log(ratio) normalized
    import math
    
    base_score = 50 + 25 * math.log(ratio) / math.log(2)  # log base 2
    return max(5, min(100, int(base_score)))


# ─────────────────────────────────────────────
# Main router
# ─────────────────────────────────────────────
@router.get("", response_model=DevfolioListResponse)
async def list_devfolio_hackathons(
    tags: Optional[str] = Query(None, description="Comma-separated tags to filter (e.g., 'AI,blockchain')"),
    min_prize: Optional[int] = Query(None, ge=0, description="Minimum prize pool"),
    max_prize: Optional[int] = Query(None, ge=0, description="Maximum prize pool"),
    days_until_deadline: Optional[int] = Query(None, ge=0, description="Filter hackathons ending within N days"),
    sort_by: str = Query("match_score", description="Sort by: match_score, urgency, prize, deadline"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db),
) -> DevfolioListResponse:
    """
    Get Devfolio hackathons with advanced filtering and sorting.
    
    **Filters:**
    - `tags`: Filter by tech stack (e.g., `AI,Web3,Python`)
    - `min_prize` / `max_prize`: Prize range filtering
    - `days_until_deadline`: Only hackathons ending in next N days
    
    **Sort Options:**
    - `match_score`: User skill match (default)
    - `urgency`: Days to deadline (most urgent first)
    - `prize`: Prize pool (highest first)
    - `deadline`: Earliest deadline first
    
    **Example:**
    ```
    GET /devfolio?tags=AI,Python&min_prize=50000&sort_by=urgency&limit=10
    ```
    """
    
    # Parse filters
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
    
    # Try cache first
    cache_key = _make_cache_key(filter_dict, sort_by, limit, offset)
    redis_client = await get_redis_client()
    cache_hit = False
    
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                log.debug(f"Cache HIT: {cache_key}")
                data = json.loads(cached)
                data["cache_hit"] = True
                return DevfolioListResponse(**data)
        except Exception as e:
            log.warning(f"Cache read failed: {e}")
    
    # Build query
    query = select(Hackathon).where(Hackathon.source == "devfolio")
    
    # Apply tag filters (case-insensitive JSON containment)
    if parsed_tags:
        # Filter hackathons where at least one tag matches
        tag_conditions = []
        for tag in parsed_tags:
            # PostgreSQL ILIKE for case-insensitive matching
            tag_conditions.append(
                func.lower(func.array_to_string(Hackathon.tags, ",")).contains(tag)
            )
        query = query.where(or_(*tag_conditions))
    
    # Prize range
    if min_prize is not None:
        query = query.where(Hackathon.prize_pool >= min_prize)
    if max_prize is not None:
        query = query.where(Hackathon.prize_pool <= max_prize)
    
    # Deadline filter
    if days_until_deadline is not None:
        now = datetime.now(timezone.utc)
        future_deadline = now + timedelta(days=days_until_deadline)
        query = query.where(
            and_(
                Hackathon.deadline >= now.isoformat(),
                Hackathon.deadline <= future_deadline.isoformat(),
            )
        )
    
    # Total count (before offset/limit)
    count_query = select(func.count()).select_from(Hackathon).where(
        query.whereclause if hasattr(query, "whereclause") else None
    )
    total_result = await db.execute(
        select(func.count(Hackathon.id)).where(query.whereclause)
    )
    total = total_result.scalar() or 0
    
    # Sorting
    sort_mapping = {
        "match_score": Hackathon.match_score.desc(),
        "prize": Hackathon.prize_pool.desc(),
        "deadline": Hackathon.deadline.asc(),
        "urgency": Hackathon.deadline.asc(),  # Fallback for DB-level sorting
        "updated": Hackathon.updated_at.desc(),
    }
    sort_col = sort_mapping.get(sort_by, Hackathon.match_score.desc())
    query = query.order_by(sort_col)
    
    # Pagination
    page = offset // limit if limit > 0 else 0
    query = query.limit(limit).offset(offset)
    
    # Execute
    result = await db.execute(query)
    hackathons = result.scalars().all()
    
    # Compute extended scores
    response_hackathons = []
    for h in hackathons:
        h_dict = {
            "id": h.id,
            "title": h.title,
            "prize_pool": h.prize_pool,
            "tags": h.tags,
            "deadline": h.deadline,
            "match_score": h.match_score,
            "source_url": h.source_url,
            "source": h.source,
            "ai_analysis": h.ai_analysis,
            "scraped_at": h.scraped_at,
            "updated_at": h.updated_at,
            "urgency_score": _compute_urgency_score(h.deadline),
            "value_score": _compute_value_score(h.prize_pool),
        }
        response_hackathons.append(DevfolioHackathonResponse(**h_dict))
    
    # Build response
    response = DevfolioListResponse(
        total=total,
        page=page,
        page_size=limit,
        hackathons=response_hackathons,
        cache_hit=cache_hit,
    )
    
    # Cache for 1 hour
    if redis_client:
        try:
            await redis_client.setex(cache_key, 3600, response.model_dump_json())
            log.debug(f"Cached: {cache_key}")
        except Exception as e:
            log.warning(f"Cache write failed: {e}")
    
    return response


@router.get("/stats", response_model=dict)
async def get_devfolio_stats(
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregate stats about Devfolio hackathons:
    - Total count
    - Date range
    - Prize pool distribution
    - Top tags
    """
    query = select(Hackathon).where(Hackathon.source == "devfolio")
    result = await db.execute(query)
    hackathons = result.scalars().all()
    
    if not hackathons:
        return {
            "total": 0,
            "earliest_deadline": None,
            "latest_deadline": None,
            "total_prize_pool": 0,
            "avg_prize": 0,
            "top_tags": [],
        }
    
    prizes = [h.prize_pool for h in hackathons if h.prize_pool]
    all_tags: dict[str, int] = {}
    
    for h in hackathons:
        for tag in (h.tags or []):
            tag_lower = str(tag).lower()
            all_tags[tag_lower] = all_tags.get(tag_lower, 0) + 1
    
    top_tags = sorted(all_tags.items(), key=lambda x: x[1], reverse=True)[:10]
    
    return {
        "total": len(hackathons),
        "earliest_deadline": min((h.deadline for h in hackathons), default=None),
        "latest_deadline": max((h.deadline for h in hackathons), default=None),
        "total_prize_pool": sum(prizes),
        "avg_prize": sum(prizes) // len(prizes) if prizes else 0,
        "top_tags": [{"tag": tag, "count": count} for tag, count in top_tags],
    }
