#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Xiimalab Local Deployment Test Script
# 
# Purpose: Comprehensive test of docker-compose stack locally
# Usage: ./scripts/test-deployment.sh
# 
# This script:
#   1. Validates environment
#   2. Starts docker compose stack
#   3. Waits for all services to be healthy
#   4. Runs connectivity tests
#   5. Tests critical endpoints
#   6. Generates report
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TIMEOUT=300  # 5 minutes to wait for services
INTERVAL=5   # Check every 5 seconds

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Xiimalab Local Deployment Test${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}\n"

# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

test_result() {
    local name=$1
    local success=$2
    local message=${3:-}
    
    if [ "$success" = true ]; then
        echo -e "${GREEN}✅${NC} $name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌${NC} $name"
        if [ -n "$message" ]; then
            echo "   $message"
        fi
        ((TESTS_FAILED++))
    fi
}

wait_for_service() {
    local service=$1
    local endpoint=$2
    local timeout=$TIMEOUT
    local start_time=$(date +%s)
    
    echo "  Waiting for $service..."
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -gt $timeout ]; then
            echo -e "    ${RED}✘ Timeout after ${timeout}s${NC}"
            return 1
        fi
        
        if [ "$endpoint" = "db" ]; then
            docker compose exec -T db pg_isready -U postgres &>/dev/null && return 0
        elif [ "$endpoint" = "redis" ]; then
            docker compose exec -T redis redis-cli ping &>/dev/null && return 0
        else
            curl -sf "$endpoint" &>/dev/null && return 0
        fi
        
        sleep $INTERVAL
    done
}

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 1: Pre-flight Checks
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}Phase 1: Pre-flight Checks${NC}"

# Check .env exists
test_result ".env file exists" "[ -f .env ]"

# Check docker is running
test_result "Docker daemon is running" "docker ps &>/dev/null" "Start Docker Desktop"

# Check docker-compose is available
test_result "docker-compose is available" "command -v docker-compose &>/dev/null" "Install Docker Compose"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 2: Clean up Previous Deployment
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "\n${BLUE}Phase 2: Clean up${NC}"

echo "Stopping previous deployment..."
docker compose down --timeout=5 2>/dev/null || true

echo "Waiting for containers to stop..."
sleep 3

test_result "Previous deployment stopped" "[ $(docker compose ps -q | wc -l) -eq 0 ]" "Run: docker compose down -v"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 3: Build & Start Services
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "\n${BLUE}Phase 3: Build & Start Services${NC}"

echo "Building images (this may take 2-5 minutes)..."
docker compose build --no-cache 2>/dev/null || {
    test_result "Docker build successful" false "Check docker-compose.yml syntax"
    exit 1
}
test_result "Docker build successful" true

echo "Starting services..."
docker compose up -d || {
    test_result "Docker compose up successful" false "Check logs: docker compose logs"
    exit 1
}
test_result "Docker compose up successful" true

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 4: Wait for Services to be Healthy
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "\n${BLUE}Phase 4: Wait for Services (max ${TIMEOUT}s)${NC}"

if wait_for_service "PostgreSQL" "db"; then
    test_result "PostgreSQL health check" true
else
    test_result "PostgreSQL health check" false
fi

if wait_for_service "Redis" "redis"; then
    test_result "Redis health check" true
else
    test_result "Redis health check" false
fi

if wait_for_service "API" "http://localhost:8000/health"; then
    test_result "API health check" true
else
    test_result "API health check" false "Check: docker compose logs api"
fi

if wait_for_service "Frontend" "http://localhost:3000"; then
    test_result "Frontend health check" true
else
    test_result "Frontend health check" false "Check: docker compose logs frontend"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 5: Service Status Check
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "\n${BLUE}Phase 5: Service Status${NC}"

echo "Current service status:"
docker compose ps

# Count healthy services
healthy_count=$(docker compose ps --format "{{.Status}}" | grep -c "healthy" || echo "0")
running_count=$(docker compose ps -q | wc -l)

echo ""
test_result "All required services running" "[ $running_count -ge 4 ]" "Services: $running_count/4+"
test_result "Services are healthy" "[ $healthy_count -ge 2 ]" "Healthy: $healthy_count/4"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 6: Connectivity Tests
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "\n${BLUE}Phase 6: Connectivity Tests${NC}"

# Database connection
db_test=$(docker compose exec -T api curl -s http://localhost:8000/health | grep -o '"status":"ok"' || echo "")
test_result "API can connect to database" "[ -n '$db_test' ]" "Check: docker compose logs api"

# Redis connection
redis_test=$(docker compose exec -T redis redis-cli ping 2>/dev/null || echo "")
test_result "Redis is accessible" "[ '$redis_test' = 'PONG' ]"

# API endpoints
api_health=$(curl -s http://localhost:8000/health | grep -o '"status"' || echo "")
test_result "API /health endpoint" "[ -n '$api_health' ]"

# Frontend loading
frontend_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
test_result "Frontend is serving" "[ '$frontend_status' = '200' ]" "HTTP status: $frontend_status"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 7: API Functional Tests
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "\n${BLUE}Phase 7: API Functional Tests${NC}"

# Get hackathons
hackathons=$(curl -s http://localhost:8000/hackathons 2>/dev/null | grep -o '"title"' | head -1 || echo "")
test_result "API /hackathons endpoint" "[ -n '$hackathons' ]" "No hackathons returned — did seed.py run?"

# Get skills
skills=$(curl -s http://localhost:8000/skills 2>/dev/null | grep -o '"label"' | head -1 || echo "")
test_result "API /skills endpoint" "[ -n '$skills' ]" "No skills returned — check API logs"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 8: Summary & Recommendations
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}\n"

echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"

echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Deployment is ready.${NC}\n"
    echo "Next steps:"
    echo "  1. Open frontend: http://localhost:3000"
    echo "  2. API docs: http://localhost:8000/docs"
    echo "  3. Monitor logs: docker compose logs -f api"
    echo "  4. Run scraper test: docker compose exec scraper python scraper.py --test"
    echo ""
    echo "To shut down: docker compose down"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Review the output above.${NC}\n"
    echo "Troubleshooting:"
    echo "  1. Check logs: docker compose logs <service>"
    echo "  2. Validate .env: ./scripts/validate-env.sh"
    echo "  3. Clean up: docker compose down -v"
    echo "  4. Restart: docker compose up --build"
    echo ""
    exit 1
fi
