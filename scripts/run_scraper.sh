#!/bin/bash
# ─────────────────────────────────────────────
# Xiimalab Scraper Automation Script
# Run from project root: ./scripts/run_scraper.sh
# ─────────────────────────────────────────────

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─────────────────────────────────────────────
# Functions
# ─────────────────────────────────────────────
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    echo "Xiimalab Scraper Automation"
    echo ""
    echo "Usage: ./scripts/run_scraper.sh <command>"
    echo ""
    echo "Commands:"
    echo "  start       - Start the scraper service"
    echo "  stop        - Stop the scraper service"
    echo "  restart     - Restart the scraper service"
    echo "  logs        - Show scraper logs (tail -f)"
    echo "  status      - Show scraper status"
    echo "  sync        - Trigger manual sync via API"
    echo "  test        - Run scraper locally (no Docker)"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/run_scraper.sh start"
    echo "  ./scripts/run_scraper.sh logs"
    echo "  ./scripts/run_scraper.sh sync"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# ─────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────
cmd_start() {
    check_docker
    log_info "Starting Xiimalab Scraper..."
    docker compose up -d scraper
    log_success "Scraper started successfully!"
    log_info "View logs: ./scripts/run_scraper.sh logs"
}

cmd_stop() {
    check_docker
    log_info "Stopping Xiimalab Scraper..."
    docker compose stop scraper
    log_success "Scraper stopped."
}

cmd_restart() {
    check_docker
    log_info "Restarting Xiimalab Scraper..."
    docker compose restart scraper
    log_success "Scraper restarted!"
}

cmd_logs() {
    check_docker
    log_info "Tailing scraper logs (Ctrl+C to exit)..."
    docker compose logs -f scraper
}

cmd_status() {
    check_docker
    echo ""
    echo "=== Xiimalab Scraper Status ==="
    echo ""
    
    # Container status
    CONTAINER_STATUS=$(docker compose ps scraper --format "{{.Status}}" 2>/dev/null || echo "Not running")
    echo "Container Status: $CONTAINER_STATUS"
    
    # Health check
    if curl -s http://localhost:9000/health > /dev/null 2>&1; then
        log_success "Health check: OK"
    else
        log_warning "Health check: Failed or scraper not accessible"
    fi
    
    # Last scrape info from logs
    echo ""
    echo "Recent activity:"
    docker compose logs --tail=10 scraper 2>/dev/null | grep -E "(Starting|Found|✅|❌|scraped)" | tail -5 || echo "No recent activity"
    echo ""
}

cmd_sync() {
    log_info "Triggering manual sync..."
    RESPONSE=$(curl -s -X POST http://localhost:9000/sync)
    if echo "$RESPONSE" | grep -q "sync_triggered"; then
        log_success "Sync triggered successfully!"
        echo "Response: $RESPONSE"
    else
        log_error "Failed to trigger sync"
        echo "Response: $RESPONSE"
    fi
}

cmd_test() {
    log_info "Running scraper locally (Python)..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed"
        exit 1
    fi
    
    # Install dependencies
    log_info "Installing dependencies..."
    pip install -r services/scraper/requirements.txt -q
    
    # Run scraper
    log_info "Running scraper..."
    cd services/scraper
    python3 scraper.py
}

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────
case "${1:-help}" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    logs)
        cmd_logs
        ;;
    status)
        cmd_status
        ;;
    sync)
        cmd_sync
        ;;
    test)
        cmd_test
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
