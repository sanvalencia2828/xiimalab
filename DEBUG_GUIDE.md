# 🔍 Debugging & Testing Guide: Data Pipeline

## Quick Access to Key Files

| Component | File Path | Purpose |
|-----------|-----------|---------|
| **Scraper Orchestrator** | `services/scraper/scraper.py` | Main scheduling loop, calls sync jobs |
| **Devfolio MCP Client** | `services/scraper/devfolio_mcp.py` | Fetches hackathons from Devfolio API |
| **Database Models** | `services/api/models.py` | SQLAlchemy ORM definitions (Hackathon, SkillDemand, etc.) |
| **Devfolio Sync** | `services/api/services/sync_devfolio.py` | Upsert logic for Devfolio hackathons |
| **Hackathon DB Ops** | `services/api/services/hackathon_db.py` | Bulk upsert operations |
| **Hackathon Routes** | `services/api/routes/hackathons.py` | API endpoints for hackathons |
| **Devfolio Routes** | `services/api/routes/devfolio.py` | Extended hackathon response with scoring |
| **Agent Crew** | `engine/agent_crew.py` | Four-agent orchestration (Scout→Analyzer→Oracle→Writer) |
| **Staking Manager** | `engine/staking_manager.py` | Educational escrow management |
| **DB Schema** | `services/db/init_supabase.sql` | SQL table definitions |

---

## Testing Flow: Step-by-Step

### **Level 1: Manual Scraper Trigger**

**Command 1: Trigger sync via API endpoint**
```bash
curl -X POST http://localhost:8000/hackathons/sync
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Manual sync triggered"
}
```

**What happens internally:**
1. Request reaches `services/api/routes/hackathons.py:trigger_manual_sync()`
2. Calls scraper HTTP endpoint: `POST {SCRAPER_URL}/sync`
3. Scraper (in `services/scraper/scraper.py`) handles the request
4. Executes `scrape_and_sync()` → fetches, normalizes, upserts

---

### **Level 2: Check Raw Scraped Data**

**Command 1: List all hackathons (with pagination)**
```bash
curl "http://localhost:8000/hackathons?limit=5&offset=0" | jq .
```

**Expected fields in each record:**
```json
{
  "id": "a1b2c3d4e5f6",              // MD5(title.lower())[:12]
  "title": "Solana Hackathon 2026",
  "prize_pool": 100000,
  "tags": [
    {"name": "web3", "weight": 0.9},
    {"name": "solana", "weight": 0.95}
  ],
  "deadline": "2026-06-30T23:59:59Z",
  "match_score": 75,                 // Computed during scrape
  "source": "devfolio",
  "source_url": "https://devfolio.co/...",
  "ai_analysis": null,               // Will be populated after LLM analysis
  "scraped_at": "2026-05-02T10:30:00Z",
  "updated_at": "2026-05-02T10:30:00Z"
}
```

**Command 2: Get a specific hackathon**
```bash
curl http://localhost:8000/hackathons/{hackathon_id} | jq .
```

---

### **Level 3: Check AI Analysis Status**

**Command 1: Check if ai_analysis is populated**
```bash
curl "http://localhost:8000/hackathons?limit=1" | jq '.[0] | {id, title, ai_analysis}'
```

**Expected output (after analysis):**
```json
{
  "id": "a1b2c3d4e5f6",
  "title": "Solana Hackathon 2026",
  "ai_analysis": {
    "skills_required": ["Rust", "Solana SDK", "Web3.js"],
    "difficulty": "intermediate",
    "best_for": "Blockchain developers with Solana experience",
    "project_ideas": [
      {
        "title": "Marketplace Smart Contract",
        "description": "Build a decentralized marketplace on Solana",
        "skills_covered": ["Rust", "Solana Program Library"]
      }
    ]
  }
}
```

**If ai_analysis is null:**
- Analysis hasn't run yet, OR
- Endpoint `POST /analyze/hackathon` doesn't exist
- Check scraper logs: `docker logs xiimalab-scraper`

---

### **Level 4: Check Skills Demand Data**

**Command 1: Query SkillDemand table directly**
```bash
# Via SQL (if you have psql access)
psql $DATABASE_URL -c "SELECT label, market_demand, user_score FROM skill_demands LIMIT 10;"
```

