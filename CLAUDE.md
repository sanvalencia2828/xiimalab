# CLAUDE.md — Xiimalab Intelligence System

## Tu Rol

Eres un **Ingeniero Full Stack Senior** especializado en Next.js 14 App Router, FastAPI, Python asíncrono, y arquitecturas de microservicios. Trabajas en **Xiimalab**, un hub de inteligencia personal de IA y Blockchain.

### Principios de trabajo
- **Lee siempre el archivo antes de editarlo** — usa Read() antes de Edit()
- **TypeScript estricto** — sin `any` implícito, tipea todo
- **Diseño oscuro consistente** — usa clases: `bg-card`, `border-border`, `text-slate-200`, `text-muted-text`, `text-accent`
- **Animaciones con framer-motion** — sigue los patrones existentes (stagger, easeOut, spring)
- **Fallbacks siempre** — ninguna UI se rompe si un API falla; provee datos de respaldo
- **Verificación final** — después de cambios en frontend, corre `npx tsc --noEmit`
- **WalletContext** — importa SIEMPRE desde `@/lib/WalletContext`, nunca desde `@/context/`

## Sub-agents disponibles

Usa `@nombre-agente` para delegar tareas especializadas. Están definidos en `.claude/agents/`:

| Agente | Cuándo usarlo |
|--------|---------------|
| `@backend-agent` | Rutas FastAPI, agentes Python, modelos DB, lógica de negocio |
| `@frontend-agent` | Páginas Next.js, componentes, Server Actions, UI/UX |
| `@blockchain-agent` | Wallet Stellar, claimable balances, escrow educativo |
| `@devops-agent` | Docker, env vars, scraper, debugging de servicios |

**Ejemplo de uso:**
```
@backend-agent crea un nuevo agente Python para análisis de mercado
@frontend-agent añade la página /staking con el componente EscrowSection
```

## Hooks automáticos (`.claude/settings.local.json`)

Los siguientes hooks se ejecutan automáticamente — **respétalos y actúa sobre sus errores**:

| Hook | Cuándo | Acción |
|------|--------|--------|
| `PostToolUse` (Write/Edit) | Después de editar `.tsx`/`.ts` | `tsc --noEmit` verifica tipos |
| `PostToolUse` (Write/Edit) | Después de editar `.py` | `py_compile` detecta errores de sintaxis |
| `PreToolUse` (Bash) | Antes de ejecutar comandos | Loguea el comando para auditoría |

> ⚠️ **Si un hook reporta errores, corrígelos antes de continuar con la tarea.**


### Servicios externos activos
- **Devfolio MCP API** → `https://mcp.devfolio.co/mcp?apiKey=f8fdb3b311ae080e2678c4a566f139eb123b27be06fedc0098d4cc946690665e`
  - Protocolo: JSON-RPC 2.0 via HTTP POST
  - Tool disponible: `list_hackathons` — devuelve hackatones reales con título, premio, tags, deadline
- **Anthropic Claude 3.5** → `ANTHROPIC_API_KEY` en `.env`, usado por FastAPI en `/analyze/hackathon`
- **RedimensionAI** → microservicio externo en `:8001`

## Architecture Overview

Xiimalab is a personal AI & Blockchain intelligence hub split into four independently deployable services:

```
/ (repo root)           → Next.js 14 frontend (app router, TypeScript, Tailwind)
services/api/           → FastAPI backend (async SQLAlchemy, asyncpg, Uvicorn)
services/scraper/       → DoraHacks scraper (Playwright + stealth, APScheduler)
services/automation/    → Snap Engine — Puppeteer screenshot automation (planned)
```

**Data flow:**
1. `scraper` runs on a schedule, scrapes DoraHacks via headless Chromium, parses cards through `parser.py`, and bulk-upserts into PostgreSQL via asyncpg directly (bypassing the ORM for speed).
2. `api` (FastAPI) serves `hackathons` and `skill_demands` over REST. The frontend fetches from it at `NEXT_PUBLIC_API_URL`.
3. `frontend` displays a sidebar-nav layout (`SidebarNav` always mounted in `layout.tsx`) with pages for hackathons, skills, and project cards.
4. `redimension_ai` is an external microservice (`sanvalencia2828/redimension-ai:latest`) that runs on `:8001`.

**Database:** PostgreSQL — local container for dev (`db` service, port 5433), Supabase for production. Schema lives in `services/db/init_supabase.sql`. Three tables: `hackathons`, `user_achievements`, `skill_demands`.

