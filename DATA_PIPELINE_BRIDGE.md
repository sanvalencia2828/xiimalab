# 🏗️ Data Pipeline Bridge: Scraper → Skills → Projects

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    XIIMALAB DATA FLOW                        │
└─────────────────────────────────────────────────────────────┘

Scraper Layer
    ↓
    ├─ services/scraper/devfolio_mcp.py (MCP Client)
    ├─ services/scraper/scraper.py (Orchestrator)
    └─ services/scraper/integrations/* (DoraHacks, Devpost, etc.)
    
    ↓ [Raw hackathon data]
    
Database Layer (PostgreSQL)
    ↓
    ├─ services/api/services/sync_devfolio.py (Upsert logic)
    ├─ services/api/services/hackathon_db.py (DB operations)
    └─ hackathons table (bulk insert via asyncpg)
    
    ↓ [INSERT/UPDATE → ON CONFLICT]
    
Analysis Layer (LLM + AI)
    ↓
    ├─ services/api/routes/analyze.py (FastAPI endpoint)
    ├─ engine/agent_crew.py (Scout → Analyzer → Oracle → Writer)
    └─ AI analysis stored in hackathon.ai_analysis (JSON)
    
    ↓ [Processed insights]
    
Skills Extraction & Project Matching
    ↓
    ├─ engine/agent_crew.py → ProjectAnalyzer
    ├─ engine/agent_crew.py → MatchOracle
    └─ services/api/models.py: UserSkillProfile, SkillDemand
    
    ↓ [Final project_ideas generation]
    
Output
    └─ Frontend visualization (PriorityBoard, NeuroProfileDashboard)
```

---

## 1️⃣ **Modelos de Datos (Data Models)**

### A. Hackathon (Scraped)
**Ubicación:** `services/api/models.py`

```python
class Hackathon(Base):
    __tablename__ = "hackathons"
    
    id: str                           # MD5(title.lower())[:12] — deterministic ID
    title: str                        # Hackathon name
    prize_pool: int                   # Total prize in USD
    tags: list[dict]                  # [{"name": "web3", "weight": 0.8}, ...]
    deadline: str                     # ISO format
    match_score: int                  # 0-100 (computed during scrape)
    source_url: str                   # Original hackathon URL
    source: str                       # "dorahacks", "devfolio", "devpost"
    
    # AI Analysis (added in Phase 3)
    ai_analysis: dict | None          # {"skills_required": [...], "difficulty": "...", ...}
    
    # Devfolio-specific
    tech_stack: list[str] | None      # ["React", "Node.js", "Solana", ...]
    difficulty: str | None            # "beginner", "intermediate", "advanced"
    requirements: list[str] | None    # Skill requirements
    description: str | None           # Full description for LLM
    
    scraped_at: datetime              # When scraper fetched it
    updated_at: datetime              # Last update timestamp
```

### B. SkillDemand (Market Analysis)
**Ubicación:** `services/api/models.py`

```python
class SkillDemand(Base):
    __tablename__ = "skill_demands"
    
    id: int                           # Primary key
    label: str                        # "Python", "Solana", "Leadership"
    sublabel: str | None              # "Backend Development", "Blockchain", etc.
    user_score: float                 # User's proficiency (0-1)
    market_demand: float              # Market trend (0-1)
    color: str                        # UI color code
    updated_at: datetime              # Last market update
```

### C. UserSkillProfile (User's Skills)
**Ubicación:** `services/db/init_supabase.sql`

```sql
CREATE TABLE user_skill_profiles (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(64) UNIQUE,
    
    verified_skills JSONB,            -- [{"name": "Python", "hours": 50, "mastery": 0.7}, ...]
    preferred_tech_stack JSONB,       -- ["React", "Solana", "Rust"]
    learning_history JSONB,           -- History of learning activities
    certifications JSONB,             -- Completed certifications
    
    total_skill_hours FLOAT,          -- Total hours invested
    skill_diversity_score FLOAT,      -- Breadth of skills (0-1)
    neuroplasticity_score FLOAT,      -- Learning capacity (0-1)
    
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

---

## 2️⃣ **Lógica de Procesamiento (Processing Logic)**

### Fase A: Scraping Raw Data
**Archivos clave:**
- `services/scraper/devfolio_mcp.py` — MCP client que obtiene hackathones de Devfolio API
- `services/scraper/scraper.py` — Orchestrator principal (Devfolio, DoraHacks, Devpost)

**Flujo:**
```python
# scraper.py
async def main():
    scheduler = AsyncIOScheduler()
    
    # Schedule runs every SCRAPER_INTERVAL_MINUTES (default: 30)
    scheduler.add_job(
        scrape_and_sync,
        'interval',
        minutes=SCRAPER_INTERVAL_MINUTES
    )

async def scrape_and_sync():
    # 1. Fetch raw hackathons from Devfolio MCP
    raw_hackathons = await DevfolioMCPClient.get_hackathons()
    
    # 2. Normalize & compute match_score
    items = parser.parse_all(raw_hackathons)
    
    # 3. Upsert to PostgreSQL
    await upsert_hackathons(items)  # Uses asyncpg directly (fast bulk insert)
    
    # 4. Trigger AI Analysis Pipeline
    await trigger_ai_analysis(items)      # Calls POST /analyze/hackathon
    await trigger_project_matchmaking(items)  # Calls POST /api/agents/strategist/match-projects
```

### Fase B: Upsert a Base de Datos
**Ubicación:** `services/api/services/sync_devfolio.py` + `services/scraper/scraper.py`

**Método 1: Direct asyncpg (Scraper)**
```python
# scraper.py → upsert_hackathons()
await conn.executemany(
    """
    INSERT INTO hackathons (id, title, prize_pool, tags, deadline, match_score, source_url, source)
    VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        prize_pool = EXCLUDED.prize_pool,
        tags = EXCLUDED.tags,
        deadline = EXCLUDED.deadline,
        updated_at = NOW()
    """,
    records  # List of tuples
)
```

**Método 2: SQLAlchemy ORM (API)**
```python
# services/api/services/sync_devfolio.py
from models import Hackathon

async def sync_devfolio(db: AsyncSession):
    # Fetch from Devfolio MCP
    client = DevfolioMCPClient(api_key)
    raw_hackathons = await client.get_hackathons()
    
    # Normalize
    normalized = [normalize_devfolio_hackathon(raw) for raw in raw_hackathons]
    
    # Upsert via SQLAlchemy
    for item in normalized:
        existing = await db.get(Hackathon, item['id'])
        if existing:
            for key, value in item.items():
                setattr(existing, key, value)
        else:
            db.add(Hackathon(**item))
    
    await db.flush()
```

**Deterministic ID Generation:**
```python
# parser.py → compute_match_score() et al.
import hashlib

def generate_hackathon_id(title: str) -> str:
    """Generate deterministic ID for idempotent upserts."""
    return hashlib.md5(title.lower().encode()).hexdigest()[:12]
```

---

## 3️⃣ **Triggers de Transformación (What Triggers Data Transformation)**

### 3a. **CRON Job** (Automatic Scheduling)
- **Orchestrator:** `services/scraper/scraper.py`
- **Interval:** Every 30 minutes (configurable via `SCRAPER_INTERVAL_MINUTES`)
- **Trigger Type:** APScheduler AsyncIOScheduler
- **Action:** Scrapes all sources, upserts hackathons, triggers analysis

```python
scheduler.add_job(
    scrape_and_sync,
    'interval',
    minutes=int(os.environ.get("SCRAPER_INTERVAL_MINUTES", 30))
)
```

### 3b. **Manual Endpoint** (On-Demand)
- **Route:** `POST /hackathons/sync` in `services/api/routes/hackathons.py`
- **Who calls it:** Frontend via SyncButton, admin panel, or external trigger
- **Payload:** None (reads from scraper URL)
- **Response:** `{"status": "success", "message": "Manual sync triggered"}`

```python
@router.post("/sync")
async def trigger_manual_sync():
    scraper_url = os.environ.get("SCRAPER_URL", "http://localhost:9000")
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(f"{scraper_url}/sync")
        return {"status": "success"} if resp.status_code == 202 else {"status": "error"}
```

### 3c. **Event Notifications** (Real-Time Pub/Sub)
- **Redis Channel:** `hackathons:new`
- **Publisher:** `scraper.py` → `upsert_hackathons()`
- **Subscriber:** Frontend WebSocket listeners, backend agents
- **Payload:** New hackathon metadata

```python
# scraper.py → upsert_hackathons()
for item in items:
    await redis_client.publish(
        REDIS_HACKATHONS_CHANNEL,
        json.dumps({
            "id": item["id"],
            "title": item["title"],
            "prize_pool": item["prize_pool"],
            "tags": item["tags"],
            "deadline": item["deadline"],
            "match_score": item["match_score"],
            "source": item["source"],
            "scraped_at": datetime.now(timezone.utc).isoformat()
        })
    )
```

---

## 4️⃣ **LLM Analysis Pipeline (Scraped Data → AI Analysis)**

### Step 1: Trigger Analysis
**Route:** `POST /analyze/hackathon` (assumed to exist in FastAPI)
**Called by:** `scraper.py` → `trigger_ai_analysis()`

```python
# scraper.py
async def trigger_ai_analysis(items: list[dict]):
    """Call the API analyze endpoint for each newly found hackathon."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        for item in items:
            analyze_url = f"{API_URL}/analyze/hackathon"
            payload = {
                "id": item["id"],
                "title": item["title"],
                "tags": item["tags"],
                "prize_pool": item["prize_pool"],
                "description": item.get("description", "")
            }
            resp = await client.post(analyze_url, json=payload)
```

### Step 2: Agent Crew Processes Data
**Location:** `engine/agent_crew.py`
**Four-Agent Orchestration:**

```
┌──────────────────┐
│ HackathonScout   │  — Discovers new opportunities from scraped data
└────────┬─────────┘
         ↓ [hackathons → insights]
┌──────────────────┐
│ ProjectAnalyzer  │  — Analyzes user's existing projects
└────────┬─────────┘
         ↓ [projects → skill demands]
┌──────────────────┐
│  MatchOracle     │  — Crosses hackathons × projects → matches
└────────┬─────────┘
         ↓ [matches → insights]
┌──────────────────┐
│ OpportunityWriter│  — Generates final project_ideas & recommendations
└──────────────────┘
         ↓
     AgentSignals table
     InsightCards table
```

**Code Flow:**
```python
# engine/agent_crew.py
async def run_crew(triggered_by: str = "api") -> dict:
    """
    Full crew execution:
    Scout → Analyzer → Oracle → Writer
    """
    ctx = CrewContext(run_id=run_id)
    
    agents = [
        HackathonScout(),
        ProjectAnalyzer(),
        MatchOracle(),
        OpportunityWriter(),
    ]
    
    for agent in agents:
        await agent.run(conn, ctx)
    
    return {
        "insights_created": ctx.insights_created,
        "projects": len(ctx.projects),
        "hackathons": len(ctx.hackathons),
        "matches": len(ctx.matches)
    }
```

### Step 3: Update Hackathon with AI Analysis
**Storage:** `hackathon.ai_analysis` (JSON column)

```python
# Pseudo-code for updating hackathon
UPDATE hackathons
SET ai_analysis = {
    "skills_required": ["Python", "Solana", "React"],
    "difficulty": "intermediate",
    "best_for": "Blockchain + Web3 developers",
    "project_ideas": [
        {
            "title": "Solana dApp Builder",
            "description": "...",
            "skills_covered": ["Solana", "React", "Rust"]
        }
    ]
}
WHERE id = $1;
```

---

## 5️⃣ **Skills Extraction & Project Generation (Analysis → Skills → Projects)**

### A. Skills Demand Analysis
**Route (assumed):** `GET /insights/tag-analysis`
**Source:** Parses all hackathon tags from scraped data

```python
# Conceptual flow from services/api/routes/insights.py
@router.get("/tag-analysis")
async def get_tag_analysis(db: AsyncSession):
    """Analyze most-demanded tags in the market."""
    
    # 1. Query all hackathons
    hackathons = await db.execute(
        select(Hackathon).filter(Hackathon.source == "active")
    )
    
    # 2. Extract & weight tags
    tag_counts = {}
    for h in hackathons:
        for tag in h.tags:
            tag_counts[tag['name']] = tag_counts.get(tag['name'], 0) + tag['weight']
    
    # 3. Rank by demand
    top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:20]
    
    # 4. Update SkillDemand table
    for tag, count in top_tags:
        existing = await db.get(SkillDemand, tag)
        if existing:
            existing.market_demand = count / max(tag_counts.values())
        else:
            db.add(SkillDemand(label=tag, market_demand=count / max(tag_counts.values())))
    
    return {"top_tags": top_tags}
```

### B. Project Matching (Background Matchmaker)
**Route:** `POST /api/agents/strategist/match-projects`
**Called by:** `scraper.py` → `trigger_project_matchmaking()`

```python
# scraper.py
async def trigger_project_matchmaking(items: list[dict]):
    """Background Agent Matchmaker: crosses new hackathons with active user projects."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        match_url = f"{API_URL}/api/agents/strategist/match-projects"
        payload = {"hackathons": items}
        resp = await client.post(match_url, json=payload)
        
        if resp.status_code == 200:
            data = resp.json()
            log.info(f"✅ Background Matchmaker found {data.get('matches_found', 0)} new matches!")
```

### C. Project Ideas Generation
**Storage:** `UserProject` + `ai_analysis` field in Hackathon
**Output:** Used in `PriorityBoard.tsx` and `NeuroProfileDashboard.tsx`

```python
# Pseudo-code from MatchOracle agent
class MatchOracle:
    async def run(self, conn: asyncpg.Connection, ctx: CrewContext):
        """Generate project_ideas by matching hackathons × user skills."""
        
        for hackathon in ctx.hackathons:
            for project in ctx.projects:
                # Compute match score
                match = compute_match_score(hackathon, project, ctx)
                
                if match['score'] > 0.6:  # threshold
                    ctx.matches.append({
                        "hackathon_id": hackathon['id'],
                        "project_id": project['id'],
                        "match_score": match['score'],
                        "recommendation": match['reason']
                    })
        
        # Generate project ideas from matches
        ctx.insights_created = len(ctx.matches)
```

---

## 6️⃣ **The Complete Join Point (Exact File Paths)**

| **Phase** | **Input** | **Process** | **Output File** | **Database Table** |
|-----------|-----------|-----------|-----------------|-------------------|
| **1. Scrape** | Devfolio/DoraHacks API | `services/scraper/devfolio_mcp.py` `services/scraper/scraper.py` | Raw hackathon JSON | `hackathons` (INSERT via asyncpg) |
| **2. Normalize** | Raw JSON | `services/scraper/parser.py` (or inline in scraper.py) | Computed match_score | `hackathons.match_score` |
| **3. Upsert** | Normalized dict | `services/api/services/sync_devfolio.py` or direct asyncpg in `scraper.py` | SQL INSERT ON CONFLICT | `hackathons` table updated |
| **4. Analyze** | Hackathon records | `engine/agent_crew.py:HackathonScout` + LLM (Anthropic Claude) | AI insights (JSON) | `hackathons.ai_analysis` |
| **5. Extract Skills** | AI analysis + tags | `services/api/routes/devfolio.py` + `engine/parser.py` | Tag frequency analysis | `skill_demands` table updated |
| **6. Project Matching** | User projects + hackathons | `engine/agent_crew.py:MatchOracle` | Match scores | `user_projects` + context storage |
| **7. Generate Ideas** | Matches + skills | `engine/agent_crew.py:OpportunityWriter` | Project recommendations | `user_projects` + response JSON |
| **8. Display** | Recommendations | Frontend components | React UI | Browser render |

---

## 7️⃣ **Key Environment Variables**

```bash
# Scraper timing
SCRAPER_INTERVAL_MINUTES=30

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:8000
SCRAPER_URL=http://localhost:9000

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/xiimalab

# LLM Analysis
ANTHROPIC_API_KEY=sk-...

# Redis (for real-time pub/sub)
REDIS_URL=redis://localhost:6379

# Devfolio MCP
DEVFOLIO_MCP_API_KEY=dbc8a11b0904ec8e6f792e7a271ff9a2d067e970c55ce6e70e288bdd67e2e66d

# Stellar (for staking/escrow releases)
STELLAR_NETWORK=testnet
STELLAR_SECRET_KEY=...
```

---

## 8️⃣ **Testing the Pipeline**

### Test 1: Manual Sync Trigger
```bash
curl -X POST http://localhost:8000/hackathons/sync
```

### Test 2: Check scraped data
```bash
curl http://localhost:8000/hackathons?limit=5
```

### Test 3: Check AI analysis
```bash
curl http://localhost:8000/hackathons/{hackathon_id}
# Look for ai_analysis field
```

### Test 4: Check skills demand
```bash
# Assuming endpoint exists
curl http://localhost:8000/insights/tag-analysis
```

---

## Summary: The Exact Bridge Point

**The central "join point" where Scraped Data becomes Analyzed Skills:**

1. **Raw Data:** `Hackathon.title, Hackathon.tags, Hackathon.description` (scraped)
2. **Transform:** `engine/agent_crew.py:HackathonScout.run()` calls Anthropic Claude LLM
3. **Storage:** Result saved to `Hackathon.ai_analysis` (JSON field with skills_required, project_ideas, etc.)
4. **Extracted Skills:** `SkillDemand` table updated by tag analysis (from `Hackathon.tags` + `ai_analysis`)
5. **Project Match:** `engine/agent_crew.py:MatchOracle.run()` crosses user projects with `ai_analysis.skills_required`
6. **Final Output:** `project_ideas` array used by frontend components

**File to debug/monitor:** `engine/agent_crew.py` (lines 500-560) — the core orchestration