**Command 2: Check tag analysis endpoint (if implemented)**
```bash
curl http://localhost:8000/insights/tag-analysis 2>/dev/null | jq '.top_tags'
```

**Expected output:**
```json
{
  "top_tags": [
    ["solana", 15.5],
    ["web3", 14.2],
    ["react", 12.8],
    ["python", 11.5]
  ]
}
```

---

### **Level 5: Verify Agent Crew Processing**

**Command 1: Check if agent_knowledge table has entries**
```bash
psql $DATABASE_URL -c "SELECT agent_id, topic, content FROM agent_knowledge LIMIT 5;"
```

**Command 2: Check agent_signals table**
```bash
psql $DATABASE_URL -c "SELECT source_agent, signal_type, payload FROM agent_signals WHERE is_processed = false LIMIT 5;"
```

**Command 3: Check agent run history**
```bash
psql $DATABASE_URL -c "SELECT run_id, status, triggered_by, agents_invoked, insights_created FROM agent_runs ORDER BY created_at DESC LIMIT 5;"
```

---

### **Level 6: Real-Time Redis Pub/Sub**

**Command: Subscribe to hackathon updates**
```bash
redis-cli
> SUBSCRIBE hackathons:new
```

**Expected output (when new hackathon is scraped):**
```
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "hackathons:new"
3) (integer) 1
1) "message"
2) "hackathons:new"
3) "{\"id\":\"a1b2c3d4e5f6\",\"title\":\"...\",\"source\":\"devfolio\",\"scraped_at\":\"2026-05-02T10:35:00Z\"}"
```

---

## Debugging Specific Failures

### ❌ **Problem: Hackathons not appearing in DB**

**Check 1: Is scraper running?**
```bash
docker ps | grep scraper
```

**Check 2: View scraper logs**
```bash
docker logs -f xiimalab-scraper
```

**Look for:**
- ✅ `✅ Successfully upserted X hackathons to PostgreSQL`
- ❌ `❌ DB Upsert Error: ...`
- ❌ `No DEVFOLIO_MCP_API_KEY configured`

**Check 3: Is DATABASE_URL correct?**
```bash
docker exec xiimalab-api psql $DATABASE_URL -c "SELECT COUNT(*) FROM hackathons;"
```

**Check 4: Are hackathons table permissions okay?**
```bash
docker exec xiimalab-api psql $DATABASE_URL -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema='public' AND table_name='hackathons';
"
```

---

### ❌ **Problem: AI analysis not running**

**Check 1: Does /analyze/hackathon endpoint exist?**
```bash
curl -X POST http://localhost:8000/analyze/hackathon \
  -H "Content-Type: application/json" \
  -d '{"id":"test","title":"test","tags":[]}'
```

**Check 2: View scraper analysis trigger logs**
```bash
docker logs xiimalab-scraper | grep -i "analysis\|analyze"
```

**Look for:**
- ✅ `🧠 Triggering AI analysis for X items...`
- ✅ `✅ Analysis synced for: ...`
- ❌ `❌ Analysis failed for ...`

**Check 3: Is ANTHROPIC_API_KEY set?**
```bash
docker exec xiimalab-api printenv | grep ANTHROPIC
```

---

### ❌ **Problem: Skills demand table not updating**

**Check 1: Is there a tag analysis job?**
```bash
# Check if endpoint exists
curl http://localhost:8000/insights/tag-analysis
```

**Check 2: Are hackathons being read?**
```bash
docker exec xiimalab-api psql $DATABASE_URL -c "
  SELECT COUNT(*), COUNT(DISTINCT source) FROM hackathons 
  WHERE ai_analysis IS NOT NULL;
"
```

**Expected:** count > 0, showing that some hackathons have been analyzed

**Check 3: Manually trigger tag analysis**
```bash
# This would need to be implemented as an endpoint or manual job
docker exec xiimalab-api python -c "
  # Implement your tag analysis logic here
"
```

---

### ❌ **Problem: Project matching not working**

**Check 1: Are user projects in DB?**
```bash
docker exec xiimalab-api psql $DATABASE_URL -c "
  SELECT COUNT(*) FROM user_projects;
"
```

