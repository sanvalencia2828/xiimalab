# 📋 Xiimalab Deployment Checklist

**Last Updated:** March 21, 2026  
**Target Environment:** Production (Supabase + Docker + Caddy)  
**Audience:** DevOps engineers, release managers

---

## ❌ Pre-Deployment (DO NOT SKIP)

### 1. Environment Configuration

- [ ] **Copy `.env.example` to `.env`**
  ```bash
  cp .env.example .env
  ```

- [ ] **Run validation script**
  ```bash
  chmod +x scripts/validate-env.sh
  ./scripts/validate-env.sh
  ```

- [ ] **Verify all 🔴 REQUIRED variables are set:**
  - [ ] `DATABASE_URL` — PostgreSQL connection (asyncpg format)
  - [ ] `POSTGRES_PASSWORD` — DB password (must match compose)
  - [ ] `ANTHROPIC_API_KEY` — Claude API key (sk-ant-...)
  - [ ] `NEXT_PUBLIC_API_URL` — FastAPI endpoint
  - [ ] `NEXTAUTH_SECRET` — Generated secret (min 32 chars)
  - [ ] `NEXTAUTH_URL` — Frontend URL
  - [ ] `STELLAR_NETWORK` — "testnet" or "mainnet"
  - [ ] `STELLAR_SECRET_KEY` — Platform account secret
  - [ ] `STELLAR_PLATFORM_SECRET` — Hot wallet secret (payout-oracle)
  - [ ] `STELLAR_PUBLIC_KEY` — Platform public key

- [ ] **Check sensitive data is NOT committed:**
  ```bash
  git status  # Verify .env is in .gitignore
  grep -r "sk-ant-" . --include="*.ts" --include="*.tsx" --include="*.py"
  ```

### 2. Database Setup

- [ ] **Fresh database migrations (if using Supabase):**
  ```bash
  # From services/db/migrations/ run in order:
  # 001_init_schema.sql
  # 002_indexes.sql
  # 003_pgvector_extension.sql
  # 004_hackathons_seed.sql
  # ... through 007_escrow_lifecycle.sql
  ```

- [ ] **Verify schema is present:**
  ```bash
  psql $DATABASE_URL -c "\dt"  # Should show: hackathons, user_achievements, skill_demands, etc.
  ```

- [ ] **Run seed data (pre-populate hackathons):**
  ```bash
  docker compose exec api python seed.py
  ```

- [ ] **Check database is healthy:**
  ```bash
  docker compose exec db psql -U postgres -d xiimalab -c "SELECT version();"
  ```

### 3. Docker Compose Configuration

#### Dev Environment
- [ ] **Start all services:**
  ```bash
  docker compose up --build -d
  ```

- [ ] **Verify all containers are healthy:**
  ```bash
  docker compose ps
  # Expected: all services showing "healthy" or "running"
  ```

- [ ] **Check critical service logs:**
  ```bash
  docker compose logs -f api
  # Should see: "Uvicorn running on 0.0.0.0:8000"
  
  docker compose logs -f scraper
  # Should see: "Starting scraper..."
  
  docker compose logs -f redis
  # Should see: "Ready to accept connections"
  ```

#### Production Environment (docker-compose.prod.yml)
- [ ] **Review Caddy configuration:**
  ```bash
  cat Caddyfile
  # Ensure DOMAIN_NAME is set and correct
  ```

- [ ] **Verify all env vars in production compose:**
  ```bash
  grep "${" docker-compose.prod.yml | sort | uniq
  # Cross-reference with .env
  ```

- [ ] **Test production build locally:**
  ```bash
  docker compose -f docker-compose.prod.yml up --build -d
  ```

### 4. Health Checks & Dependencies

- [ ] **Database health check:**
  ```bash
  # Should return 200
  docker compose exec -T db pg_isready -U postgres
  ```

- [ ] **Redis health check:**
  ```bash
  # Should return PONG
  docker compose exec redis redis-cli ping
  ```

- [ ] **API health check:**
  ```bash
  curl http://localhost:8000/health
  # Expected: {"status": "ok"}
  ```

- [ ] **Frontend health check:**
  ```bash
  curl http://localhost:3000
  # Expected: HTML response
  ```

### 5. Backend Service Checks

