"""
hackathon_tracker.py — Xiimalab
Verifica si un estudiante ha aplicado a hackatones y actualiza su progreso.

Responsabilidades:
  1. Buscar al estudiante en la tabla hackathon_applications (si existe)
     o inferir aplicaciones desde la tabla hackathons por source_url visitado
  2. Verificar aplicaciones registradas en DoraHacks / Devfolio vía scraping liviano
  3. Actualizar user_skills_progress.hackathons_applied en DB
  4. Exponer endpoint GET /hackathon-tracker/applications/{student_address}

Flujo:
  DB query → optional scraping → UPDATE user_skills_progress → return summary

Nota: el scraping es best-effort. Si DoraHacks/Devfolio bloquean, se usa
el conteo local de la tabla hackathon_applications como fallback.
"""

import asyncio
import logging
import os
from dataclasses import dataclass

import asyncpg
import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/hackathon-tracker", tags=["hackathon-tracker"])

# ─── Configuración ────────────────────────────────────────────────────────────

DATABASE_URL = os.environ["DATABASE_URL"]

# Cuántas aplicaciones mínimas para completar el módulo
REQUIRED_HACKATHONS = 1

# Headers de browser real para evitar bloqueos básicos
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
}


# ─── Tipos internos ───────────────────────────────────────────────────────────

@dataclass
class ApplicationRecord:
    hackathon_id: str
    hackathon_title: str
    platform: str           # "dorahacks" | "devfolio" | "manual"
    applied_at: str | None


@dataclass
class HackathonProgressSummary:
    student_address: str
    applications_verified: int
    is_module_complete: bool
    applications: list[ApplicationRecord]


# ─── Consulta local de aplicaciones (DB) ──────────────────────────────────────

async def _fetch_local_applications(
    conn: asyncpg.Connection,
    student_address: str,
) -> list[ApplicationRecord]:
    """
    Consulta hackathon_applications por student_address.
    Esta tabla es populada por el front cuando el usuario registra una aplicación
    o por el scraper cuando confirma participación.
    """
    rows = await conn.fetch(
        """
        SELECT
            ha.hackathon_id,
            h.title,
            ha.platform,
            ha.applied_at::text
        FROM hackathon_applications ha
        LEFT JOIN hackathons h ON h.id = ha.hackathon_id
        WHERE ha.student_address = $1
        ORDER BY ha.applied_at DESC
        """,
        student_address,
    )
    return [
        ApplicationRecord(
            hackathon_id=row["hackathon_id"],
            hackathon_title=row["title"] or "Hackathon desconocido",
            platform=row["platform"] or "manual",
            applied_at=row["applied_at"],
        )
        for row in rows
    ]


# ─── Verificación vía API pública DoraHacks ───────────────────────────────────

async def _check_dorahacks_applications(student_address: str) -> list[str]:
    """
    Intenta verificar aplicaciones del usuario en DoraHacks.
    DoraHacks expone un endpoint público: /api/v2/user/{address}/hackathons
    Retorna lista de hackathon IDs confirmados, o [] si falla.
    """
    url = f"https://dorahacks.io/api/v2/user/{student_address}/hackathons"
    async with httpx.AsyncClient(timeout=8.0, headers=_HEADERS) as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                # DoraHacks retorna {"data": [{"id": "...", ...}]}
                return [item.get("id", "") for item in data.get("data", [])]
        except (httpx.RequestError, ValueError) as exc:
            logger.debug("DoraHacks check falló para %s: %s", student_address, exc)
    return []


async def _check_devfolio_applications(student_email: str) -> list[str]:
    """
    Devfolio no tiene API pública de aplicaciones por dirección,
    pero sí por email vía su MCP.
    Retorna lista de hackathon slugs, o [] si falla.
    """
    devfolio_mcp_url = "https://mcp.devfolio.co/mcp"
    api_key = os.environ.get("DEVFOLIO_API_KEY", "")
    if not api_key:
        return []

    params = {"apiKey": api_key}
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "get_user_applications",
            "arguments": {"email": student_email},
        },
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(devfolio_mcp_url, json=payload, params=params)
            if resp.status_code == 200:
                result = resp.json()
                items = result.get("result", {}).get("content", [])
                return [item.get("slug", item.get("id", "")) for item in items]
        except (httpx.RequestError, ValueError) as exc:
            logger.debug("Devfolio MCP check falló para %s: %s", student_email, exc)
    return []


# ─── Persistencia ─────────────────────────────────────────────────────────────

async def _register_verified_application(
    conn: asyncpg.Connection,
    student_address: str,
    hackathon_id: str,
    platform: str,
) -> None:
    """INSERT OR IGNORE en hackathon_applications cuando confirmamos externamente."""
    await conn.execute(
        """
        INSERT INTO hackathon_applications (
            student_address, hackathon_id, platform, verified, applied_at
        ) VALUES ($1, $2, $3, true, NOW())
        ON CONFLICT (student_address, hackathon_id) DO UPDATE
            SET verified = true, updated_at = NOW()
        """,
        student_address,
        hackathon_id,
        platform,
    )


