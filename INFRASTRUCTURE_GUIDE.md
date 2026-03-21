# 🏗️ Xiimalab Infrastructure Guide

**Version:** 1.0  
**Last Updated:** March 21, 2026

---

## Overview

Xiimalab is a multi-service architecture with 15+ Docker containers orchestrated via Docker Compose. This guide documents:

- Service architecture and dependencies
- Health checks and readiness probes
- Environment variables by service
- Retry logic and failure handling
- Production deployment patterns

---

## Architecture Diagram

```
┌────────────────────────┐
│   Next.js Frontend     │  Port 3000
│   (node:20-alpine)     │  Health: GET / (200)
└────────────────────┬───┘
                     │
                     ▼
        ┌────────────────────────┐
        │   FastAPI Backend      │  Port 8000
        │   (uvicorn)            │  Health: GET /health
        │   - /hackathons        │  Depends: db (healthy), redis (healthy)
        │   - /analyze/hackathon │
        │   - /aura/progress     │
        └────────┬───────────────┘
                 │
        ┌────────┴──────────┐
        │                   │
        ▼                   ▼
    PostgreSQL           Redis
    (Port 5433)          (Port 6379)
    Health: pg_isready   Health: redis-cli ping
    
┌─────────────────────────────────────────────┐
│          Background Services                │
├─────────────────────────────────────────────┤
│ • devpost (Devpost scraper)                 │
│ • snap-engine (Multi-source scraper)        │
│ • agent-crew (4-agent collaborative system) │
│ • payout-oracle (Stellar transactions)      │
│ • ml-matcher (Embeddings + pgvector)        │
│ • skill-validator (Proof of Skill)          │
│ • staking-monitor (Escrow release)          │
│ • devfolio (Devfolio MCP integration)       │
└─────────────────────────────────────────────┘
```

---

## Service Catalog

### Core Services (Always Required)

#### Database (PostgreSQL)
```yaml
Service: db
Image: postgres:15
Port: 5433 (Docker) → 5432 (internal)
Health Check: pg_isready -U postgres
Interval: 10s | Timeout: 5s | Retries: 5
Volume: postgres_data:/var/lib/postgresql/data
Environment:
  - POSTGRES_USER: postgres
  - POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  - POSTGRES_DB: xiimalab
Restart: always
```

**Readiness Probe:**
```bash
docker compose exec db pg_isready -U postgres
# Output: accepting connections
```

**Troubleshooting:**
```bash
# Check if db is running
docker compose ps db

# View logs
docker compose logs db

# Restart db
docker compose restart db

# Connect and verify schema
docker compose exec db psql -U postgres -d xiimalab -c "\dt"
```

---

#### Cache (Redis)
```yaml
Service: redis
Image: redis:7-alpine
Port: 6379
Health Check: redis-cli ping
Interval: 10s | Timeout: 5s | Retries: 5
Restart: always
Networks: xiima-net
```

**Readiness Probe:**
```bash
docker compose exec redis redis-cli ping
# Output: PONG
```

---

#### Backend API (FastAPI)
```yaml
Service: api
Build: ./services/api
Port: 8000
Health Check: curl -f http://localhost:8000/health
Interval: 30s | Timeout: 10s | Retries: 3
Depends On:
  - db (condition: service_healthy)
  - redis (condition: service_healthy)
Restart: always
Environment:
  - DATABASE_URL: postgresql+asyncpg://postgres:${POSTGRES_PASSWORD}@db:5432/xiimalab
  - ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
  - REDIMENSION_AI_URL: http://localhost:8001
  - REDIS_URL: redis://redis:6379
```

**Startup Flow:**
1. Container starts (restart: always)
2. Awaits db health check to pass (service_healthy)
3. Awaits redis health check to pass (service_healthy)
4. FastAPI starts on 0.0.0.0:8000
5. Health endpoint responds with 200 OK