- [ ] **API can connect to database:**
  ```bash
  docker compose logs api | grep -i "connect\|connected"
  # Should see successful connection messages
  ```

- [ ] **Scraper services are configured correctly:**
  ```bash
  # Check scraper environment
  docker compose exec api echo $DATABASE_URL
  docker compose exec scraper echo $DEVFOLIO_MCP_API_KEY
  ```

- [ ] **Verify secrets are not in logs:**
  ```bash
  docker compose logs | grep -i "secret\|key" | grep -v "sk-\|xxxx"
  # Should have no unmasked secrets
  ```

### 6. Third-Party Service Integration

- [ ] **Devfolio MCP API:**
  - [ ] `DEVFOLIO_MCP_API_KEY` is set
  - [ ] API is accessible: `https://mcp.devfolio.co/mcp?apiKey=...`

- [ ] **Supabase (if using):**
  - [ ] `SUPABASE_URL` is reachable
  - [ ] `SUPABASE_SERVICE_KEY` has correct permissions
  - [ ] Realtime is enabled in dashboard

- [ ] **Stellar Blockchain:**
  - [ ] Network is set correctly (`testnet` or `mainnet`)
  - [ ] Account exists: `https://laboratory.stellar.org`
  - [ ] Account has sufficient XLM for escrows

- [ ] **Anthropic Claude API:**
  - [ ] API key is valid (try in Anthropic dashboard)
  - [ ] Rate limits are acceptable

- [ ] **RedimensionAI (AURA):**
  - [ ] Service is running at `REDIMENSION_AI_URL`
  - [ ] Can connect from API: `curl http://localhost:8001/health`

---

## ✅ Deployment Steps (Production)

### Step 1: Pre-Flight Checks

```bash
# Run full validation
./scripts/validate-env.sh

# Verify no uncommitted changes
git status

# Check for secrets in git history
git log -p | grep -i "sk-\|secret" | head -20
```

### Step 2: Build & Push to Registry (if using ACR)

```bash
# Login to your Docker registry
# az acr login --name <registry-name>

# Build images
docker compose build

# Tag and push (example for Azure Container Registry)
docker tag xiima-api:latest <registry>.azurecr.io/xiima-api:latest
docker push <registry>.azurecr.io/xiima-api:latest
```

### Step 3: Deploy to Production Environment

#### Option A: Docker Compose on VM
```bash
# SSH into production server
ssh user@prod-server

# Pull latest code
git pull origin main

# Copy .env (already configured on server)
# ls -la .env  # verify

# Deploy with prod compose file
docker compose -f docker-compose.prod.yml up --build -d

# Monitor startup
docker compose logs -f
```

#### Option B: Azure Container Instances (ACI)
```bash
# Deploy using ACI
az container create \
  --resource-group xiimalab-prod \
  --name xiima-stack \
  --image xiima-compose:latest \
  --environment-variables \
    DATABASE_URL="$DATABASE_URL" \
    ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --cpu 4 --memory 8
```

### Step 4: Verify Production Deployment

```bash
# Wait for services to stabilize (2 minutes)
sleep 120

# Check logs for errors
docker compose logs --tail=50 api | grep -i error

# Health check API
curl https://api.xiimalab.com/health

# Health check frontend
curl https://xiimalab.com/

# Test database connection
docker compose exec api python -c "import os; from db import engine; engine.connect()"
```

### Step 5: Run Post-Deployment Tests

```bash
# Test scraper is collecting data
docker compose logs scraper -n 50 | grep -i "scraped\|inserted"

# Verify analytics are working
curl https://api.xiimalab.com/insights/tag-analysis

# Check payout-oracle is running
docker compose logs payout-oracle -n 20
```

---

## 🔍 Monitoring & Observability

### Logs

```bash
# Real-time logs from all services
docker compose logs -f

# Specific service
docker compose logs -f api

# Last 100 lines
docker compose logs --tail=100 api

# Follow and show timestamps
docker compose logs -f --timestamps api
```

### Metrics to Monitor

- [ ] **API Response Time** — target: <200ms p95
- [ ] **Database Query Time** — target: <100ms p95
- [ ] **Redis Hit Rate** — target: >80%
- [ ] **Error Rate** — target: <0.1%
- [ ] **Disk Usage** — alert: >80%
- [ ] **Memory Usage** — alert: >85%
- [ ] **CPU Usage** — alert: >90%