async def _upsert_hackathon_progress(
    conn: asyncpg.Connection,
    student_address: str,
    count: int,
) -> None:
    """
    Actualiza user_skills_progress.hackathons_applied.
    Nunca decrementa — usamos GREATEST para proteger contra race conditions.
    """
    await conn.execute(
        """
        INSERT INTO user_skills_progress (
            student_address,
            aura_images_count,
            hackathons_applied,
            is_completed
        ) VALUES ($1, 0, $2, false)
        ON CONFLICT (student_address)
        DO UPDATE SET
            hackathons_applied = GREATEST(
                user_skills_progress.hackathons_applied,
                EXCLUDED.hackathons_applied
            ),
            updated_at = NOW()
        """,
        student_address,
        count,
    )
    logger.info(
        "hackathons_applied actualizado → student=%s count=%d",
        student_address,
        count,
    )


# ─── Función principal (usable por staking_manager) ───────────────────────────

async def sync_student_hackathon_applications(
    student_address: str,
    student_email: str = "",
) -> HackathonProgressSummary:
    """
    Entry point público para el staking_manager.

    1. Carga aplicaciones locales desde DB
    2. Intenta verificación externa en DoraHacks + Devfolio (en paralelo)
    3. Registra aplicaciones nuevas encontradas externamente
    4. Actualiza hackathons_applied en user_skills_progress
    5. Retorna el resumen completo
    """
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        local_apps = await _fetch_local_applications(conn, student_address)
        local_ids = {app.hackathon_id for app in local_apps}

        # Verificación externa en paralelo (best-effort)
        dorahacks_ids, devfolio_slugs = await asyncio.gather(
            _check_dorahacks_applications(student_address),
            _check_devfolio_applications(student_email) if student_email else asyncio.coroutine(lambda: [])(),
            return_exceptions=True,
        )

        if isinstance(dorahacks_ids, Exception):
            dorahacks_ids = []
        if isinstance(devfolio_slugs, Exception):
            devfolio_slugs = []

        # Registrar aplicaciones externas nuevas
        new_apps: list[ApplicationRecord] = []
        for hid in dorahacks_ids:
            if hid and hid not in local_ids:
                await _register_verified_application(conn, student_address, hid, "dorahacks")
                new_apps.append(ApplicationRecord(
                    hackathon_id=hid,
                    hackathon_title=f"DoraHacks Hackathon ({hid})",
                    platform="dorahacks",
                    applied_at=None,
                ))

        for slug in devfolio_slugs:
            if slug and slug not in local_ids:
                await _register_verified_application(conn, student_address, slug, "devfolio")
                new_apps.append(ApplicationRecord(
                    hackathon_id=slug,
                    hackathon_title=f"Devfolio Hackathon ({slug})",
                    platform="devfolio",
                    applied_at=None,
                ))

        all_apps = local_apps + new_apps
        total_count = len(all_apps)

        await _upsert_hackathon_progress(conn, student_address, total_count)

    finally:
        await conn.close()

    return HackathonProgressSummary(
        student_address=student_address,
        applications_verified=total_count,
        is_module_complete=total_count >= REQUIRED_HACKATHONS,
        applications=all_apps,
    )


# ─── Endpoints REST ───────────────────────────────────────────────────────────

@router.get("/applications/{student_address}")
async def get_hackathon_applications(student_address: str, email: str = ""):
    """
    Devuelve las aplicaciones a hackatones verificadas de un estudiante.
    Sincroniza con DoraHacks y Devfolio antes de responder.

    Query params:
        email — opcional, necesario para verificación en Devfolio
    """
    try:
        summary = await sync_student_hackathon_applications(student_address, email)
    except Exception as exc:
        logger.error("Error sincronizando hackathons: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Hackathon sync error: {exc}") from exc

    return {
        "student_address": summary.student_address,
        "applications_verified": summary.applications_verified,
        "required": REQUIRED_HACKATHONS,
        "is_module_complete": summary.is_module_complete,
        "applications": [
            {
                "hackathon_id": a.hackathon_id,
                "title": a.hackathon_title,
                "platform": a.platform,
                "applied_at": a.applied_at,
            }
            for a in summary.applications
        ],
    }


@router.post("/applications/{student_address}/register")
async def register_manual_application(student_address: str, hackathon_id: str, platform: str = "manual"):
    """
    Permite al frontend registrar manualmente una aplicación a un hackathon.
    Útil cuando el usuario aplica directamente en la plataforma sin pasar por Xiimalab.
    """
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await _register_verified_application(conn, student_address, hackathon_id, platform)

        # Recalcular total y actualizar progreso
        rows = await conn.fetch(
            "SELECT COUNT(*) AS cnt FROM hackathon_applications WHERE student_address = $1",
            student_address,
        )
        total = rows[0]["cnt"] if rows else 1
        await _upsert_hackathon_progress(conn, student_address, total)
    finally:
        await conn.close()

    return {
        "registered": True,
        "hackathon_id": hackathon_id,
        "platform": platform,
    }