**Health Endpoint Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "available",
  "version": "0.1.0"
}
```

---

#### Frontend (Next.js)
```yaml
Service: frontend
Build: ./frontend
Port: 3000
Health Check: GET / → 200 OK
Interval: 30s | Timeout: 10s | Start Period: 5s | Retries: 3
Depends On:
  - api (condition: service_healthy)
Restart: always
Environment:
  - NEXT_PUBLIC_API_URL: http://localhost:8000
  - NODE_ENV: production (docker) / development (local)
```

**Startup Flow:**
1. Container builds with Dockerfile.frontend (3-stage build)
2. Awaits API health check to pass
3. Node.js starts Next.js server on port 3000
4. Returns /public/index.html on GET /

**Health Endpoint Response:**
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    ...
  </head>
  <body id="__next">...</body>
</html>
```

---

### Background Services

#### Devfolio Scraper
```yaml
Service: devfolio
Build: ./services/scraper
Command: python devfolio_mcp.py
Restart: unless-stopped
Interval: ${DEVFOLIO_INTERVAL_MINUTES:-15}
Depends On:
  - db (condition: service_healthy)
  - redis (condition: service_healthy)
Environment:
  - DEVFOLIO_MCP_API_KEY: ${DEVFOLIO_MCP_API_KEY}
  - DATABASE_URL: postgresql://xiima:${POSTGRES_PASSWORD}@db:5432/xiimalab
  - REDIS_URL: redis://redis:6379
```

**Failure Behavior:**
- **Startup Failure**: Retries indefinitely with exponential backoff (unless-stopped)
- **Connection Error**: Logs error, waits for retry interval
- **Data Conflict**: Upserts (INSERT ... ON CONFLICT DO UPDATE)

---

#### Agent Crew (Multi-Agent Collaboration)
```yaml
Service: agent-crew
Build: ./engine
Command: python agent_crew.py --loop 3600
Restart: unless-stopped
Loop Interval: 3600 seconds (1 hour)
Memory Limit: 512m
Depends On:
  - db (condition: service_healthy)
Environment:
  - DATABASE_URL: postgresql://xiima:${POSTGRES_PASSWORD}@db:5432/xiimalab
  - ML_MODEL: ${ML_MODEL:-all-MiniLM-L6-v2}
  - AGENT_TOP_MATCHES: ${AGENT_TOP_MATCHES:-3}
  - AGENT_MIN_SCORE: ${AGENT_MIN_SCORE:-40}
  - AGENT_INSIGHT_TTL_DAYS: ${AGENT_INSIGHT_TTL_DAYS:-14}
```

**Flow:**
1. Agent-crew loops every 3600 seconds
2. Runs Scout → Analyzer → Oracle → Writer pipeline
3. Generates insights from hackathons
4. Stores in user_insights table
5. Expires old insights after TTL

---

#### Payout Oracle (Stellar Blockchain)
```yaml
Service: payout-oracle
Build: ./engine
Command: python payout_manager.py
Restart: always  # CRITICAL — 24/7
Depends On:
  - db (condition: service_healthy)
Security Options:
  - no-new-privileges: true
Environment:
  - DATABASE_URL: postgresql://xiima:${POSTGRES_PASSWORD}@db:5432/xiimalab
  - STELLAR_PLATFORM_SECRET: ${STELLAR_PLATFORM_SECRET}  # HOT WALLET
  - STELLAR_NETWORK: ${STELLAR_NETWORK:-testnet}
  - SUPABASE_URL: ${SUPABASE_URL}
  - SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
  - MAX_RETRIES: ${MAX_RETRIES:-3}
  - POLL_INTERVAL_SEC: ${POLL_INTERVAL_SEC:-30}
```

**Critical:**
- **Only container with STELLAR_PLATFORM_SECRET** (hot wallet)
- **restart: always** — never stops
- **security_opt: no-new-privileges** — prevent privilege escalation
- Listens to Supabase Realtime for payment requests
- Falls back to polling every 30 seconds if Realtime unavailable