**Check 2: View matchmaker trigger logs**
```bash
docker logs xiimalab-scraper | grep -i "matchmaker\|match-projects"
```

**Look for:**
- ✅ `🤖 Triggering Background Agent Matchmaker for X hackathons...`
- ✅ `✅ Background Matchmaker found X new project matches!`
- ❌ `❌ Matchmaker failed: ...`

**Check 3: Does the matchmaker endpoint exist?**
```bash
curl -X POST http://localhost:8000/api/agents/strategist/match-projects \
  -H "Content-Type: application/json" \
  -d '{"hackathons":[]}'
```

---

## Database Inspection Queries

### View All Data Flow Steps

**Complete hackathon processing status:**
```sql
SELECT 
  h.id,
  h.title,
  h.source,
  h.match_score,
  CASE WHEN h.ai_analysis IS NOT NULL THEN 'analyzed' ELSE 'pending' END as analysis_status,
  h.scraped_at,
  h.updated_at
FROM hackathons h
ORDER BY h.scraped_at DESC
LIMIT 20;
```

**Skills demand trending:**
```sql
SELECT 
  label,
  market_demand,
  user_score,
  (market_demand - user_score) as demand_gap,
  updated_at
FROM skill_demands
ORDER BY market_demand DESC
LIMIT 15;
```

**User skill profiles overview:**
```sql
SELECT 
  wallet_address,
  jsonb_array_length(verified_skills) as skill_count,
  total_skill_hours,
  skill_diversity_score,
  neuroplasticity_score,
  updated_at
FROM user_skill_profiles
ORDER BY total_skill_hours DESC
LIMIT 10;
```

**Agent execution history:**
```sql
SELECT 
  run_id,
  status,
  triggered_by,
  insights_created,
  created_at,
  finished_at
FROM agent_runs
ORDER BY created_at DESC
LIMIT 20;
```

---

## Docker Compose Debugging

**View all service logs at once:**
```bash
docker compose logs -f --tail=50
```

**View specific service logs:**
```bash
docker compose logs -f scraper      # Scraper service
docker compose logs -f api          # FastAPI service
docker compose logs -f db           # PostgreSQL service
docker compose logs -f redis        # Redis service
```

**Restart a specific service:**
```bash
docker compose restart scraper
docker compose restart api
```

**Rebuild and restart:**
```bash
docker compose up --build -d scraper
```

---

## Environment Variable Validation

**Verify all critical vars are set:**
```bash
docker compose exec api bash -c '
  echo "DATABASE_URL: ${DATABASE_URL:?not set}"
  echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:?not set}"
  echo "DEVFOLIO_MCP_API_KEY: ${DEVFOLIO_MCP_API_KEY:?not set}"
  echo "REDIS_URL: ${REDIS_URL:?not set}"
  echo "NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:?not set}"
  echo "SCRAPER_INTERVAL_MINUTES: ${SCRAPER_INTERVAL_MINUTES:?not set}"
'
```

---

## Quick Checklist: Data Pipeline Validation

- [ ] Scraper is running (`docker ps | grep scraper`)
- [ ] New hackathons appear in DB after 30 mins (or trigger manually)
- [ ] `ai_analysis` field is populated for at least some hackathons
- [ ] `SkillDemand` table has > 10 entries
- [ ] `agent_runs` table shows completed runs
- [ ] Frontend components receive data via `NEXT_PUBLIC_API_URL`
- [ ] Redis pub/sub channel `hackathons:new` is broadcasting updates
- [ ] Agent signals are being created and processed
- [ ] No errors in scraper/api/db logs

---

## Common Quick Fixes

| Issue | Fix |
|-------|-----|
| Scraper stuck | `docker compose restart scraper` |
| DB connection fails | Check `DATABASE_URL` format, restart db: `docker compose restart db` |
| API returns 500 | Check `docker logs xiimalab-api`, verify imports |
| No real-time updates | Check Redis connection, verify pubsub code |
| Analysis endpoint 404 | Implement `POST /analyze/hackathon` if missing |
| Matchmaker failures | Verify user_projects exist in DB |