### Alerts to Configure

```yaml
# Example Prometheus alerts
groups:
  - name: xiimalab
    rules:
      - alert: APIDown
        expr: up{job="api"} == 0
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.001
```

---

## 🔧 Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs <service>

# Rebuild service
docker compose build --no-cache <service>
docker compose up -d <service>

# Check compose file
docker compose config | grep -A 20 "<service>"
```

### Database Connection Failed

```bash
# Verify DATABASE_URL format
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check if db service is running
docker compose ps db

# Restart database
docker compose restart db
```

### API Returns 500 Errors

```bash
# Check API logs
docker compose logs api | grep -A 5 "ERROR\|Traceback"

# Verify all env vars are set in API container
docker compose exec api env | sort

# Check API can reach database
docker compose exec api python -c "import os; print(os.getenv('DATABASE_URL'))"
```

### Scraper Not Running

```bash
# Check scraper logs
docker compose logs scraper -n 100

# Verify DEVFOLIO_MCP_API_KEY
docker compose exec scraper echo $DEVFOLIO_MCP_API_KEY

# Manual test
docker compose exec scraper python devfolio_mcp.py --test
```

### Redis Connection Refused

```bash
# Check Redis is running
docker compose exec redis redis-cli ping

# Verify REDIS_URL format
echo $REDIS_URL

# Restart Redis
docker compose restart redis
```

---

## 📊 Post-Deployment Validation

### Automated Tests

```bash
# Run backend tests
cd services/api
pytest tests/ -v

# Run frontend tests
npm test

# Run e2e tests
npm run test:e2e
```

### Manual Smoke Tests

- [ ] **Can register new user**
  - Navigate to login page
  - Create new account
  - Verify email received (if applicable)

- [ ] **Can view hackathons**
  - Visit `/hackathons`
  - Verify data loaded from API
  - Check pagination works

- [ ] **Can search skills**
  - Visit `/skills`
  - Search for "JavaScript"
  - Verify match scoring works

- [ ] **Can stake education purchase**
  - Complete mock purchase flow
  - Verify Stellar escrow is created
  - Check CLI shows escrow in blockchain

- [ ] **Can submit proof of completion**
  - Upload work sample
  - Verify AURA processing
  - Check skill is marked complete

---

## 🔐 Security Checklist

- [ ] **Secrets are NOT in version control**
  ```bash
  git log --all -S "sk-ant-" 2>/dev/null || echo "✅ No secrets found"
  ```

- [ ] **HTTPS is enabled** (Caddy in prod)
  ```bash
  curl -I https://api.xiimalab.com | grep "Strict-Transport-Security"
  ```

- [ ] **Database user permissions are restrictive**
  ```bash
  # Connect as postgres, check roles
  psql -U postgres -d xiimalab -c "\du"
  ```

- [ ] **API has CORS configured correctly**
  ```bash
  curl -I -H "Origin: https://xiimalab.com" https://api.xiimalab.com/health
  ```

- [ ] **Rate limiting is active**
  ```bash
  # Make 101 requests in quick succession
  for i in {1..101}; do curl https://api.xiimalab.com/health; done
  # Should see 429 (Too Many Requests) around request 101
  ```

- [ ] **No debug mode in production**
  ```bash
  grep -r "DEBUG=True" services/api/ || echo "✅ Debug mode off"
  ```

---

## 📝 Rollback Plan

If deployment fails:

```bash
# 1. Revert to previous version
git revert HEAD~1

# 2. Restore database from backup (if applicable)
# docker compose exec db psql -U postgres -d xiimalab < backup.sql

# 3. Restart services
docker compose down
docker compose up --build -d

# 4. Verify
./scripts/validate-env.sh
curl https://api.xiimalab.com/health
```

---

## 📞 Support Contacts

- **DevOps Lead**: @devops-agent
- **Backend Issues**: @backend-agent
- **Frontend Issues**: @frontend-agent
- **Blockchain Issues**: @blockchain-agent

---

## 📋 Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| DevOps | — | — | [ ] |
| Backend | — | — | [ ] |
| QA | — | — | [ ] |
| Security | — | — | [ ] |

---

**Document Version:** 1.0  
**Last Reviewed:** March 21, 2026  
**Next Review:** April 21, 2026