**Retry Logic:**
```python
for attempt in range(MAX_RETRIES):
    try:
        # Send XLM payout via Stellar Horizon
        response = server.submit_transaction(transaction)
        log_success(response.hash)
        break
    except ServerError as e:
        if attempt < MAX_RETRIES - 1:
            wait_time = 2 ** attempt  # Exponential backoff
            sleep(wait_time)
        else:
            log_error(f"Max retries exceeded: {e}")
```

---

#### ML Matcher (Embeddings)
```yaml
Service: ml-matcher
Build: ./engine
Command: python ml_matcher.py
Restart: unless-stopped
Memory Limit: 512m
Depends On:
  - db (condition: service_healthy)
Environment:
  - ML_MODEL: all-MiniLM-L6-v2 (80MB embedding model)
  - DATABASE_URL: postgresql://xiima:${POSTGRES_PASSWORD}@db:5432/xiimalab
```

**Function:**
- Generates embeddings for hackathon skills
- Stores in PostgreSQL pgvector column
- Used by match scoring engine

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                     Startup Order (critical path)            │
└─────────────────────────────────────────────────────────────┘

1. db (PostgreSQL)
   └─ Health: pg_isready → accepting connections
   
2. redis (Cache)
   └─ Health: redis-cli ping → PONG
   
3. api (FastAPI)
   └─ Waits: db + redis healthy
   └─ Health: GET /health → {"status": "ok"}
   
4. frontend (Next.js)
   └─ Waits: api healthy
   └─ Health: GET / → 200 OK
   
5-15. Background Services
   └─ Independent scheduling loops
   └─ Retry individual connections (not blocking others)
```

---

## Health Check Matrix

| Service | Check | Interval | Timeout | Retries | Start Period |
|---------|-------|----------|---------|---------|--------------|
| db | `pg_isready -U postgres` | 10s | 5s | 5 | 0s |
| redis | `redis-cli ping` | 10s | 5s | 5 | 0s |
| api | `curl -f http://localhost:8000/health` | 30s | 10s | 3 | 0s |
| frontend | `GET http://localhost:3000` | 30s | 10s | 3 | 5s |
| scraper | `curl -f http://localhost:9000/health` | 30s | 10s | 3 | 0s |

---

## Retry Logic by Service

### Database Connection Retries
```python
# asyncpg in services/api/db.py
async def connect_db(retries=5, delay=2):
    for attempt in range(retries):
        try:
            engine = create_async_engine(
                DATABASE_URL,
                pool_size=20,
                max_overflow=0,
                connect_args={"timeout": 10}
            )
            return engine
        except SQLException as e:
            if attempt < retries - 1:
                await asyncio.sleep(delay ** attempt)  # Exponential backoff
            else:
                raise
```

### Scraper Connection Retries
```python
# services/scraper/scraper.py
async def connect_with_retry(max_retries=3):
    for attempt in range(max_retries):
        try:
            async with asyncpg.connect(DATABASE_URL) as conn:
                return conn
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                await asyncio.sleep(wait_time)
```

### BlockchainTransaction Retries
```python
# services/api/payout_manager.py
def submit_with_retry(transaction, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = server.submit_transaction(transaction)
            return response
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise
```

---

## Environment Variables by Service

