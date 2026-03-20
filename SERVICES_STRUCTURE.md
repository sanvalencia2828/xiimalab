# Xiimalab Services Structure

## Overview

Xiimalab is organized into several independent services that work together to provide a complete personal AI & Blockchain intelligence hub.

## Service Directory Structure

```
services/
├── api/              # FastAPI backend service
├── scraper/          # Hackathon scraper service
├── automation/       # Automation tools (Snap Engine)
└── db/               # Database initialization scripts
```

## API Service

**Technology**: FastAPI (Python)

**Description**: The main backend service that provides REST APIs for:
- Hackathon data
- Skill analytics
- AURA metrics
- Staking functionality
- Notification system
- ML recommendations

**Key Files**:
- `main.py`: Application entry point
- `models.py`: Database models
- `schemas.py`: Pydantic schemas
- `routes/`: API route handlers
- `agents/`: AI agents
- `services/`: Business logic layers

**Docker Support**: Yes
**Health Check**: `/health` endpoint

## Scraper Service

**Technology**: Python with Playwright/Selenium

**Description**: Automated scraper that collects hackathon data from multiple sources:
- Devfolio MCP
- Devpost
- DoraHacks

**Key Files**:
- `scraper.py`: Main scraper orchestrator
- `devfolio_mcp.py`: Devfolio MCP client
- `devpost_engine.py`: Devpost scraper
- `parser.py`: Data parsing and normalization
- `tests/`: Unit tests

**Features**:
- Scheduled execution with APScheduler
- Real-time updates via Redis pub/sub
- Deterministic hackathon IDs
- Match score computation

**Docker Support**: Yes
**Health Check**: Built-in health check mechanism

## Automation Service

**Technology**: Node.js with Puppeteer

**Description**: Automation tools for:
- Dashboard screenshot capture
- Social media image optimization
- Scheduled tasks

**Key Files**:
- `snap_engine.js`: Screenshot capture and optimization
- `config.js`: Service configuration
- `test.js`: Test suite

**Features**:
- Headless browser automation
- RedimensionAI integration
- Multiple export formats
- Configurable via environment variables

**Docker Support**: Yes
**Health Check**: Built-in health check mechanism

## Database Service

**Technology**: PostgreSQL with Supabase

**Description**: Database initialization and schema management:
- Table definitions
- Index creation
- Seed data

**Key Files**:
- `init_supabase.sql`: Database schema
- `seed.py`: Data seeding script

## Inter-service Communication

### Data Flow

1. **Scraper** → Collects hackathon data → PostgreSQL
2. **API** → Serves data to frontend ← PostgreSQL
3. **Automation** → Captures dashboard → RedimensionAI → Optimized images
4. **Redis** → Real-time updates between services

### Environment Variables

Shared environment variables across services:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `ANTHROPIC_API_KEY`: AI service key
- `DEVFOLIO_MCP_API_KEY`: Devfolio integration key

## Deployment

Each service can be deployed independently:

```bash
# API service
cd services/api
docker build -t xiimalab-api .

# Scraper service
cd services/scraper
docker build -t xiimalab-scraper .

# Automation service
cd services/automation
docker build -t xiimalab-automation .
```

## Monitoring and Health Checks

All services include health check endpoints for monitoring:

- **API**: `GET /health`
- **Scraper**: Built-in health monitoring
- **Automation**: Process-level health checks

## Scaling Considerations

Services are designed to be horizontally scalable:

- **API**: Multiple workers behind load balancer
- **Scraper**: Multiple instances with distributed locking
- **Automation**: Stateless services can be scaled as needed

## Security

Security measures implemented:

- Least-privilege Docker containers
- Environment variable management
- Secure API key handling
- Input validation and sanitization