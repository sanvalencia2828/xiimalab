"""
services/api/services/sync_devfolio.py
────────────────────────────────────────────────────────────────────────────
Servicio de sincronización Devfolio → DB usando SQLAlchemy (ORM async).

Este módulo es el puente entre el cliente MCP (devfolio_mcp.py en el scraper)
y el ORM del API. Usa directamente los modelos y la sesión de SQLAlchemy para
ser 100% compatible con cualquier base de datos (SQLite en dev, PostgreSQL en prod).

Flujo:
  1. Llama a DevfolioMCPClient.get_hackathons()
  2. Normaliza cada hackathon con normalize_devfolio_hackathon()
  3. Upserta en la tabla `hackathons` usando SQLAlchemy
  4. Devuelve stats del resultado

Uso en main.py (admin endpoint):
  from services.sync_devfolio import sync_devfolio
  result = await sync_devfolio(session)
────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger("xiima.sync_devfolio")

# ─────────────────────────────────────────────
# Importar cliente MCP del scraper
# ─────────────────────────────────────────────
def _get_scraper_path() -> str:
    """Devuelve la ruta absoluta al módulo scraper."""
    here = os.path.dirname(__file__)                       # services/api/services/
    scraper_dir = os.path.abspath(os.path.join(here, "..", "..", "scraper"))
    return scraper_dir


def _import_mcp_client():
    """Importa DevfolioMCPClient y normalize_devfolio_hackathon del scraper."""
    scraper_path = _get_scraper_path()
    if scraper_path not in sys.path:
        sys.path.insert(0, scraper_path)

    try:
        from devfolio_mcp import DevfolioMCPClient, normalize_devfolio_hackathon  # noqa: E402
        return DevfolioMCPClient, normalize_devfolio_hackathon
    except ImportError as exc:
        raise ImportError(
            f"No se pudo importar devfolio_mcp desde '{scraper_path}': {exc}\n"
            "Asegúrate de que services/scraper/devfolio_mcp.py existe y sus "
            "dependencias (httpx, apscheduler) están instaladas."
        ) from exc


# ─────────────────────────────────────────────
# Core sync function
# ─────────────────────────────────────────────
async def sync_devfolio(db: AsyncSession, status: str = "open") -> dict[str, Any]:
    """
    Sincroniza hackathones de Devfolio hacia la base de datos local.

    Args:
        db:     AsyncSession de SQLAlchemy (inyectada por FastAPI o el scheduler).
        status: Estado de los hackathones a obtener ("open", "closed", etc.)

    Returns:
        Dict con estadísticas: {fetched, normalized, created, updated, errors}
    """
    from models import Hackathon  # Import aquí para evitar importaciones circulares

    api_key = os.environ.get("DEVFOLIO_MCP_API_KEY", "")
    if not api_key:
        log.error("DEVFOLIO_MCP_API_KEY no configurada — sync abortado")
        return {
            "success": False,
            "error": "DEVFOLIO_MCP_API_KEY no configurada",
            "fetched": 0,
            "normalized": 0,
            "created": 0,
            "updated": 0,
            "errors": 0,
        }

    DevfolioMCPClient, normalize_devfolio_hackathon = _import_mcp_client()

    log.info("🤖 Devfolio sync iniciado...")
    client = DevfolioMCPClient(api_key)
    stats: dict[str, int] = {
        "fetched": 0,
        "normalized": 0,
        "created": 0,
        "updated": 0,
        "errors": 0,
    }

    try:
        # 1. Inicializar sesión MCP
        init_result = await client.initialize()
        log.info(f"MCP initialized: protocolVersion={init_result.get('protocolVersion', 'N/A')}")

        # 2. Obtener hackathones
        raw_hackathons = await client.get_hackathons(status=status)
        stats["fetched"] = len(raw_hackathons)
        log.info(f"Devfolio: {stats['fetched']} hackathones obtenidos del MCP")

        # 3. Normalizar
        normalized: list[dict] = []
        for raw in raw_hackathons:
            try:
                n = normalize_devfolio_hackathon(raw)
                if n:
                    normalized.append(n)
            except Exception as exc:
                log.warning(f"Error normalizando hackathon: {exc}")
                stats["errors"] += 1

        stats["normalized"] = len(normalized)
        log.info(f"Devfolio: {stats['normalized']} hackathones normalizados")

        # 4. Upsert usando SQLAlchemy ORM (compatible con SQLite y PostgreSQL)
        for hack_data in normalized:
            try:
                await _upsert_hackathon(db, hack_data, stats)
            except Exception as exc:
                log.error(f"Error upserting hackathon '{hack_data.get('id', '?')}': {exc}")
                stats["errors"] += 1

        # 5. Commit
        await db.commit()
        log.info(
            f"✅ Devfolio sync completo: "
            f"{stats['created']} creados, {stats['updated']} actualizados, "
            f"{stats['errors']} errores"
        )

    except Exception as exc:
        log.error(f"Error en sync Devfolio: {exc}", exc_info=True)
        await db.rollback()
        return {
            "success": False,
            "error": str(exc),
            **stats,
        }
    finally:
        await client.close()

    return {"success": True, **stats}


async def _upsert_hackathon(
    db: AsyncSession,
    data: dict[str, Any],
    stats: dict[str, int],
) -> None:
    """
    Inserta o actualiza un hackathon en la DB usando SQLAlchemy.
    Actualiza `stats` in-place: incrementa 'created' o 'updated'.
    """
    from models import Hackathon  # Local import para evitar circulares

    hackathon_id = data.get("id")
    if not hackathon_id:
        log.warning("Hackathon sin ID, omitiendo")
        stats["errors"] += 1
        return

    # Buscar si existe
    result = await db.execute(
        select(Hackathon).where(Hackathon.id == hackathon_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Actualizar campos soportados
        updatable_fields = [
            "title", "prize_pool", "tags", "deadline", "match_score",
            "source_url", "source", "tech_stack", "difficulty", "requirements",
            "talent_pool_estimate", "organizer", "city", "event_type",
            "description", "participation_count_estimate",
        ]
        for field in updatable_fields:
            if field in data:
                setattr(existing, field, data[field])
        existing.updated_at = datetime.now(timezone.utc)
        stats["updated"] += 1
        log.debug(f"[DB] Updated: {hackathon_id}")
    else:
        # Crear nuevo — solo pasar campos que existen en el modelo
        from models import Hackathon as HackathonModel
        valid_columns = {c.key for c in HackathonModel.__table__.columns}
        filtered_data = {k: v for k, v in data.items() if k in valid_columns}
        new_record = Hackathon(**filtered_data)
        db.add(new_record)
        stats["created"] += 1
        log.debug(f"[DB] Created: {hackathon_id}")

    await db.flush()
