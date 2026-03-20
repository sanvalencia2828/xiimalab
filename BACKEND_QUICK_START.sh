#!/bin/bash
# Backend Development Quick Start — Xiimalab

# ─────────────────────────────────────────────
# 1. LOCAL DEVELOPMENT SETUP
# ─────────────────────────────────────────────

echo "🚀 Setting up Xiimalab Backend Development Environment"

# Activate Python virtual environment (if using venv)
# source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\Activate.ps1  # Windows (PowerShell)

# For development, we use the .env file
cp .env.example .env 2>/dev/null || echo "ℹ️  .env.example not found, create .env manually"

# ─────────────────────────────────────────────
# 2. DATABASE SETUP
# ─────────────────────────────────────────────

echo "📦 Setting up Database"

# Option A: Using Docker Compose (recommended)
docker compose up -d db

# Wait for PostgreSQL to be ready
sleep 5

# Apply migrations in order
for migration in services/db/migrations/{001..007}*.sql; do
    echo "▶️  Applying: $(basename $migration)"
    psql "${DATABASE_URL}" -f "$migration" || echo "⚠️  Migration might already exist: $migration"
done

# ─────────────────────────────────────────────
# 3. DEPENDENCIES
# ─────────────────────────────────────────────

echo "📚 Installing Dependencies"

# Backend API dependencies
cd services/api
pip install -r requirements.txt --upgrade
cd ../..

# Scraper dependencies (if needed)
# cd services/scraper && pip install -r requirements.txt && cd ../..

# Engine dependencies
cd engine
pip install -r requirements.txt --upgrade
cd ..

# ─────────────────────────────────────────────
# 4. START SERVICES
# ─────────────────────────────────────────────

echo "🎯 Starting Services"

# Start FastAPI backend
cd services/api
uvicorn main:app --reload --port 8000 &
API_PID=$!
echo "✅ API running on :8000 (PID: $API_PID)"

# Start staking monitor (optional, runs in background)
# cd ../../engine && python staking_manager.py --loop 60 &
# STAKING_PID=$!
# echo "✅ Staking Monitor running (PID: $STAKING_PID)"

# ─────────────────────────────────────────────
# 5. VERIFY SETUP
# ─────────────────────────────────────────────

echo "🔍 Verifying Setup"

# Test health endpoint
echo "▶️  Testing API health..."
curl -s http://localhost:8000/health | python -m json.tool && echo "✅ API Health OK" || echo "❌ API not responding"

# Test database connection
echo "▶️  Testing Database..."
psql "${DATABASE_URL}" -c "SELECT COUNT(*) as hackathon_count FROM hackathons;" && echo "✅ Database OK" || echo "❌ Database not accessible"

# ─────────────────────────────────────────────
# 6. USEFUL COMMANDS
# ─────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ⚡ BACKEND DEVELOPMENT COMMANDS"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📝 TESTS & VALIDATION:"
echo "  cd engine && pytest tests/ -v              # Run tests"
echo "  python -m py_compile services/api/routes/staking.py  # Check syntax"
echo ""
echo "🗃️  DATABASE:"
echo "  psql \$DATABASE_URL -c '\\l'                 # List databases"
echo "  psql \$DATABASE_URL -c '\\d educational_escrows'  # Describe table"
echo "  psql \$DATABASE_URL -c 'SELECT * FROM educational_escrows LIMIT 5;'  # Query"
echo ""
echo "🔗 API ENDPOINTS:"
echo "  GET  http://localhost:8000/health                    # Health check"
echo "  POST http://localhost:8000/staking/hotmart-webhook   # Create escrow"
echo "  GET  http://localhost:8000/staking/status/{user_id}  # Escrow status"
echo "  POST http://localhost:8000/staking/aura-milestone    # Milestone record"
echo "  POST http://localhost:8000/staking/hackathon-apply   # Hackathon apply"
echo ""
echo "🐳 DOCKER:"
echo "  docker compose up -d               # Start all services"
echo "  docker compose logs -f api         # View API logs"
echo "  docker compose logs -f db          # View DB logs"
echo "  docker compose down                # Stop all services"
echo ""
echo "🐛 DEBUGGING:"
echo "  docker compose exec db psql -U postgres xiimalab  # Connect to DB in container"
echo "  docker compose exec api python -c 'from routes import staking; print(\"OK\")'  # Test import"
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""
echo "✅ Setup complete! Your backend is ready."
echo ""
echo "📖 For more details, see:"
echo "  - BACKEND_FIXES_SUMMARY.md"
echo "  - BACKEND_ISSUES_PREVENTION_GUIDE.md"
echo "  - CLAUDE.md"
echo ""
