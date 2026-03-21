"""
aura_client.py — Xiimalab
Integración con el microservicio AURA (RedimensionAI).

Responsabilidades:
  1. Consultar cuántas imágenes ha procesado un estudiante en AURA
  2. Validar calidad de redimensionamiento (score de confianza)
  3. Actualizar user_skills_progress.aura_images_count en DB
  4. Exponer endpoint GET /aura/progress/{student_address} para el staking_manager

Flujo:
  AURA API → validate quality → UPDATE user_skills_progress → return progress summary
"""

import logging
import os
from dataclasses import dataclass

import asyncpg
import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/aura", tags=["aura"])

# ─── Configuración ────────────────────────────────────────────────────────────

DATABASE_URL = os.environ["DATABASE_URL"]
AURA_BASE_URL = os.environ.get("REDIMENSION_AI_URL", "http://localhost:8001")

# Umbral de calidad: el redimensionamiento debe superar este score para contar
QUALITY_THRESHOLD = 0.75

# Cuántas imágenes se necesitan para completar el módulo AURA
REQUIRED_IMAGES = 10


# ─── Tipos internos ───────────────────────────────────────────────────────────

@dataclass
class AuraProgressSummary:
    student_address: str
    images_processed: int
    images_passing_quality: int
    is_module_complete: bool
    latest_quality_score: float | None


# ─── Cliente AURA ─────────────────────────────────────────────────────────────

async def _fetch_aura_jobs(student_address: str) -> list[dict]:
    """
    Llama a AURA API para obtener los trabajos de procesamiento del estudiante.
    AURA expone: GET /jobs?user={address}
    Retorna lista de jobs con campos: id, status, quality_score, created_at
    """
    url = f"{AURA_BASE_URL}/jobs"
    params = {"user": student_address, "status": "completed"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "AURA API devolvió %s para usuario %s",
                exc.response.status_code,
                student_address,
            )
            return []
        except httpx.RequestError as exc:
            logger.error("No se pudo conectar a AURA: %s", exc)
            return []


def _count_quality_images(jobs: list[dict]) -> tuple[int, float | None]:
    """
    Filtra los jobs que superan el quality_threshold.
    Retorna (cantidad_aprobados, último_score).
    """
    passing = [
        j for j in jobs
        if float(j.get("quality_score", 0)) >= QUALITY_THRESHOLD
    ]
    latest_score: float | None = None
    if jobs:
        latest_score = float(sorted(jobs, key=lambda j: j.get("created_at", ""))[-1].get("quality_score", 0))

    return len(passing), latest_score


# ─── Persistencia ─────────────────────────────────────────────────────────────

async def _upsert_aura_progress(
    conn: asyncpg.Connection,
    student_address: str,
    images_count: int,
) -> None:
    """
    Actualiza user_skills_progress.aura_images_count.
    Si el registro no existe, lo crea con valores base.
    is_completed se recalcula en staking_manager al combinar con hackathons_applied.
    """
    await conn.execute(
        """
        INSERT INTO user_skills_progress (
            student_address,
            aura_images_count,
            hackathons_applied,
            is_completed
        ) VALUES ($1, $2, 0, false)
        ON CONFLICT (student_address)
        DO UPDATE SET
            aura_images_count = GREATEST(
                user_skills_progress.aura_images_count,
                EXCLUDED.aura_images_count
            ),
            updated_at = NOW()
        """,
        student_address,
        images_count,
    )
    logger.info(
        "aura_images_count actualizado → student=%s count=%d",
        student_address,
        images_count,
    )


# ─── Función principal (usable por staking_manager) ───────────────────────────

async def sync_student_aura_progress(student_address: str) -> AuraProgressSummary:
    """
    Entry point público para el staking_manager.
    1. Obtiene jobs completados de AURA
    2. Filtra por calidad
    3. Persiste el contador en DB
    4. Retorna el resumen
    """
    jobs = await _fetch_aura_jobs(student_address)
    passing_count, latest_score = _count_quality_images(jobs)

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await _upsert_aura_progress(conn, student_address, passing_count)
    finally:
        await conn.close()

    return AuraProgressSummary(
        student_address=student_address,
        images_processed=len(jobs),
        images_passing_quality=passing_count,
        is_module_complete=passing_count >= REQUIRED_IMAGES,
        latest_quality_score=latest_score,
    )


# ─── Endpoint REST ────────────────────────────────────────────────────────────

@router.get("/progress/{student_address}")
async def get_aura_progress(student_address: str):
    """
    Consulta y sincroniza el progreso AURA de un estudiante.
    Llamado por el staking_manager antes de evaluar is_completed.

    Returns:
        images_processed     — total de jobs completados en AURA
        images_passing_quality — jobs que superaron quality_threshold (0.75)
        images_required      — cuántas se necesitan (10)
        is_module_complete   — True si passing_quality >= 10
        latest_quality_score — score del job más reciente
    """
    try:
        summary = await sync_student_aura_progress(student_address)
    except asyncpg.PostgresError as exc:
        logger.error("Database error syncing AURA progress: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="Database service error") from exc
    except Exception as exc:
        logger.error("Error synchronizing AURA progress: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="AURA sync service error") from exc

    return {
        "student_address": summary.student_address,
        "images_processed": summary.images_processed,
        "images_passing_quality": summary.images_passing_quality,
        "images_required": REQUIRED_IMAGES,
        "progress_pct": round(min(summary.images_passing_quality / REQUIRED_IMAGES, 1.0) * 100, 1),
        "is_module_complete": summary.is_module_complete,
        "latest_quality_score": summary.latest_quality_score,
    }


@router.post("/progress/{student_address}/force-sync")
async def force_sync_aura(student_address: str):
    """
    Fuerza una re-sincronización desde AURA API.
    Útil para debugging y triggers manuales del staking_manager.
    """
    summary = await sync_student_aura_progress(student_address)
    return {
        "synced": True,
        "images_passing_quality": summary.images_passing_quality,
        "is_module_complete": summary.is_module_complete,
    }
