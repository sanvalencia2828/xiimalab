"""
services/scraper/devfolio_mcp.py
─────────────────────────────────────────────────────────────────────────────
Cliente MCP para Devfolio — Hackathons en tiempo real

Protocolo: MCP streamable HTTP (JSON-RPC 2.0 sobre SSE)
Endpoint:  https://mcp.devfolio.co/mcp?apiKey=<KEY>

Flujo:
  1. initialize   → negocia protocolo con el servidor MCP
  2. tools/list   → descubre herramientas disponibles
  3. tools/call   → llama a "get_hackathons" o equivalente
  4. Upsert en PostgreSQL + publica en Redis para tiempo real

Dependencias:
  httpx, asyncpg, redis[asyncio]
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import hashlib
from datetime import datetime, timezone
from typing import Any

import asyncpg
import httpx
import redis.asyncio as aioredis
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
DEVFOLIO_MCP_API_KEY: str = os.environ.get("DEVFOLIO_MCP_API_KEY", "")
DEVFOLIO_MCP_URL: str = f"https://mcp.devfolio.co/mcp?apiKey={DEVFOLIO_MCP_API_KEY}"
DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql://xiima:secret@localhost:5432/xiimalab"
)
REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
SCRAPER_INTERVAL_MINUTES: int = int(os.environ.get("DEVFOLIO_INTERVAL_MINUTES", "15"))

# Canal Redis para pub/sub de actualizaciones en tiempo real
REDIS_HACKATHONS_CHANNEL = "hackathons:new"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("xiima.devfolio_mcp")


# ─────────────────────────────────────────────
# Cliente MCP (JSON-RPC 2.0 sobre HTTP)
# ─────────────────────────────────────────────
class DevfolioMCPClient:
    """
    Cliente para el servidor MCP de Devfolio (MCP 2024-11-05 streamable HTTP).

    Flujo correcto:
      1. POST initialize  → captura Mcp-Session-Id del response header
      2. POST tools/list  → con header Mcp-Session-Id
      3. POST tools/call  → con header Mcp-Session-Id
    """

    def __init__(self, api_key: str):
        self.url = f"https://mcp.devfolio.co/mcp?apiKey={api_key}"
        self._request_id = 0
        self._session_id: str | None = None
        self._client = httpx.AsyncClient(timeout=30.0)

    def _next_id(self) -> int:
        self._request_id += 1
        return self._request_id

    def _build_headers(self) -> dict:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        return headers

    async def _rpc(self, method: str, params: dict | None = None) -> Any:
        """Envía una petición JSON-RPC 2.0, mantiene el session ID."""
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "id": self._next_id(),
        }
        if params:
            payload["params"] = params

        response = await self._client.post(
            self.url,
            json=payload,
            headers=self._build_headers(),
        )
        response.raise_for_status()

        # Capturar session ID si el servidor lo devuelve
        session_header = (
            response.headers.get("Mcp-Session-Id")
            or response.headers.get("mcp-session-id")
        )
        if session_header:
            self._session_id = session_header
            log.debug(f"Session ID capturado: {self._session_id[:16]}...")

        # Parsear respuesta SSE o JSON directo
        content_type = response.headers.get("content-type", "")
        if "text/event-stream" in content_type:
            return self._parse_sse(response.text)

        text = response.text.strip()
        # A veces viene como SSE aunque el content-type diga JSON
        if text.startswith("event:") or text.startswith("data:"):
            return self._parse_sse(text)

        try:
            data = response.json()
            if "error" in data:
                raise RuntimeError(f"MCP error: {data['error']}")
            return data.get("result")
        except Exception:
            return self._parse_sse(text)

    def _parse_sse(self, text: str) -> Any:
        """Parsea respuesta SSE y extrae el JSON del último evento 'data:'."""
        result = None
        for line in text.splitlines():
            if line.startswith("data:"):
                raw = line[5:].strip()
                if raw and raw != "[DONE]":
                    try:
                        parsed = json.loads(raw)
                        if "result" in parsed:
                            result = parsed["result"]
                        elif "error" in parsed:
                            raise RuntimeError(f"MCP error: {parsed['error']}")
                    except json.JSONDecodeError:
                        pass
        return result

    async def initialize(self) -> dict:
        """Negociación inicial — establece la sesión MCP."""
        result = await self._rpc(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "xiimalab-scraper", "version": "1.0.0"},
            },
        )
        # Enviar initialized notification (requerido por el spec MCP)
        try:
            await self._client.post(
                self.url,
                json={"jsonrpc": "2.0", "method": "notifications/initialized"},
                headers=self._build_headers(),
            )
        except Exception:
            pass  # Notificación opcional
        return result or {}

    async def list_tools(self) -> list[dict]:
        """Lista todas las herramientas disponibles en el servidor MCP."""
        result = await self._rpc("tools/list")
        if isinstance(result, dict):
            return result.get("tools", [])
        return []

    async def call_tool(self, tool_name: str, arguments: dict | None = None) -> Any:
        """Llama a una herramienta específica del servidor MCP."""
        return await self._rpc(
            "tools/call",
            {
                "name": tool_name,
                "arguments": arguments or {},
            },
        )

    async def get_hackathons(self, status: str = "open") -> list[dict]:
        """
        Obtiene la lista de hackatones de Devfolio.
        Primero lista las herramientas disponibles para usar el nombre correcto.
        """
        # Descubrir herramientas disponibles
        tools = await self.list_tools()
        tool_names = [t.get("name", "") for t in tools]
        log.info(f"Herramientas MCP disponibles: {tool_names}")

        # Prioridad: herramientas conocidas primero (del live-testing), luego búsqueda genérica
        KNOWN_HACKATHON_TOOLS = [
            "fetchUserActiveHackathons",   # oficial Devfolio MCP (verificado)
            "get_hackathons",
            "list_hackathons",
            "search_hackathons",
            "getHackathons",
        ]

        # Agregar cualquier herramienta con "hackathon" en el nombre que el server devuelva
        for name in tool_names:
            if "hackathon" in name.lower() and name not in KNOWN_HACKATHON_TOOLS:
                KNOWN_HACKATHON_TOOLS.append(name)

        # Filtrar a los que realmente están disponibles en este servidor
        tool_candidates = [t for t in KNOWN_HACKATHON_TOOLS if t in tool_names]
        if not tool_candidates:
            # Fallback: intentar todos los conocidos
            tool_candidates = KNOWN_HACKATHON_TOOLS

        for tool_name in tool_candidates:
            try:
                result = await self.call_tool(tool_name, {"status": status})
                if result:
                    hackathons = self._extract_hackathons(result)
                    if hackathons:
                        log.info(f"✅ '{tool_name}' → {len(hackathons)} hackatones")
                        return hackathons
            except Exception as exc:
                log.debug(f"Tool '{tool_name}' falló: {exc}")

        log.warning("Ninguna herramienta MCP devolvió hackatones.")
        return []

    def _extract_hackathons(self, result: Any) -> list[dict]:
        """Extrae la lista de hackatones de la respuesta MCP."""
        if isinstance(result, list):
            return result

        if isinstance(result, dict):
            # Respuesta tipo: {"content": [{"type": "text", "text": "[{...}]"}]}
            content = result.get("content", [])
            for item in content:
                if item.get("type") == "text":
                    try:
                        parsed = json.loads(item["text"])
                        if isinstance(parsed, list):
                            return parsed
                        if isinstance(parsed, dict):
                            for key in ("hackathons", "data", "results", "items"):
                                if key in parsed and isinstance(parsed[key], list):
                                    return parsed[key]
                    except (json.JSONDecodeError, KeyError):
                        pass

            for key in ("hackathons", "data", "results", "items"):
                if key in result and isinstance(result[key], list):
                    return result[key]

        return []

    async def close(self):
        await self._client.aclose()


# ─────────────────────────────────────────────
# Normalización de hackatones Devfolio → schema DB
# ─────────────────────────────────────────────
def normalize_devfolio_hackathon(raw: dict) -> dict | None:
    """
    Normaliza un hackathon crudo de Devfolio al schema de la tabla `hackathons`.
    Devuelve None si faltan datos esenciales.
    """
    title = (
        raw.get("name")
        or raw.get("title")
        or raw.get("hackathon_name")
        or ""
    ).strip()

    if not title:
        return None

    # ID determinista basado en el slug o título
    slug = raw.get("slug") or raw.get("id") or hashlib.md5(title.encode()).hexdigest()[:16]
    hackathon_id = f"devfolio-{slug}"

    # Premio
    prize_raw = (
        raw.get("prize_amount")
        or raw.get("total_prize")
        or raw.get("prize")
        or "0"
    )
    try:
        prize_pool = int(str(prize_raw).replace(",", "").replace("$", "").split()[0])
    except (ValueError, IndexError):
        prize_pool = 0

    # Tags / tecnologías
    tags = raw.get("tags") or raw.get("technologies") or raw.get("themes") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]

    # Deadline
    deadline = (
        raw.get("ends_at")
        or raw.get("deadline")
        or raw.get("submission_deadline")
        or raw.get("end_date")
        or ""
    )
    if isinstance(deadline, datetime):
        deadline = deadline.isoformat()

    # URL
    source_url = (
        raw.get("url")
        or raw.get("link")
        or (f"https://devfolio.co/hackathons/{slug}" if slug else "")
    )

    # Match score simple basado en tags relevantes
    relevant_keywords = {"stellar", "blockchain", "web3", "defi", "ai", "python", "data"}
    tag_set = {t.lower() for t in tags}
    match_score = len(tag_set & relevant_keywords) * 20

    # ─────────────────────────────────────────────
    # Devfolio-specific extended metadata
    # ─────────────────────────────────────────────
    tech_stack = raw.get("tech_stack") or raw.get("technologies") or []
    if isinstance(tech_stack, str):
        tech_stack = [t.strip() for t in tech_stack.split(",") if t.strip()]

    difficulty = raw.get("difficulty") or raw.get("level") or None
    if difficulty:
        difficulty = difficulty.lower()

    requirements = raw.get("requirements") or raw.get("eligibility_criteria") or []
    if isinstance(requirements, str):
        requirements = [r.strip() for r in requirements.split(",") if r.strip()]

    talent_pool_estimate = None
    tp_raw = raw.get("talent_pool") or raw.get("expected_participants")
    if tp_raw:
        try:
            talent_pool_estimate = int(str(tp_raw).replace(",", "").split()[0])
        except (ValueError, IndexError):
            pass

    organizer = raw.get("organizer") or raw.get("organizer_name") or None
    city = raw.get("city") or raw.get("location") or None
    event_type = raw.get("event_type") or raw.get("format") or None
    if event_type:
        event_type = event_type.lower()

    description = raw.get("description") or raw.get("about") or None
    if description and len(description) > 5000:
        description = description[:5000]  # Truncate if too long

    participation_count = None
    pc_raw = raw.get("participation_count") or raw.get("participants_count")
    if pc_raw:
        try:
            participation_count = int(str(pc_raw).replace(",", "").split()[0])
        except (ValueError, IndexError):
            pass

    return {
        "id": hackathon_id,
        "title": title[:256],
        "prize_pool": prize_pool,
        "tags": tags,
        "deadline": str(deadline)[:32],
        "match_score": min(match_score, 100),
        "source_url": source_url,
        "source": "devfolio",
        # Extended metadata
        "tech_stack": tech_stack,
        "difficulty": difficulty,
        "requirements": requirements,
        "talent_pool_estimate": talent_pool_estimate,
        "organizer": organizer,
        "city": city,
        "event_type": event_type,
        "description": description,
        "participation_count_estimate": participation_count,
    }


# ─────────────────────────────────────────────
# Persistencia + pub/sub Redis
# ─────────────────────────────────────────────
async def upsert_and_publish(
    hackathons: list[dict],
    redis_client: aioredis.Redis,
) -> int:
    """
    Upserta hackatones en PostgreSQL y publica los nuevos en Redis
    para actualizaciones en tiempo real al frontend.

    Returns:
        Número de hackatones nuevos (insertados por primera vez).
    """
    if not hackathons:
        return 0

    conn = await asyncpg.connect(DATABASE_URL)
    new_count = 0

    try:
        for h in hackathons:
            # Detectar si es nuevo (no existe en DB)
            existing = await conn.fetchval(
                "SELECT id FROM hackathons WHERE id = $1", h["id"]
            )
            is_new = existing is None

            await conn.execute(
                """
                INSERT INTO hackathons
                    (id, title, prize_pool, tags, deadline, match_score, source_url, source,
                     tech_stack, difficulty, requirements, talent_pool_estimate, organizer, 
                     city, event_type, description, participation_count_estimate)
                VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (id) DO UPDATE SET
                    title                           = EXCLUDED.title,
                    prize_pool                      = EXCLUDED.prize_pool,
                    tags                            = EXCLUDED.tags,
                    deadline                        = EXCLUDED.deadline,
                    match_score                     = EXCLUDED.match_score,
                    source_url                      = EXCLUDED.source_url,
                    tech_stack                      = EXCLUDED.tech_stack,
                    difficulty                      = EXCLUDED.difficulty,
                    requirements                    = EXCLUDED.requirements,
                    talent_pool_estimate            = EXCLUDED.talent_pool_estimate,
                    organizer                       = EXCLUDED.organizer,
                    city                            = EXCLUDED.city,
                    event_type                      = EXCLUDED.event_type,
                    description                     = EXCLUDED.description,
                    participation_count_estimate    = EXCLUDED.participation_count_estimate,
                    updated_at                      = NOW()
                """,
                h["id"],
                h["title"],
                h["prize_pool"],
                json.dumps(h["tags"]),
                h["deadline"],
                h["match_score"],
                h["source_url"],
                h["source"],
                json.dumps(h.get("tech_stack", [])),
                h.get("difficulty"),
                json.dumps(h.get("requirements", [])),
                h.get("talent_pool_estimate"),
                h.get("organizer"),
                h.get("city"),
                h.get("event_type"),
                h.get("description"),
                h.get("participation_count_estimate"),
            )

            if is_new:
                new_count += 1
                # Publicar en Redis para SSE
                await redis_client.publish(
                    REDIS_HACKATHONS_CHANNEL,
                    json.dumps({
                        **h,
                        "scraped_at": datetime.now(timezone.utc).isoformat(),
                    }),
                )

        log.info(
            f"✅ Devfolio: {len(hackathons)} procesados, {new_count} nuevos publicados en Redis"
        )
    finally:
        await conn.close()

    return new_count


# ─────────────────────────────────────────────
# Job principal
# ─────────────────────────────────────────────
async def run_devfolio_job(redis_client: aioredis.Redis):
    if not DEVFOLIO_MCP_API_KEY:
        log.error("DEVFOLIO_MCP_API_KEY no configurada — omitiendo job")
        return

    log.info("🤖 Devfolio MCP job iniciado...")
    client = DevfolioMCPClient(DEVFOLIO_MCP_API_KEY)

    try:
        # 1. Inicializar sesión MCP
        init_result = await client.initialize()
        log.info(f"MCP initialized: {init_result}")

        # 2. (Opcional) Listar herramientas disponibles para debug
        tools = await client.list_tools()
        if tools:
            log.info(f"Herramientas disponibles: {[t.get('name') for t in tools]}")

        # 3. Obtener hackatones abiertos
        raw_hackathons = await client.get_hackathons(status="open")

        # 4. Normalizar
        normalized = [
            n for raw in raw_hackathons
            if (n := normalize_devfolio_hackathon(raw)) is not None
        ]

        log.info(f"Devfolio: {len(raw_hackathons)} crudos → {len(normalized)} normalizados")

        # 5. Persistir y publicar
        await upsert_and_publish(normalized, redis_client)

    except Exception as exc:
        log.error(f"Error en job Devfolio: {exc}", exc_info=True)
    finally:
        await client.close()


# ─────────────────────────────────────────────
# Entry point con scheduler
# ─────────────────────────────────────────────
async def main():
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

    # Ejecución inmediata
    await run_devfolio_job(redis_client)

    # Scheduler periódico
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_devfolio_job,
        "interval",
        minutes=SCRAPER_INTERVAL_MINUTES,
        args=[redis_client],
        id="devfolio_mcp_scrape",
        max_instances=1,
    )
    scheduler.start()
    log.info(f"Devfolio scheduler iniciado — intervalo: {SCRAPER_INTERVAL_MINUTES} min")

    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        await redis_client.close()
        log.info("Devfolio scraper detenido")


if __name__ == "__main__":
    asyncio.run(main())