### Database (db)
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=xiimalab
```

### API (api)
```
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://redis:6379
ANTHROPIC_API_KEY=sk-ant-...
REDIMENSION_AI_URL=http://localhost:8001
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Frontend (frontend)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NODE_ENV=production
```

### Devfolio Scraper (devfolio)
```
DATABASE_URL=postgresql://xiima:${POSTGRES_PASSWORD}@db:5432/xiimalab
REDIS_URL=redis://redis:6379
DEVFOLIO_MCP_API_KEY=${DEVFOLIO_MCP_API_KEY}
DEVFOLIO_INTERVAL_MINUTES=15
```

### Agent Crew (agent-crew)
```
DATABASE_URL=postgresql://xiima:${POSTGRES_PASSWORD}@db:5432/xiimalab
ML_MODEL=all-MiniLM-L6-v2
AGENT_TOP_MATCHES=3
AGENT_MIN_SCORE=40
AGENT_INSIGHT_TTL_DAYS=14
```

### Payout Oracle (payout-oracle)
```
DATABASE_URL=postgresql://xiima:${POSTGRES_PASSWORD}@db:5432/xiimalab
STELLAR_PLATFORM_SECRET=${STELLAR_PLATFORM_SECRET}
STELLAR_NETWORK=${STELLAR_NETWORK:-testnet}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
MAX_RETRIES=3
POLL_INTERVAL_SEC=30
```

---

## Production Considerations

### Networking
```bash
# All services communicate internally via network name (xiima-net)
# Example from within api container:
curl http://db:5432  # ✅ Works (internal DNS resolution)
curl http://localhost:5433  # ❌ Fails (local only, not accessible in Docker)

# From outside Docker:
curl http://localhost:8000  # ✅ Works (exposed port)
```

### Resource Limits
```yaml
# Set memory limits to prevent OOM kills
services:
  agent-crew:
    mem_limit: 512m  # ML model: ~400MB
  
  ml-matcher:
    mem_limit: 512m  # Embeddings model: ~80MB
  
  scraper:
    shm_size: '256m'  # Shared memory for Playwright headless browser
```

### Restart Policies
```yaml
# always         → Restart regardless of exit code (db, api, payout-oracle)
# unless-stopped → Restart only if previously running (scrapers, agents)
# on-failure     → Restart only if exit code ≠ 0
# no             → Never restart (testing only)
```

---

## Troubleshooting Scenarios

### Scenario 1: "depends_on condition not met"
**Error:** API never becomes healthy because db fails

**Diagnosis:**
```bash
docker compose logs db | head -50
# Look for: "FATAL", "connection refused", "permission denied"
```

**Fix:**
```bash
# Restart db with fresh volume
docker compose down db
docker volume rm xiimalab_postgres_data
docker compose up -d db

# Wait for healthy
docker compose ps db
# Status should show "healthy" after 30s
```

### Scenario 2: API returns 500 errors
**Error:** `/hackathons` endpoint returns `RuntimeError: Event loop is closed`

**Diagnosis:**
```bash
docker compose logs api | grep -A 5 "RuntimeError\|Traceback"
```

**Fix:**
```bash
# Upgrade sqlalchemy/asyncpg
pip install --upgrade sqlalchemy asyncpg

# Restart API
docker compose restart api
```

### Scenario 3: Scraper spam-logs "Rate limit exceeded"
**Error:** Devfolio MCP returns 429 Too Many Requests

**Diagnosis:**
```bash
docker compose logs devfolio | grep "429"
```

**Fix:**
```bash
# Increase retry delay in scraper
DEVFOLIO_INTERVAL_MINUTES=30  # Increase from 15
```

### Scenario 4: Payout oracle remains in "pending" state
**Error:** Transactions don't complete for hours

**Diagnosis:**
```bash
docker compose logs payout-oracle | grep -i "stellar\|error" | tail -20
```

**Fix:**
```bash
# Check hot wallet balance
# https://laboratory.stellar.org/#account?network=testnet
# If balance=0, fund with test XLM

# Or increase poll interval
POLL_INTERVAL_SEC=15  # Override default of 30
```

---

## Monitoring Commands

```bash
# Real-time service status
docker compose ps

# View logs for all services
docker compose logs -f

# View logs for specific service
docker compose logs -f api

# Show last 100 lines with timestamps
docker compose logs --tail=100 -t api

# Search logs for errors
docker compose logs | grep -i error

# Monitor resource usage
docker stats

# Check network connectivity
docker compose exec api curl http://db:5432

# Verify env vars in container
docker compose exec api env | sort
```

---

**Last Updated:** March 21, 2026  
**Maintained By:** @devops-agent
