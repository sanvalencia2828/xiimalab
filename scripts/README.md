# 🚀 Xiimalab Deployment Scripts

Quick reference for DevOps deployment automation.

---

## Available Scripts

### 1. `validate-env.sh` — Environment Validation

**Purpose:** Verify all environment variables are correctly configured before deployment

**Usage:**
```bash
chmod +x scripts/validate-env.sh
./scripts/validate-env.sh
```

**What it checks:**
- ✅ All 🔴 REQUIRED env vars are set
- ✅ Database connectivity (psql)
- ✅ Redis connectivity (redis-cli)
- ✅ API endpoint health (curl)
- ✅ Anthropic API key format & validity
- ⚠️ Optional configurations

**Output:**
```
═══════════════════════════════════════════════════════════════════════════════
Xiimalab Environment Variables Validation
═══════════════════════════════════════════════════════════════════════════════

REQUIRED Variables:
✅ DATABASE_URL = postgresql+asyncp...
✅ ANTHROPIC_API_KEY = sk-ant-***...****
✅ NEXT_PUBLIC_API_URL = http://localhost:8000
...

✅ Passed: 15
⚠️  Warnings: 2
❌ Failed: 0

✅ All required environment variables are configured!
```

**Exit Codes:**
- `0` = All checks passed ✅
- `1` = Validation failed ❌

---

### 2. `test-deployment.sh` — Full Stack Test

**Purpose:** Comprehensive test of docker-compose stack with health checks

**Usage:**
```bash
chmod +x scripts/test-deployment.sh
./scripts/test-deployment.sh
```

**Phases:**
1. **Pre-flight Checks**
   - `.env` file exists
   - Docker daemon running
   - Docker Compose available

2. **Clean up**
   - Stop previous deployment
   - Remove old containers

3. **Build & Start**
   - Build Docker images
   - Start all services

4. **Wait for Health**
   - PostgreSQL ready
   - Redis ready
   - API responding
   - Frontend loaded

5. **Service Status**
   - Count running services
   - Verify healthy status

6. **Connectivity**
   - API ↔ Database
   - API ↔ Redis
   - Health endpoints

7. **API Tests**
   - GET /health → 200 OK
   - GET /hackathons → returns data
   - GET /skills → returns data

8. **Summary**
   - Pass/fail count
   - Next steps or troubleshooting

**Output:**
```
═══════════════════════════════════════════════════════════════════════════════
Xiimalab Local Deployment Test
═══════════════════════════════════════════════════════════════════════════════

Phase 1: Pre-flight Checks
✅ .env file exists
✅ Docker daemon is running
✅ docker-compose is available

Phase 2: Clean up
✅ Previous deployment stopped

Phase 3: Build & Start Services
✅ Docker build successful
✅ Docker compose up successful

Phase 4: Wait for Services (max 300s)
✅ PostgreSQL health check
✅ Redis health check
✅ API health check
✅ Frontend health check

[... more phases ...]

═══════════════════════════════════════════════════════════════════════════════
Test Summary
═══════════════════════════════════════════════════════════════════════════════

✅ Passed: 18
❌ Failed: 0

✅ All tests passed! Deployment is ready.

Next steps:
  1. Open frontend: http://localhost:3000
  2. API docs: http://localhost:8000/docs
  3. Monitor logs: docker compose logs -f api
  4. Run scraper test: docker compose exec scraper python scraper.py --test
```

**Exit Codes:**
- `0` = All tests passed ✅
- `1` = Some tests failed ❌

**Troubleshooting:**
```bash
# If tests fail, check logs
docker compose logs api

# Validate environment
./scripts/validate-env.sh

# Clean up and retry
docker compose down -v
./scripts/test-deployment.sh
```

---

## Typical Deployment Workflow

### Development (Local)
```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env with your values

# 2. Validate environment
./scripts/validate-env.sh

# 3. Test full deployment
./scripts/test-deployment.sh

# 4. If all tests pass, services are ready
curl http://localhost:3000      # Frontend
curl http://localhost:8000/api  # API docs

# 5. Monitor logs
docker compose logs -f api
```

### Production (Server Deployment)
```bash
# 1. SSH into production server
ssh user@prod-server

# 2. Clone/pull latest code
git pull origin main

# 3. Validate environment
./scripts/validate-env.sh

# 4. Run comprehensive test
./scripts/test-deployment.sh

# 5. If tests pass, deployment is verified
# Stop test stack or swap to production compose file

# 6. Monitor production
docker compose logs -f api

# 7. Set up monitoring alerts
# (beyond scope of this guide)
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| `validate-env.sh: command not found` | Script not executable | `chmod +x scripts/validate-env.sh` |
| `.env file not found` | Missing environment file | `cp .env.example .env` |
| `Cannot connect to Docker daemon` | Docker Desktop not running | Start Docker Desktop |
| `pg_isready: command not found` | psql not installed | Install PostgreSQL client, or skip test |
| `API health check failed` | FastAPI not starting | `docker compose logs api` |
| Timeout waiting for services | Container starting slowly | Increase `TIMEOUT` variable in script |
| "Max retries exceeded" | Network issue | Check internet, retry script |

---

## Performance Tips

### Speed up build process
```bash
# Build only what changed
docker compose build --no-cache

# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1
docker compose build
```

### Check build dependency order
```bash
# View build order
docker compose config --format json | jq '.services | keys'
```

### Monitor resource usage
```bash
# Real-time stats
docker stats

# Limit resource usage (in docker-compose.yml)
services:
  api:
    mem_limit: 2g
    cpus: 2
```

---

## Security Best Practices

- [ ] Never commit `.env` to git (it's in `.gitignore`)
- [ ] Use strong `POSTGRES_PASSWORD` in production
- [ ] Rotate `ANTHROPIC_API_KEY` regularly
- [ ] Keep `STELLAR_PLATFORM_SECRET` secure (payout-oracle only)
- [ ] Use `SUPABASE_SERVICE_KEY` only server-side (never in frontend)
- [ ] Monitor logs for leaked secrets: `docker compose logs | grep "sk-\|secret"`

---

## Advanced Usage

### Run specific validation
```bash
# Only check database connectivity (fast)
./scripts/validate-env.sh 2>&1 | grep -A 5 "Testing PostgreSQL"

# Only check API endpoint
./scripts/validate-env.sh 2>&1 | grep -A 5 "Testing API"
```

### Test with custom environment
```bash
# Use production compose file
docker compose -f docker-compose.prod.yml up --build

# Test with specific .env values
NEXT_PUBLIC_API_URL=https://api.prod.com ./scripts/validate-env.sh
```

### Debug services individually
```bash
# Start only database
docker compose up -d db

# Wait for health
docker compose ps db

# Connect directly
docker compose exec db psql -U postgres

# Test from API container
docker compose exec api python -c "import asyncpg; print('OK')"
```

---

## Maintenance Schedule

- **Daily**: Review logs for errors: `docker compose logs | grep -i error`
- **Weekly**: Run `./scripts/validate-env.sh` to catch drift
- **Monthly**: Run `./scripts/test-deployment.sh` on full stack
- **Quarterly**: Update base images and dependencies

---

**Last Updated:** March 21, 2026  
**Maintained By:** @devops-agent

For more details, see:
- [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md)
- [INFRASTRUCTURE_GUIDE.md](../INFRASTRUCTURE_GUIDE.md)
- [docker-compose.yml](../docker-compose.yml)
- [.env.example](../.env.example)
