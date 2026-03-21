#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Xiimalab Environment Variables Validation Script
# 
# Purpose: Verify all environment variables are correctly configured before deployment
# Usage: ./scripts/validate-env.sh
# 
# Exit codes:
#   0 = All checks passed ✅
#   1 = Validation failed ❌
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Load .env file if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
else
    echo -e "${RED}❌ .env file not found. Copy from .env.example first:${NC}"
    echo "   cp .env.example .env"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

check_var() {
    local var_name=$1
    local description=$2
    local required=${3:-true}
    
    local var_value=${!var_name:-}
    
    if [ -z "$var_value" ]; then
        if [ "$required" = true ]; then
            echo -e "${RED}❌ REQUIRED${NC} — $var_name: $description"
            ((FAILED++))
        else
            echo -e "${YELLOW}⚠️  OPTIONAL${NC} — $var_name not set: $description"
            ((WARNINGS++))
        fi
        return 1
    else
        # Mask sensitive values in output
        local masked_value="$var_value"
        if [[ "$var_name" =~ (SECRET|KEY|PASSWORD|TOKEN) ]]; then
            masked_value="${var_value:0:8}...${var_value: -4}"
        fi
        echo -e "${GREEN}✅${NC} $var_name = $masked_value"
        ((PASSED++))
        return 0
    fi
}

test_db_connection() {
    echo -e "\n${BLUE}Testing PostgreSQL Connection...${NC}"
    
    if [ -z "${DATABASE_URL:-}" ]; then
        echo -e "${RED}❌ DATABASE_URL not set${NC}"
        ((FAILED++))
        return 1
    fi
    
    # Extract host and port from DATABASE_URL
    # Format: postgresql+asyncpg://user:pass@host:port/dbname
    local host=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
    local port=$(echo "$DATABASE_URL" | grep -oE ':[0-9]+/' | sed 's/[:/]//g')
    port=${port:-5432}
    
    echo "  Connecting to $host:$port..."
    
    if command -v psql &> /dev/null; then
        # Try direct psql connection
        if psql "$DATABASE_URL" -c "SELECT 1" &>/dev/null; then
            echo -e "${GREEN}✅ Database connection successful${NC}"
            ((PASSED++))
            return 0
        else
            echo -e "${YELLOW}⚠️  Could not connect to database (psql command failed)${NC}"
            ((WARNINGS++))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  psql not installed — skipping direct DB test${NC}"
        echo "     To test: psql \$DATABASE_URL -c 'SELECT 1'"
        ((WARNINGS++))
        return 0
    fi
}