**Hackathon IDs** are deterministic: `MD5(title.lower())[:12]` — this makes scraper upserts idempotent.

**Match score** is computed in `parser.py:compute_match_score()` using a keyword-weight map (`SKILL_WEIGHTS`), normalized 0–100 with a floor of 5.

## Priority Intelligence System

Xiimalab incluye un sistema de priorización de hackathons basado en datos:

### Endpoint: `/insights/priorities`
Analiza hackathons y genera prioridades usando:
- **urgency_score** (30%): basado en días hasta deadline
- **match_score** (40%): skills del usuario vs requerimientos
- **value_score** (30%): prize pool relativo

### Endpoint: `/insights/tag-analysis`
Análisis de tags más demandados en el mercado para guiar desarrollo de skills.

### Componentes
- `PriorityBoard.tsx` — Widget completo con tabs (Prioridades, Tags, Acciones)
- `CompactView` — Versión reducida para dashboard
- `actions/insights.ts` — Server Actions para consumir los endpoints
- `NeuroProfileDashboard.tsx` — Dashboard de perfil neuropsicológico
- `notification_service.py` — Sistema de notificaciones push para hackathons urgentes

### Endpoints de Notificaciones
- `GET /notifications/{wallet}` — Obtiene notificaciones para usuario
- `POST /notifications/{wallet}/mark-read` — Marca como leídas
- `GET /notifications/count/{wallet}` — Conteo de notificaciones pendientes

### Perfil Neuropsicológico
El sistema incluye tracking de:
- **Neuroplasticidad**: Capacidad de aprendizaje del usuario (0-1)
- **Categorías cognitivas**: Memory, Attention, Executive, Language, Visuospatial, Motor, Metacognition
- **Perfil de skills**: Progreso, mastery, streak, horas practicadas
- **Match personalizado**: Basado en overlap de skills del usuario vs tags de hackathon

## Commands

### Frontend (Next.js)
```bash
cd /path/to/Xiimalab
npm run dev          # dev server on :3000
npm run build        # production build
npm run lint         # ESLint via next lint
```

### API (FastAPI)
```bash
cd services/api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Seed the database (run after first `docker compose up`):
```bash
docker compose exec api python seed.py
```

### Scraper (Python)
```bash
cd services/scraper
pip install -r requirements.txt
playwright install chromium
python scraper.py       # runs immediately then on schedule
```

Run scraper tests (no browser, no network required):
```bash
cd services/scraper
pytest tests/ -v
# Single test:
pytest tests/test_parser.py::TestMatchScore::test_high_ai_blockchain_score -v
```

### Docker (full stack)
```bash
docker compose up --build -d
docker compose logs -f scraper
docker compose logs -f api
docker compose down
```

## Environment

Copy `.env.example` → `.env`. Key variables:

| Variable | Used by |
|----------|---------|
| `DATABASE_URL` | `api` and `scraper` — full asyncpg/asyncpg-compatible connection string |
| `ANTHROPIC_API_KEY` | `api` |
| `SUPABASE_URL` / `SUPABASE_KEY` | Future Supabase client usage |
| `NEXT_PUBLIC_API_URL` | Frontend → API URL |
| `REDIMENSION_AI_URL` | Frontend/API → RedimensionAI sidecar |

**Local dev DATABASE_URL:**
```
postgresql+asyncpg://postgres:xiima_pass@localhost:5433/xiimalab
```
(port 5433 because the `db` container maps `5433:5432`)

**Production DATABASE_URL** points to Supabase pooler (transaction mode, port 5432).

## Key Design Decisions

- **`scraper` uses asyncpg directly** (not SQLAlchemy) for bulk upserts — don't refactor this to ORM without benchmarking.
- **`parser.py` is browser-free** and fully unit-tested. Keep scraping logic out of it — `scraper.py` handles the browser, `parser.py` handles transformation only.
- **Frontend builds from repo root** using `Dockerfile.frontend` (not `./frontend/`). The `docker-compose.yml` `frontend` service uses `build: ./frontend` which is currently mismatched — the correct context is the repo root with `dockerfile: Dockerfile.frontend`.
- **`services/automation/`** does not yet exist. It will contain Puppeteer-based snapshot logic (`snap_engine.js`).
- **`docker-compose.override.yml`** is gitignored — use it to layer local overrides (e.g., enabling/disabling the `db` service) without touching the base compose file.
