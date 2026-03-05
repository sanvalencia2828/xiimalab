# Xiimalab — Intelligence Dashboard

> Sistema de inteligencia para detección de oportunidades, análisis competitivo con IA y optimización de imagen para redes sociales.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?logo=fastapi)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue?logo=docker)](https://docker.com)
[![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-orange)](https://anthropic.com)

---

## Arquitectura de Microservicios

```
┌─────────────────────────────────────────────────────────────────┐
│                        XIIMALAB STACK                           │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Scraper    │    │  Devpost     │    │  Snap Engine     │  │
│  │ (DoraHacks)  │    │  Engine      │    │  (Puppeteer)     │  │
│  │  Playwright  │    │  Playwright  │    │  Screenshots     │  │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                  │                      │            │
│         └──────────┬───────┘                      ↓            │
│                    ↓                    ┌──────────────────┐   │
│           ┌─────────────────┐           │  RedimensionAI   │   │
│           │   PostgreSQL    │           │  (16:9 / 4:5)    │   │
│           │   hackathons    │           └──────────────────┘   │
│           │   user_achiev.  │                                   │
│           │   skill_demands │                                   │
│           └────────┬────────┘                                   │
│                    │                                            │
│                    ↓                                            │
│           ┌─────────────────┐                                   │
│           │   FastAPI API   │                                   │
│           │  /hackathons    │                                   │
│           │  /skills/market │                                   │
│           │  /analyze       │←── Claude Sonnet 4.6             │
│           └────────┬────────┘     (cache-first, evita 429)     │
│                    │                                            │
│                    ↓                                            │
│           ┌─────────────────┐                                   │
│           │   Next.js 14    │                                   │
│           │   Dashboard     │                                   │
│           │   AuraShowcase  │                                   │
│           │   DoraHacksFeed │                                   │
│           │   MarketMatch   │                                   │
│           └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Servicios

| Servicio | Puerto | Descripción |
|---|---|---|
| `frontend` | 3000 | Next.js 14 Dashboard |
| `api` | 8000 | FastAPI REST + Claude AI |
| `db` | 5432 | PostgreSQL 16 |
| `redis` | 6379 | Cache / job queue |
| `scraper` | — | DoraHacks bot (Playwright) |
| `devpost` | — | Devpost bot (Playwright, infinite scroll) |

---

## Flujo: Scraper → AI Analysis → Image Optimization

### 1. Scraping (DoraHacks + Devpost)
```
services/scraper/scraper.py          # DoraHacks — cada 30 min
services/scraper/devpost_engine.py   # Devpost — infinite scroll
```
- Playwright + playwright-stealth (anti-bot)
- User-Agent rotation + delays aleatorios
- Upsert idempotente en PostgreSQL (`ON CONFLICT DO UPDATE`)

### 2. Análisis AI (Motor Antigravity)
```
services/api/ai_engine.py            # Claude Sonnet 4.6
services/api/routes/analyze.py       # POST /analyze/hackathon
```
- **Cache-first**: si el hackathon ya tiene `ai_analysis` en DB → respuesta inmediata, sin llamar a Claude
- Enriquece el prompt con certificaciones reales desde `user_achievements`
- Devuelve: `match_score` (0-100), `missing_skills[]`, `project_highlight`
- `force: true` en el payload para forzar re-análisis

### 3. Optimización de Imagen (Xiima Snap)
```
services/automation/snap_engine.js   # Puppeteer
```
- Captura screenshot del dashboard esperando las animaciones de Framer Motion
- Envía a RedimensionAI para exportar en formato 16:9 (LinkedIn) y 4:5 (TikTok)

---

## Setup Rápido

### Prerrequisitos
- Docker Desktop con WSL2
- Node.js 18+
- La API key de Anthropic rotada

### 1. Configurar variables de entorno
```bash
# El archivo .env ya existe — edita estos valores:
ANTHROPIC_API_KEY=sk-ant-api03-tu-nueva-key
POSTGRES_PASSWORD=tu_password_seguro
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

### 2. Levantar el stack
```bash
docker compose up --build -d

# Verificar servicios
docker compose ps

# Ver logs del scraper de Devpost
docker compose logs devpost --follow

# Ver logs del análisis AI
docker compose logs api --follow
```

### 3. Snap Engine (screenshots)
```bash
cd services/automation
npm install
npm run snap
# Los archivos quedan en services/automation/snapshots/
```

---

## API Endpoints

```
GET  /hackathons              → Lista hackathons ordenados por match_score
GET  /hackathons/{id}         → Hackathon por ID
POST /analyze/hackathon       → Análisis Claude (cache-first)
GET  /analyze/hackathon/{id}  → Análisis cacheado
GET  /skills/market           → Skill demand data para el dashboard
GET  /health                  → Health check
```

### Ejemplo: Analizar un hackathon
```bash
curl -X POST http://localhost:8000/analyze/hackathon \
  -H "Content-Type: application/json" \
  -d '{
    "id": "abc123",
    "title": "Avalanche DeFi Hackathon",
    "tags": ["defi", "avalanche", "smart-contracts"],
    "prize_pool": 50000,
    "force": false
  }'
```

---

## Proyecto Principal

**RedimensionAI** — [github.com/sanvalencia2828/RedimensionAI](https://github.com/sanvalencia2828/RedimensionAI)

AI-powered image resizing engine para optimización multi-plataforma. Stack: Python, FastAPI, OpenCV, Docker.

---

## Stack Tecnológico

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: FastAPI, SQLAlchemy (async), asyncpg
- **IA**: Claude Sonnet 4.6 (Anthropic)
- **DB**: PostgreSQL 16
- **Scraping**: Playwright, playwright-stealth
- **Automation**: Puppeteer
- **Infra**: Docker Compose, Redis