test_api_endpoint() {
    echo -e "\n${BLUE}Testing API Endpoint...${NC}"
    
    if [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then
        echo -e "${RED}❌ NEXT_PUBLIC_API_URL not set${NC}"
        ((FAILED++))
        return 1
    fi
    
    local api_url="$NEXT_PUBLIC_API_URL/health"
    echo "  Testing $api_url..."
    
    if command -v curl &> /dev/null; then
        if timeout 5 curl -sf "$api_url" &>/dev/null; then
            echo -e "${GREEN}✅ API is reachable${NC}"
            ((PASSED++))
            return 0
        else
            echo -e "${YELLOW}⚠️  API not reachable.${NC}"
            echo "     → Is FastAPI running? (docker compose up -d api)"
            ((WARNINGS++))
            return 0
        fi
    else
        echo -e "${YELLOW}⚠️  curl not installed — skipping API test${NC}"
        ((WARNINGS++))
        return 0
    fi
}

test_redis_connection() {
    echo -e "\n${BLUE}Testing Redis Connection...${NC}"
    
    if [ -z "${REDIS_URL:-}" ]; then
        echo -e "${YELLOW}⚠️  REDIS_URL not set${NC}"
        ((WARNINGS++))
        return 0
    fi
    
    # Extract host and port from REDIS_URL (format: redis://host:port)
    local host=$(echo "$REDIS_URL" | sed -E 's|redis://([^:/]+).*|\1|')
    local port=$(echo "$REDIS_URL" | grep -oE ':[0-9]+' | sed 's/[:/]//' || echo "6379")
    
    echo "  Connecting to $host:$port..."
    
    if command -v redis-cli &> /dev/null; then
        if timeout 5 redis-cli -h "$host" -p "$port" ping &>/dev/null; then
            echo -e "${GREEN}✅ Redis is reachable${NC}"
            ((PASSED++))
            return 0
        else
            echo -e "${YELLOW}⚠️  Redis not reachable${NC}"
            echo "     → Is Redis running? (docker compose up -d redis)"
            ((WARNINGS++))
            return 0
        fi
    else
        echo -e "${YELLOW}⚠️  redis-cli not installed — skipping Redis test${NC}"
        ((WARNINGS++))
        return 0
    fi
}

test_anthropic_key() {
    echo -e "\n${BLUE}Testing Anthropic API Key...${NC}"
    
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
        echo -e "${RED}❌ ANTHROPIC_API_KEY not set${NC}"
        ((FAILED++))
        return 1
    fi
    
    if [[ ! "$ANTHROPIC_API_KEY" =~ ^sk-ant- ]]; then
        echo -e "${RED}❌ ANTHROPIC_API_KEY format invalid (should start with sk-ant-)${NC}"
        ((FAILED++))
        return 1
    fi
    
    if command -v curl &> /dev/null; then
        # Test API key without making expensive API call
        if timeout 5 curl -sf -H "x-api-key: $ANTHROPIC_API_KEY" \
            "https://api.anthropic.com/v1/models" &>/dev/null; then
            echo -e "${GREEN}✅ Anthropic API key is valid${NC}"
            ((PASSED++))
            return 0
        else
            echo -e "${YELLOW}⚠️  Could not verify Anthropic API key${NC}"
            echo "     → Check your internet connection or API key validity"
            ((WARNINGS++))
            return 0
        fi
    else
        echo -e "${YELLOW}⚠️  curl not installed — skipping API key verification${NC}"
        ((WARNINGS++))
        return 0
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN VALIDATION ROUTINE
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Xiimalab Environment Variables Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}\n"

# ─── REQUIRED Variables ───────────────────────────────────────────────────────
echo -e "${BLUE}REQUIRED Variables:${NC}"
check_var "DATABASE_URL" "PostgreSQL connection string"
check_var "ANTHROPIC_API_KEY" "Claude API key from anthropic.com"
check_var "NEXT_PUBLIC_API_URL" "FastAPI backend URL"
check_var "POSTGRES_PASSWORD" "PostgreSQL password"
check_var "NEXTAUTH_SECRET" "NextAuth.js secret (generate: openssl rand -base64 32)"
check_var "NEXTAUTH_URL" "NextAuth.js URL"

# ─── Blockchain Variables ─────────────────────────────────────────────────────
echo -e "\n${BLUE}Blockchain (Stellar):${NC}"
check_var "STELLAR_NETWORK" "Stellar network (testnet or mainnet)"
check_var "STELLAR_SECRET_KEY" "Platform's Stellar secret key" true
check_var "STELLAR_PLATFORM_SECRET" "Payout Oracle hot wallet secret key" true
check_var "STELLAR_PUBLIC_KEY" "Platform's Stellar public key" true

# ─── Supabase Variables ────────────────────────────────────────────────────────
echo -e "\n${BLUE}Supabase (Real-time Backend):${NC}"
check_var "SUPABASE_URL" "Supabase project URL" false
check_var "SUPABASE_SERVICE_KEY" "Supabase service role key (for payout-oracle)" false
check_var "NEXT_PUBLIC_SUPABASE_URL" "Frontend-safe Supabase URL" false
check_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Frontend Supabase anon key" false

# ─── Scraper Variables ────────────────────────────────────────────────────────
echo -e "\n${BLUE}Scrapers & Integrations:${NC}"
check_var "DEVFOLIO_MCP_API_KEY" "Devfolio MCP API key" false
check_var "REDIMENSION_AI_URL" "RedimensionAI microservice URL" false
check_var "HOTMART_WEBHOOK_SECRET" "Hotmart webhook secret" false

# ─── Optional Agent & ML Variables ────────────────────────────────────────────
echo -e "\n${BLUE}Agent & ML Configuration (Optional):${NC}"
check_var "ML_MODEL" "ML embedding model name" false
check_var "AGENT_TOP_MATCHES" "Top matches for agent insights" false
check_var "AGENT_MIN_SCORE" "Minimum score threshold for insights" false

# ─── Optional Redis & Docker ──────────────────────────────────────────────────
echo -e "\n${BLUE}Cache & Deployment (Optional):${NC}"
check_var "REDIS_URL" "Redis connection URL" false
check_var "DOMAIN_NAME" "Production domain for Caddy" false

# ═══════════════════════════════════════════════════════════════════════════════
# Connectivity Checks
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Connectivity Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"

test_db_connection
test_redis_connection
test_api_endpoint
test_anthropic_key

# ═══════════════════════════════════════════════════════════════════════════════
# Summary Report
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"

echo -e "${GREEN}✅ Passed: $PASSED${NC}"
if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
fi
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Failed: $FAILED${NC}"
fi

echo ""

# ─── Exit Status ───────────────────────────────────────────────────────────
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All required environment variables are configured!${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}Note: $WARNINGS optional configurations are missing${NC}"
    fi
    exit 0
else
    echo -e "${RED}❌ Fix the above errors before deploying.${NC}"
    exit 1
fi
