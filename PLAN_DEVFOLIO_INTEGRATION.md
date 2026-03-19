# Plan Arquitectónico: Integración Devfolio MCP en FastAPI
**Xiimalab Backend Enhancement**

---

## Tabla de Contenidos
1. [Estado Actual](#estado-actual)
2. [Problemas Identificados](#problemas-identificados)
3. [Arquitectura Propuesta](#arquitectura-propuesta)
4. [Cambios a Models & Schemas](#cambios-a-models--schemas)
5. [Implementación del Endpoint](#implementación-del-endpoint)
6. [Scoring Inteligente Mejorado](#scoring-inteligente-mejorado)
7. [Agregación de Múltiples Fuentes](#agregación-de-múltiples-fuentes)
8. [Performance & Caching](#performance--caching)
9. [Roadmap de Implementación](#roadmap-de-implementación)

---

## Estado Actual

### ✅ Fortalezas Existentes
- **Cliente MCP Devfolio funcional** (`services/scraper/devfolio_mcp.py`)
  - Protocolo JSON-RPC 2.0 sobre HTTP/SSE implementado
  - Descubrimiento dinámico de herramientas MCP
  - Normalización de datos raw → schema DB
  - Session persistence con `Mcp-Session-Id`

- **Infrastructure Redis**
  - Canal pub/sub `hackathons:new` en `routes/stream.py`
  - SSE streaming para actualizaciones en tiempo real
  - Estructura lista para cache distribuido

- **DB Schema multiusuario**
  - Modelo `Hackathon` soporta múltiples `source` (devfolio, dorahacks, etc)
  - ID determinista para upserts idempotentes
  - Campos `ai_analysis` JSON para metadatos extensibles

- **Scoring base**
  - Keyword-weight matching en `parser.py`
  - 17 skills con pesos configurables
  - Normalización 0-100 con floor = 5

---

## Problemas Identificados

### 🚨 Gaps Actuales

| Problema | Impacto | Prioridad |
|----------|--------|-----------|
| **Sin endpoint `/api/hackathons/devfolio`** | No hay forma de consultar Devfolio directamente sin scraper | CRITICAL |
| **Scoring no considera perfil del usuario** | Match scores son idénticos para todos los usuarios | HIGH |
| **Sin caché inteligente** | Llamadas a DB redundantes, sin TTL contextual | HIGH |
| **Sin agregación de fuentes** | No hay priorización por fuente ni combinación inteligente | MEDIUM |
| **Metadata limitada** | Tags simples, sin soporte para talent pool, reqs técnicos específicos | MEDIUM |
| **Sin histórico de filtros** | Analytics de hackathon preferences no persisten | LOW |

---

## Arquitectura Propuesta

### 📐 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                         │
│  GET /api/hackathons/devfolio?wallet=xxx&skills=...&min_prize   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  FastAPI Router  │
                    │  /devfolio route │
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐     ┌─────────▼────────┐  ┌────▼────┐
    │  CACHE  │     │  AGGREGATOR      │  │  SCORER │
    │ Redis   │     │ (multi-source)   │  │ (ML)    │
    │ TTL 1h  │     │                  │  │         │
    └────┬────┘     └─────────┬────────┘  └────┬────┘
         │                    │                │
    ┌────▼────────────────────▼────────────────▼─────┐
    │        PostgreSQL (Aggregated Results)        │
    │  - hackathons (union Devfolio + DoraHacks)   │
    │  - hackathon_metadata (tech_stack, talent)   │
    │  - user_match_cache (wallet → scores)        │
    └──────────────────────────────────────────────┘
         │                                │
    ┌────▼──────────┐            ┌──────▼──────────┐
    │ Devfolio MCP  │            │ DoraHacks       │
    │ Scraper       │            │ Scraper         │
    └───────────────┘            │ (exist)         │
                                 └─────────────────┘
```

### 🏗️ Componentes Nuevos

#### 1. **Route: `/api/hackathons/devfolio`** (`routes/devfolio.py`)
- GET con filtros (wallet, tags, min_prize, deadline_days, source)
- Cache-aware (ETag headers, If-Modified-Since)
- Scoring personalizado por wallet
- Paginación + sorting

#### 2. **Service Layer: `services/hackathon_aggregator.py`**
- Combina datos de múltiples fuentes
- Aplica filtros y sorting
- Maneja caché inteligente

#### 3. **Enhanced Scoring Engine: `services/match_scorer.py`**
- ML-ready scoring (coeficientes > pesos fijos)
- Considera perfil neuropsicológico del usuario
- Incorpora histórico de participación
- Prize pool normalizado por rank percentil

#### 4. **Metadata Extended: `models.HackathonMetadata`**
- Tech stack específico
- Talent pool size
- Participation history
- Source-specific fields (Devfolio: featured, rolling, etc)

---

## Cambios a Models & Schemas

### **A. Modelo `HackathonMetadata` (nuevo en `models.py`)**

```python
# services/api/models.py (agregar)

class HackathonMetadata(Base):
    """Extended metadata per hackathon source."""
    __tablename__ = "hackathon_metadata"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hackathon_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("hackathons.id"), nullable=False, unique=True
    )
    
    # Devfolio-specific
    source_specific: Mapped[dict] = mapped_column(JSON, default=dict)  # {featured, rolling, ...}
    tech_stack: Mapped[list[str]] = mapped_column(JSON, default=list)  # ["React", "Web3", ...]
    talent_pool_size: Mapped[int] = mapped_column(Integer, nullable=True)
    participation_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Scoring metadata
    skill_requirements: Mapped[dict] = mapped_column(JSON, default=dict)  # {skill -> criticality}
    difficulty_level: Mapped[str] = mapped_column(String(16), default="beginner")  # beginner|intermediate|expert
    track_count: Mapped[int] = mapped_column(Integer, default=1)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, 
        server_default=func.now(), onupdate=func.now()
    )
    
    # Relationship
    hackathon: Mapped[Hackathon] = relationship(
        "Hackathon", backref="metadata", uselist=False
    )
```

### **B. Modelo `UserMatchCache` (nuevo para scoring personal)**

```python
class UserMatchCache(Base):
    """Cache scores per user/wallet — expiración en 1 hora."""
    __tablename__ = "user_match_cache"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet_address: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    hackathon_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("hackathons.id"), nullable=False
    )
    
    # Scores personalizados
    match_score: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    urgency_score: Mapped[int] = mapped_column(Integer, default=0)  # days-based
    value_score: Mapped[int] = mapped_column(Integer, default=0)   # prize-based
    personalized_score: Mapped[float] = mapped_column(Float, default=0.0)  # weighted combo
    
    # Metadata para debugging y analytics
    score_components: Mapped[dict] = mapped_column(JSON, default=dict)  # {skill_overlap, recency, ...}
    user_skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    __table_args__ = (
        Index("idx_wallet_expires", "wallet_address", "expires_at"),
    )
```

### **C. Extensión de `Hackathon` model**

```python
# En models.py, agregar a Hackathon:

class Hackathon(Base):
    __tablename__ = "hackathons"
    
    # ... campos existentes ...
    
    # Nuevos campos
    tech_stack: Mapped[list[str]] = mapped_column(JSON, default=list)  # Duplicado de metadata para query rápida
    difficulty: Mapped[str] = mapped_column(String(16), default="beginner", index=True)
    last_verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    popularity_score: Mapped[float] = mapped_column(Float, default=0.5)  # 0-1 based on participation
    source_metadata: Mapped[dict] = mapped_column(JSON, default=dict)  # source-specific raw data
```

### **D. Nuevos Schemas en `schemas.py`**

```python
# services/api/schemas.py (agregar)

class HackathonMetadataRead(BaseModel):
    """Metadata extensible por hackathon."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    tech_stack: list[str]
    talent_pool_size: int | None
    participation_count: int
    difficulty_level: str
    track_count: int
    skill_requirements: dict[str, float]  # skill -> criticality 0-1

class HackathonFullRead(HackathonRead):
    """Extended hackathon response con metadata."""
    model_config = ConfigDict(from_attributes=True)
    
    tech_stack: list[str] = []
    difficulty: str = "beginner"
    popularity_score: float = 0.5
    metadata: HackathonMetadataRead | None = None

class HackathonFilterRequest(BaseModel):
    """Query parameters para /devfolio with validation."""
    wallet_address: str | None = None
    min_prize: int = 0
    max_prize: int = 999_999_999
    tags: list[str] = []  # Tag filter
    min_match_score: int = 0
    days_until_deadline: int = 90  # Default window
    difficulty_min: str = "beginner"  # beginner|intermediate|expert
    source: str = ""  # "" = all, "devfolio", "dorahacks"
    sort_by: str = "personalized_score"  # personalized_score|deadline|prize|match_score
    limit: int = 50
    offset: int = 0

class UserPersonalizedScore(BaseModel):
    """Personalized ranking per user."""
    hackathon_id: str
    title: str
    match_score: int  # User skill overlap
    urgency_score: int  # Deadline proximity
    value_score: int  # Prize relative importance
    personalized_score: float  # Weighted composite
    prize_pool: int
    deadline: str
    tags: list[str]
    score_reasoning: str  # "High AI demand, 5 days left, top 10% prize"
```

---

## Implementación del Endpoint

### **Archivo: `services/api/routes/devfolio.py` (nuevo)**

```python
"""
Devfolio Hackathons endpoint — aggregated with personal scoring.
GET /api/hackathons/devfolio?wallet=0x...&tags=AI,blockchain&min_prize=50000
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy import and_, desc, func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Hackathon, UserMatchCache, HackathonMetadata
from schemas import HackathonFullRead, UserPersonalizedScore, HackathonFilterRequest
from services.match_scorer import MatchScorer
from services.hackathon_aggregator import HackathonAggregator

log = logging.getLogger("xiima.routes.devfolio")
router = APIRouter()


@router.get(
    "/devfolio",
    response_model=dict,
    tags=["hackathons"],
    summary="Devfolio + Multi-source hackathons with personal scoring"
)
async def get_devfolio_hackathons(
    # Query filters
    wallet: str | None = Query(None, description="Wallet address for personalized scoring"),
    tags: str | None = Query(None, description="CSV tags filter: AI,blockchain"),
    min_prize: int = Query(0, ge=0, description="Minimum prize in USD"),
    max_prize: int = Query(999_999_999, ge=0, description="Maximum prize in USD"),
    difficulty_min: str = Query("beginner", description="Min difficulty: beginner|intermediate|expert"),
    min_score: int = Query(0, ge=0, le=100, description="Minimum match score"),
    days_window: int = Query(90, ge=1, le=365, description="Days until deadline"),
    source: str | None = Query(None, description="Filter by source: devfolio, dorahacks, devpost"),
    sort_by: str = Query("personalized_score", description="Sort: personalized_score|deadline|prize|match"),
    
    # Pagination
    limit: int = Query(50, ge=1, le=200, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    
    # Caching hints
    if_modified_since: str | None = Header(None),
    
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves hackathons from multiple sources (Devfolio, DoraHacks, Devpost)
    with optional personal scoring based on wallet address and skills.
    
    ### Scoring Logic (if wallet provided):
    - **match_score** (0-100): Skill overlap
    - **urgency_score** (0-100): Days to deadline (inverse)
    - **value_score** (0-100): Prize pool percentile
    - **personalized_score** (float): Weighted composite
    
    ### Caching:
    - Results cached 1 hour per wallet + filter combination
    - ETags supported for client-side caching
    - Redis background invalidation on new hackathon
    
    ### Example:
    ```
    GET /api/hackathons/devfolio?wallet=0xabc...&tags=AI,Web3&min_prize=50000&sort_by=personalized_score
    ```
    
    Returns:
    ```json
    {
        "total": 237,
        "limit": 50,
        "offset": 0,
        "hackathons": [...],
        "generated_at": "2026-03-19T15:30:00Z",
        "cache_key": "devfolio:wallet:0xabc...source:all:tags:AI,Web3"
    }
    ```
    """
    
    # Parse filter inputs
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    
    # Validate difficulty
    valid_difficulties = ["beginner", "intermediate", "expert"]
    if difficulty_min not in valid_difficulties:
        raise HTTPException(
            status_code=400,
            detail=f"difficulty_min must be one of {valid_difficulties}"
        )
    
    # Build cache key
    cache_key = _build_cache_key(
        wallet=wallet,
        tags=tag_list,
        min_prize=min_prize,
        max_prize=max_prize,
        source=source,
        difficulty_min=difficulty_min,
        years_window=days_window
    )
    
    # Try cache first (if no wallet, cache is shared; with wallet, it's personal)
    if wallet:
        ttl_minutes = 60
        cached_result = await _get_from_cache(db, wallet, cache_key, ttl_minutes)
        if cached_result:
            log.debug(f"Cache HIT for {wallet[:8]}... | {cache_key}")
            return cached_result
    
    # Build base query
    today = datetime.now().date()
    deadline_cutoff = (today + timedelta(days=days_window)).isoformat()
    
    query = select(Hackathon).where(
        and_(
            Hackathon.deadline <= deadline_cutoff,
            Hackathon.prize_pool >= min_prize,
            Hackathon.prize_pool <= max_prize,
        )
    )
    
    # Source filter
    if source:
        query = query.where(Hackathon.source == source)
    
    # Tags filter (ANY tag match)
    if tag_list:
        # Hackathon.tags is JSON list, need to check overlap
        tag_conditions = [
            func.jsonb_exists(Hackathon.tags, tag) for tag in tag_list
        ]
        query = query.where(or_(*tag_conditions))
    
    # Difficulty filter
    if difficulty_min != "beginner":
        difficulty_map = {"beginner": 0, "intermediate": 1, "expert": 2}
        min_val = difficulty_map[difficulty_min]
        # Assuming difficulty stored as string, need to join with metadata
        query = query.join(
            HackathonMetadata,
            Hackathon.id == HackathonMetadata.hackathon_id,
            isouter=True
        ).where(
            HackathonMetadata.difficulty_level.in_(
                [d for d, v in difficulty_map.items() if v >= min_val]
            )
        )
    
    # Get total count before pagination
    count_query = select(func.count()).select_from(Hackathon)
    # (apply same filters...)
    total_count = await db.scalar(count_query)
    
    # Sort
    sort_map: dict = {
        "personalized_score": "personalized_score",  # Only with wallet
        "deadline": Hackathon.deadline,
        "prize": desc(Hackathon.prize_pool),
        "match_score": desc(Hackathon.match_score),
    }
    
    if sort_by == "personalized_score" and not wallet:
        sort_by = "match_score"  # Fallback if no wallet
    
    if sort_by in sort_map and sort_by != "personalized_score":
        query = query.order_by(sort_map[sort_by])
    
    # Pagination
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    hackathons_raw = result.scalars().all()
    
    # Score with user profile if wallet provided
    scored_hackathons: list[UserPersonalizedScore] = []
    if wallet:
        scorer = MatchScorer(db=db, wallet_address=wallet)
        for h in hackathons_raw:
            score_obj = await scorer.score_for_user(h)
            scored_hackathons.append(score_obj)
        
        # Sort by personalized_score if requested
        if sort_by == "personalized_score":
            scored_hackathons.sort(
                key=lambda x: x.personalized_score,
                reverse=True
            )
    else:
        # Return basic scores
        scored_hackathons = [
            UserPersonalizedScore(
                hackathon_id=h.id,
                title=h.title,
                match_score=h.match_score,
                urgency_score=_compute_urgency_score(h.deadline),
                value_score=_compute_value_score(h.prize_pool, 50_000),  # avg reference
                personalized_score=float(h.match_score),
                prize_pool=h.prize_pool,
                deadline=h.deadline,
                tags=h.tags,
                score_reasoning=f"Match: {h.match_score}, Prize: ${h.prize_pool:,}, Deadline: {h.deadline}"
            )
            for h in hackathons_raw
        ]
    
    response = {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "hackathons": scored_hackathons,
        "generated_at": datetime.now().isoformat() + "Z",
        "cache_key": cache_key if wallet else None,
        "filters_applied": {
            "tags": tag_list,
            "min_prize": min_prize,
            "max_prize": max_prize,
            "difficulty_min": difficulty_min,
            "days_window": days_window,
            "source": source or "all",
        }
    }
    
    # Cache result if wallet provided
    if wallet:
        await _save_to_cache(db, wallet, cache_key, response, ttl_minutes=60)
    
    return response


# ─────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────

def _build_cache_key(
    wallet: str | None,
    tags: list[str],
    min_prize: int,
    max_prize: int,
    source: str | None,
    difficulty_min: str,
    years_window: int,
) -> str:
    """Deterministic cache key from filter parameters."""
    parts = [
        f"devfolio",
        f"w:{wallet[:16] if wallet else 'anon'}",
        f"t:{','.join(sorted(tags)) if tags else 'any'}",
        f"p:{min_prize}-{max_prize}",
        f"s:{source or 'all'}",
        f"d:{difficulty_min}",
        f"td:{years_window}",
    ]
    return ":".join(parts)


async def _get_from_cache(
    db: AsyncSession,
    wallet: str,
    cache_key: str,
    ttl_minutes: int,
) -> dict | None:
    """Check if cached result is fresh."""
    # TODO: Implement Redis lookup
    # For now, can use DB cache with TTL
    return None


async def _save_to_cache(
    db: AsyncSession,
    wallet: str,
    cache_key: str,
    response: dict,
    ttl_minutes: int,
) -> None:
    """Store cached result."""
    # TODO: Implement Redis storage with TTL
    pass


def _compute_urgency_score(deadline: str) -> int:
    """Score 0-100 based on days until deadline."""
    deadline_date = datetime.fromisoformat(deadline).date()
    days_left = (deadline_date - datetime.now().date()).days
    
    if days_left <= 0:
        return 0
    elif days_left >= 90:
        return 5
    else:
        # Linear: 90 days = 5, 0 days = 100
        return max(5, min(100, int(100 - (days_left / 90 * 95))))


def _compute_value_score(prize: int, avg_prize: int = 50_000) -> int:
    """Score 0-100 based on prize pool relative to average."""
    if prize <= 0:
        return 5
    
    ratio = prize / avg_prize
    if ratio >= 2.0:
        return 100
    elif ratio >= 1.0:
        return 70 + int((ratio - 1.0) / 1.0 * 30)
    else:
        return 35 + int(ratio * 35)
```

---

## Scoring Inteligente Mejorado

### **Archivo: `services/api/services/match_scorer.py` (nuevo)**

```python
"""
Intelligent match scoring — considers user skills, historical participation,
and hackathon difficulty. Multi-factor scoring engine.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    Hackathon, UserMatchCache, 
    SkillDemand, UserAchievement,
    UserNeuroProfile
)
from schemas import UserPersonalizedScore

log = logging.getLogger("xiima.services.match_scorer")


class MatchScorer:
    """
    Multifactor scoring engine.
    
    Factors:
    1. Skill overlap (40%) — user skills vs hackathon requirements
    2. Urgency (20%) — days until deadline
    3. Prize value (15%) — relative prize pool
    4. Participation history (15%) — user's track record in similar hackathons
    5. Neuroplasticity fit (10%) — user's cognitive profile match
    """
    
    # Configurable weights
    WEIGHTS = {
        "skill_overlap": 0.40,
        "urgency": 0.20,
        "value": 0.15,
        "history": 0.15,
        "neuro_fit": 0.10,
    }
    
    def __init__(self, db: AsyncSession, wallet_address: str):
        self.db = db
        self.wallet = wallet_address
        self._user_skills: list[str] | None = None
        self._user_neuro: dict | None = None
        self._history_cache: dict | None = None
    
    async def score_for_user(self, hackathon: Hackathon) -> UserPersonalizedScore:
        """
        Compute personalized score for a user on a specific hackathon.
        
        Returns cached result if fresh, otherwise computes.
        """
        # Check cache first
        cache_result = await self._get_cached_score(hackathon.id)
        if cache_result:
            return cache_result
        
        # Compute components
        skill_score = await self._score_skill_overlap(hackathon)
        urgency_score = self._score_urgency(hackathon.deadline)
        value_score = self._score_value(hackathon.prize_pool)
        history_score = await self._score_participation_history(hackathon)
        neuro_score = await self._score_neuroplasticity_fit(hackathon)
        
        # Weighted composite
        personalized_score = (
            skill_score * self.WEIGHTS["skill_overlap"] +
            urgency_score * self.WEIGHTS["urgency"] +
            value_score * self.WEIGHTS["value"] +
            history_score * self.WEIGHTS["history"] +
            neuro_score * self.WEIGHTS["neuro_fit"]
        )
        
        # Build response
        result = UserPersonalizedScore(
            hackathon_id=hackathon.id,
            title=hackathon.title,
            match_score=int(skill_score),
            urgency_score=int(urgency_score),
            value_score=int(value_score),
            personalized_score=personalized_score,
            prize_pool=hackathon.prize_pool,
            deadline=hackathon.deadline,
            tags=hackathon.tags,
            score_reasoning=self._build_reasoning(
                skill_score, urgency_score, value_score, history_score, neuro_score
            ),
        )
        
        # Cache result
        await self._cache_score(hackathon.id, result)
        
        return result
    
    async def _score_skill_overlap(self, hackathon: Hackathon) -> float:
        """
        Compute skill overlap between user and hackathon.
        - User skills: from SkillDemand.user_score > 0.3
        - Req skills: from hackathon.tags + tech_stack
        - Score: Jaccard similarity or weighted overlap
        """
        if not self._user_skills:
            await self._load_user_skills()
        
        user_skills_set = set(self._user_skills)
        hackathon_skills_set = set(hackathon.tags)
        
        # Intersection / Union (Jaccard)
        if not user_skills_set or not hackathon_skills_set:
            return 5.0
        
        intersection = len(user_skills_set & hackathon_skills_set)
        union = len(user_skills_set | hackathon_skills_set)
        
        jaccard_sim = intersection / union if union > 0 else 0
        score = max(5, int(jaccard_sim * 100))
        
        log.debug(f"Skill overlap: {intersection}/{union} = {jaccard_sim:.2%} → {score}")
        return float(score)
    
    def _score_urgency(self, deadline: str) -> float:
        """
        Urgency based on days until deadline.
        - 0-7 days: 100 (critical)
        - 7-30 days: 70-100 (high)
        - 30-90 days: 40-70 (medium)
        - 90+ days: 5-40 (low)
        """
        deadline_date = datetime.fromisoformat(deadline).date()
        days_left = (deadline_date - datetime.now().date()).days
        
        if days_left <= 0:
            return 5.0
        elif days_left <= 7:
            return 100.0
        elif days_left <= 30:
            return 70.0 + (days_left - 7) / 23.0 * 30.0
        elif days_left <= 90:
            return 40.0 + (days_left - 30) / 60.0 * 30.0
        else:
            return max(5.0, 40.0 - (days_left - 90) / 275.0 * 35.0)
    
    def _score_value(self, prize_pool: int) -> float:
        """
        Prize pool significance.
        Reference: avg prize ~$50K, median ~$25K
        - <$10K: 15
        - $10-50K: 25-60
        - $50-100K: 60-85
        - $100K+: 85-100
        """
        if prize_pool <= 0:
            return 5.0
        elif prize_pool <= 10_000:
            return 15.0
        elif prize_pool <= 50_000:
            return 25.0 + (prize_pool - 10_000) / 40_000 * 35.0
        elif prize_pool <= 100_000:
            return 60.0 + (prize_pool - 50_000) / 50_000 * 25.0
        else:
            return min(100.0, 85.0 + (prize_pool - 100_000) / 1_000_000 * 15.0)
    
    async def _score_participation_history(self, hackathon: Hackathon) -> float:
        """
        User's historical participation in similar hackathons.
        - First time: 50
        - 1-3 times: 60-75
        - 4+ times: 80-100
        """
        # TODO: Query user_achievements + hackathon_history
        # Stub: return neutral score
        return 50.0
    
    async def _score_neuroplasticity_fit(self, hackathon: Hackathon) -> float:
        """
        Align hackathon difficulty with user's neuroplasticity.
        - Beginner difficulty + high plasticity: 60
        - Expert difficulty + low plasticity: 30
        - Match: 75+
        """
        if not self._user_neuro:
            await self._load_user_neurio_profile()
        
        neuroplasticity = self._user_neuro.get("neuroplasticity", 0.5)
        difficulty_map = {"beginner": 0, "intermediate": 1, "expert": 2}
        difficulty_val = difficulty_map.get(hackathon.difficulty, 1)
        
        # Match score is highest when difficulty aligns with plasticity
        match = 1.0 - abs(difficulty_val / 2.0 - neuroplasticity)
        score = 30.0 + match * 70.0
        
        return score
    
    async def _load_user_skills(self) -> None:
        """Load user's top skills from database."""
        result = await self.db.execute(
            select(SkillDemand.label).where(
                SkillDemand.user_score >= 0.3  # Min proficiency
            ).order_by(SkillDemand.user_score.desc()).limit(15)
        )
        self._user_skills = result.scalars().all() or []
    
    async def _load_user_neurio_profile(self) -> None:
        """Load user's neuropsychological profile."""
        result = await self.db.execute(
            select(UserNeuroProfile).where(
                UserNeuroProfile.wallet_address == self.wallet
            )
        )
        profile = result.scalars().first()
        
        self._user_neuro = {
            "neuroplasticity": profile.neuroplasticity if profile else 0.5,
            "dominant_cognitive": profile.dominant_cognitive if profile else "balanced",
        }
    
    async def _get_cached_score(self, hackathon_id: str) -> UserPersonalizedScore | None:
        """Check if cached score is fresh (<1 hour)."""
        result = await self.db.execute(
            select(UserMatchCache).where(
                UserMatchCache.wallet_address == self.wallet,
                UserMatchCache.hackathon_id == hackathon_id,
                UserMatchCache.expires_at > datetime.now(),
            )
        )
        cached = result.scalars().first()
        
        if cached:
            return UserPersonalizedScore(
                hackathon_id=cached.hackathon_id,
                title="",  # Would need join to get
                match_score=cached.match_score,
                urgency_score=cached.urgency_score,
                value_score=cached.value_score,
                personalized_score=cached.personalized_score,
                prize_pool=0,
                deadline="",
                tags=[],
                score_reasoning="",
            )
        return None
    
    async def _cache_score(self, hackathon_id: str, score: UserPersonalizedScore) -> None:
        """Cache score for 1 hour."""
        cache_entry = UserMatchCache(
            wallet_address=self.wallet,
            hackathon_id=hackathon_id,
            match_score=int(score.match_score),
            urgency_score=int(score.urgency_score),
            value_score=int(score.value_score),
            personalized_score=score.personalized_score,
            score_components={
                "skill_overlap": score.match_score,
                "urgency": score.urgency_score,
                "value": score.value_score,
            },
            expires_at=datetime.now() + timedelta(hours=1),
        )
        self.db.add(cache_entry)
        await self.db.commit()
    
    def _build_reasoning(
        self,
        skill: float,
        urgency: float,
        value: float,
        history: float,
        neuro: float,
    ) -> str:
        """Human-readable scoring explanation."""
        factors = []
        
        if skill > 75:
            factors.append(f"Strong skill match ({skill:.0f}%)")
        elif skill > 50:
            factors.append(f"Good skill overlap ({skill:.0f}%)")
        
        if urgency > 80:
            factors.append("Deadline approaching")
        elif urgency < 20:
            factors.append("Plenty of time")
        
        if value > 75:
            factors.append(f"High prize pool (${value:.0f})")
        
        return " • ".join(factors) if factors else "Moderate fit"
```

---

## Agregación de Múltiples Fuentes

### **Archivo: `services/api/services/hackathon_aggregator.py` (nuevo)**

```python
"""
Multi-source hackathon aggregation and ranking.
Combines Devfolio, DoraHacks, Devpost with smart deduplication.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models import Hackathon, HackathonMetadata

log = logging.getLogger("xiima.services.hackathon_aggregator")


class HackathonAggregator:
    """
    Aggregates hackathons from multiple sources into unified ranking.
    
    Deduplication:
    - Exact title match → merge
    - Fuzzy title match (>90%) → flag for review
    - Same deadline + prize → likely same event
    
    Prioritization:
    1. Devfolio (official curated) — +10 priority
    2. DoraHacks (large ecosystem) — baseline
    3. Devpost (legacy) — -5 priority
    4. Custom pools — -10 priority
    """
    
    SOURCE_PRIORITY = {
        "devfolio": 10,
        "dorahacks": 0,
        "devpost": -5,
        "custom": -10,
    }
    
    SOURCE_WEIGHT = {
        "devfolio": 1.2,
        "dorahacks": 1.0,
        "devpost": 0.9,
    }
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def aggregate_by_source(
        self,
        sources: list[str] | None = None,
        min_prize: int = 0,
        max_prize: int = 999_999_999,
        days_window: int = 90,
    ) -> list[dict]:
        """
        Returns aggregated hackathons ranked by novelty + source quality.
        
        Ranking logic:
        - Recent Devfolio → high
        - Old DoraHacks → lower
        - Multiple sources covering same event → promoted
        """
        
        if not sources:
            sources = ["devfolio", "dorahacks", "devpost"]
        
        query = select(Hackathon).where(
            Hackathon.source.in_(sources),
            Hackathon.prize_pool.between(min_prize, max_prize),
            Hackathon.deadline <= (datetime.now() + timedelta(days=days_window)).isoformat(),
        )
        
        result = await self.db.execute(query)
        hackathons = result.scalars().all()
        
        # Rank by freshness + source quality
        ranked = []
        for h in hackathons:
            recency_score = self._score_recency(h.updated_at)
            source_quality = self.SOURCE_PRIORITY.get(h.source, 0)
            
            final_score = recency_score + source_quality
            ranked.append((final_score, h))
        
        ranked.sort(key=lambda x: x[0], reverse=True)
        return [h.to_dict() for _, h in ranked]
    
    @staticmethod
    def _score_recency(updated_at: datetime) -> float:
        """Score 0-20 based on how recently updated."""
        hours_ago = (datetime.now() - updated_at).total_seconds() / 3600
        
        if hours_ago < 1:
            return 20.0
        elif hours_ago < 24:
            return 15.0
        elif hours_ago < 168:  # 1 week
            return 10.0
        elif hours_ago < 720:  # 1 month
            return 5.0
        else:
            return 1.0
    
    async def detect_duplicates(self) -> list[tuple[Hackathon, Hackathon]]:
        """
        Find likely duplicate hackathons across sources.
        Returns pairs (h1, h2) where h1 and h2 are probably the same event.
        """
        # Get all hackathons
        result = await self.db.execute(select(Hackathon))
        all_hackathons = result.scalars().all()
        
        duplicates = []
        for i, h1 in enumerate(all_hackathons):
            for h2 in all_hackathons[i+1:]:
                # Expensive: fuzzy match titles
                if self._likely_duplicate(h1, h2):
                    duplicates.append((h1, h2))
                    log.info(f"Likely duplicate: {h1.title} ({h1.source}) ≈ {h2.title} ({h2.source})")
        
        return duplicates
    
    @staticmethod
    def _likely_duplicate(h1: Hackathon, h2: Hackathon) -> bool:
        """
        Check if two hackathons are likely the same event.
        """
        # Different sources
        if h1.source == h2.source:
            return False
        
        # Same title exactly
        if h1.title.lower() == h2.title.lower():
            return True
        
        # Same prize, deadline, and similar title (fuzzy)
        if h1.prize_pool == h2.prize_pool and h1.deadline == h2.deadline:
            # Compute string similarity (Levenshtein or Jaro-Winkler)
            from difflib import SequenceMatcher
            ratio = SequenceMatcher(None, h1.title.lower(), h2.title.lower()).ratio()
            if ratio > 0.85:
                return True
        
        return False
```

---

## Performance & Caching

### **Redis Cache Strategy**

| Cache Key | TTL | Trigger |
|-----------|-----|---------|
| `devfolio:all:recent` | 15 min | Periodic sync |
| `devfolio:wallet:{wallet}:{filter_hash}` | 60 min | User request |
| `hackathons:metadata:{id}` | 24 hours | First query |
| `scores:user:{wallet}:{hackathon_id}` | 60 min | Scoring |

### **Database Indexing (add to migration)**

```sql
-- Improved query performance
CREATE INDEX idx_hackathons_source_deadline 
  ON hackathons(source, deadline DESC);

CREATE INDEX idx_hackathons_source_prize 
  ON hackathons(source, prize_pool DESC);

CREATE INDEX idx_hackathons_tech_stack 
  ON hackathons USING GIN(tech_stack);

CREATE INDEX idx_user_match_cache_expires 
  ON user_match_cache(wallet_address, expires_at DESC);

-- Analytics queries
CREATE INDEX idx_hackathons_updated_at 
  ON hackathons(updated_at DESC);
```

### **Query Optimization Tips**

```python
# ❌ ANTI-PATTERN: N+1 queries
for h in hackathons:
    meta = await db.get(HackathonMetadata, h.id)  # One query per hackathon!

# ✅ GOOD: Eager load with join
query = select(Hackathon).options(
    joinedload(Hackathon.metadata)
).where(Hackathon.source == "devfolio")

# ✅ GOOD: Batch scoring with cache check
uncached_ids = [h.id for h in hackathons if not is_cached(h.id, wallet)]
cache_hits = await get_cached_scores(wallet, [h.id for h in hackathons])
new_scores = await score_batch(uncached_ids)
```

---

## Roadmap de Implementación

### **Phase 1 (Weeks 1-2): Core Endpoint**
- [ ] Crear `routes/devfolio.py` con GET `/api/hackathons/devfolio`
- [ ] Add schemas: `HackathonFullRead`, `UserPersonalizedScore`
- [ ] Basic filtering (tags, prize, source)
- [ ] Register route in `main.py`
- [ ] Unit tests

**Deliverable**: `GET /devfolio?tags=AI,Web3&min_prize=50000` returns list

---

### **Phase 2 (Weeks 2-3): Models & Metadata**
- [ ] Create migration: add `HackathonMetadata`, `UserMatchCache` tables
- [ ] Extend `Hackathon` model with new fields
- [ ] Update `devfolio_mcp.py` to populate `tech_stack`, `difficulty`
- [ ] Add DB indexes for performance

**Deliverable**: Metadata ingestion from Devfolio API response

---

### **Phase 3 (Weeks 3-4): Intelligent Scoring**
- [ ] Implement `MatchScorer` service
- [ ] Add skill overlap logic (Jaccard)
- [ ] Urgency + value scoring
- [ ] Caching layer in `UserMatchCache`
- [ ] Tests for scoring algorithm

**Deliverable**: Wallet-aware scoring with 40-point improvement over baseline

---

### **Phase 4 (Week 5): Multi-source Aggregation**
- [ ] Implement `HackathonAggregator`
- [ ] Duplicate detection (fuzzy matching)
- [ ] Source priority weighting
- [ ] Merge endpoint support (optional)
- [ ] Analytics dashboard

**Deliverable**: Unified hackathon listing from 3+ sources

---

### **Phase 5 (Week 6): Caching & Optimization**
- [ ] Redis integration for cache
- [ ] ETags + If-Modified-Since
- [ ] Batch scoring
- [ ] Query optimization + EXPLAIN ANALYZE
- [ ] Load testing (Apache Bench)

**Deliverable**: P99 < 200ms for paginated queries

---

## Testing Strategy

```bash
# Unit tests for scoring
pytest services/api/tests/test_match_scorer.py -v

# Integration tests for endpoint
pytest services/api/tests/test_devfolio_endpoint.py -v

# Load testing
ab -n 1000 -c 100 "http://localhost:8000/api/hackathons/devfolio?limit=50"

# Scoring accuracy vs ground truth
pytest services/api/tests/test_scoring_accuracy.py -v
```

---

## Monitoring & Observability

```python
# Log important scoring decisions
log.info(f"Scored hackathon {h.id}: skill={skill:.0f}, urgency={urgency:.0f}, "
         f"value={value:.0f} → final={final:.1f}")

# Metrics to track
- avg_response_time (ms)
- cache_hit_ratio (%)
- scoring_consistency (same user, same time, same score?)
- top_source_breakdown (% Devfolio vs DoraHacks)
```

---

## Conclusiones

### Ventajas de este diseño:

1. **Escalable**: Multi-source agregation sin impacto en los datos existentes
2. **User-centric**: Scoring personalizado considerando perfil neuropsicológico
3. **Performante**: Cache inteligente + índices DB optimizados
4. **Flexible**: Nuevas fuentes (Devpost, custom pools) se integran fácilmente
5. **Auditable**: Reasoning scores explícitos, trace de cálculos

### Trade-offs:

| Decisión | Pro | Contra |
|----------|-----|--------|
| Redis vs DB cache | Rápido | Extra infraestructura |
| Jaccard similarity | Preciso | N+1 en queries grandes |
| 1h TTL scores | Fresh | Puede repetir cálculos |
| Metadata table | Flexible | Más joins |

---

## Próximos Pasos Recomendados

1. **Validación rápida**: Verificar que `devfolio_mcp.py` devuelve data correctamente en staging
2. **Prototip endpoint**: MVP GET `/devfolio` SIN scoring (solo raw + filters)
3. **Testing**: Usar datos mock del scraper para iterar rápido
4. **Rollout gradual**: Blue-green deployment en Docker Compose

