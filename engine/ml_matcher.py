"""
engine/ml_matcher.py
─────────────────────────────────────────────────────────────────────────────
MarketMatch ML Engine — Proof of Skill / DeEd

Calcula la afinidad real entre habilidades del estudiante y hackatones
usando embeddings semánticos de sentence-transformers.

Modelo: all-MiniLM-L6-v2  (384 dimensiones, ~80MB, rápido en CPU)
DB:     pgvector en Supabase / PostgreSQL

Funciones principales:
  embed_hackathon(hackathon_id)       → genera y guarda vector de hackatón
  embed_user_profile(user_id)        → genera y guarda vector del estudiante
  calculate_match_score(user_id)     → Top-3 hackatones con % de afinidad
  run_full_batch()                   → embed todas las hackatones sin vector

Integraciones:
  • SNAP Engine llama embed_hackathon() al guardar una nueva hackatón
  • skill_validator llama calculate_match_score() antes de liberar el escrow
  • API FastAPI expone /match/score/{user_id} usando calculate_match_score()
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import asyncpg
import numpy as np
from dotenv import load_dotenv

# sentence-transformers — se descarga el modelo al primer uso (~80MB)
from sentence_transformers import SentenceTransformer

load_dotenv()

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
DATABASE_URL    = os.environ.get("DATABASE_URL", "postgresql://xiima:secret@db:5432/xiimalab")
MODEL_NAME      = os.environ.get("ML_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_DIMS  = 384          # dimensiones fijas del modelo MiniLM
TOP_N_DEFAULT   = 3

log = logging.getLogger("xiima.ml_matcher")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)

# ─────────────────────────────────────────────
# Modelo (singleton — cargado una sola vez)
# ─────────────────────────────────────────────
_model: SentenceTransformer | None = None

def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        log.info(f"Cargando modelo '{MODEL_NAME}'... (primera vez puede tardar ~30s)")
        _model = SentenceTransformer(MODEL_NAME)
        log.info(f"Modelo '{MODEL_NAME}' cargado ✓  dims={EMBEDDING_DIMS}")
    return _model


# ─────────────────────────────────────────────
# Helpers de texto → embedding
# ─────────────────────────────────────────────
def _hackathon_to_text(row: dict[str, Any]) -> str:
    """
    Construye el texto que describe una hackatón para el modelo.
    Cuanto más rico el texto, mejor el embedding.
    """
    tags = row.get("tags") or []
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except json.JSONDecodeError:
            tags = [tags]

    parts = [
        row.get("title", ""),
        "Skills requeridos: " + ", ".join(tags) if tags else "",
        f"Premio: {row.get('prize_pool', 0)} USD",
        f"Fuente: {row.get('source', '')}",
    ]
    return " | ".join(p for p in parts if p).strip()


def _user_to_text(row: dict[str, Any]) -> str:
    """
    Construye el texto del perfil del estudiante.
    Combina imágenes AURA, hackatones y milestones alcanzados.
    """
    hackathon_apps = row.get("hackathon_applications") or []
    if isinstance(hackathon_apps, str):
        try:
            hackathon_apps = json.loads(hackathon_apps)
        except json.JSONDecodeError:
            hackathon_apps = []

    hackathon_titles = [
        a.get("title", "") for a in hackathon_apps
        if isinstance(a, dict) and a.get("title")
    ]

    parts = [
        f"Desarrollador con {row.get('aura_images_processed', 0)} imágenes procesadas en AURA (IA)",
        f"Milestones completados: {row.get('total_milestones_reached', 0)}",
        "Experiencia en hackatones: " + ", ".join(hackathon_titles) if hackathon_titles else "",
        "Habilidades: Python, Docker, Blockchain, Stellar, AI, Machine Learning",
    ]
    return " | ".join(p for p in parts if p).strip()


def embed_text(text: str) -> list[float]:
    """Genera un embedding normalizado de 384 dimensiones."""
    model  = get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Similitud coseno entre dos vectores (resultado en [0, 1])."""
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    norm = np.linalg.norm(va) * np.linalg.norm(vb)
    if norm == 0:
        return 0.0
    return float(np.dot(va, vb) / norm)


# ─────────────────────────────────────────────
# 1. Embed de hackatón → active_hackathons
# ─────────────────────────────────────────────
async def embed_hackathon(hackathon_id: str) -> bool:
    """
    Genera el embedding de una hackatón y lo guarda en active_hackathons.embedding.

    Llamado por:
      - SNAP Engine después de cada upsert nuevo
      - run_full_batch() para backfill

    Returns:
        True si se generó y guardó correctamente.
    """
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        row = await conn.fetchrow(
            "SELECT id, title, tags, prize_pool, source FROM active_hackathons WHERE id = $1",
            hackathon_id,
        )
        if not row:
            log.warning(f"embed_hackathon: {hackathon_id} no encontrado en DB")
            return False

        text   = _hackathon_to_text(dict(row))
        vector = embed_text(text)

        # pgvector espera el vector como string '[x1, x2, ..., x384]'
        vector_str = "[" + ",".join(f"{v:.8f}" for v in vector) + "]"

        await conn.execute(
            "UPDATE active_hackathons SET embedding = $1 WHERE id = $2",
            vector_str,
            hackathon_id,
        )
        log.info(f"✓ Embedding generado: {hackathon_id} — texto: {text[:60]}...")
        return True

    except Exception as exc:
        log.error(f"embed_hackathon error ({hackathon_id}): {exc}")
        return False
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# 2. Embed del perfil del estudiante
# ─────────────────────────────────────────────
async def embed_user_profile(user_id: str) -> bool:
    """
    Genera el embedding del perfil del estudiante y lo guarda en
    user_skills_progress.profile_embedding.

    Llamado cuando:
      - El usuario actualiza sus skills en /settings
      - Se completa un nuevo milestone (skill_validator lo puede invocar)
      - Manualmente via API: POST /match/embed/{user_id}
    """
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        row = await conn.fetchrow(
            """
            SELECT user_id, aura_images_processed,
                   hackathon_applications, total_milestones_reached
            FROM user_skills_progress
            WHERE user_id = $1
            """,
            user_id,
        )
        if not row:
            log.warning(f"embed_user_profile: {user_id} no encontrado en DB")
            return False

        text   = _user_to_text(dict(row))
        vector = embed_text(text)
        vector_str = "[" + ",".join(f"{v:.8f}" for v in vector) + "]"

        await conn.execute(
            """
            UPDATE user_skills_progress
            SET profile_embedding = $1,
                updated_at        = NOW()
            WHERE user_id = $2
            """,
            vector_str,
            user_id,
        )
        log.info(f"✓ Perfil embebido: {user_id} — texto: {text[:60]}...")
        return True

    except Exception as exc:
        log.error(f"embed_user_profile error ({user_id}): {exc}")
        return False
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# 3. calculate_match_score — Top-N hackatones
# ─────────────────────────────────────────────
async def calculate_match_score(
    user_id: str,
    top_n: int = TOP_N_DEFAULT,
) -> list[dict]:
    """
    Calcula el match real entre el perfil del estudiante y las hackatones
    activas usando similitud coseno en pgvector.

    Si el perfil no tiene embedding, lo genera primero.

    Returns:
        Lista de dicts ordenada por afinidad DESC:
        [
          {
            "hackathon_id": "devpost-xyz",
            "title": "AI Hackathon 2026",
            "source": "devpost",
            "source_url": "https://...",
            "prize_pool": 50000,
            "tags": ["AI", "Python"],
            "deadline": "2026-04-15",
            "match_score_raw": 0.872,
            "match_pct": 87
          },
          ...
        ]
    """
    # Asegurar que el perfil tiene embedding
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        has_embedding = await conn.fetchval(
            "SELECT profile_embedding IS NOT NULL FROM user_skills_progress WHERE user_id = $1",
            user_id,
        )
    finally:
        await conn.close()

    if not has_embedding:
        log.info(f"calculate_match_score: generando embedding para {user_id}...")
        await embed_user_profile(user_id)

    # Usar la función SQL match_hackathons_for_user (pgvector)
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(
            "SELECT * FROM match_hackathons_for_user($1, $2)",
            user_id,
            top_n,
        )

        results = []
        for row in rows:
            tags = row["tags"]
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except json.JSONDecodeError:
                    tags = []

            results.append({
                "hackathon_id":    row["hackathon_id"],
                "title":           row["title"],
                "source":          row["source"],
                "source_url":      row["source_url"],
                "prize_pool":      row["prize_pool"],
                "tags":            tags,
                "deadline":        row["deadline"],
                "match_score_raw": round(float(row["match_score_raw"]), 4),
                "match_pct":       int(row["match_pct"]),
            })

        log.info(
            f"calculate_match_score: user={user_id} → "
            f"Top {len(results)} matches: "
            + ", ".join(f"{r['title'][:30]} ({r['match_pct']}%)" for r in results)
        )
        return results

    except asyncpg.UndefinedFunctionError:
        log.warning("Función match_hackathons_for_user no existe. Ejecuta la migración 001.")
        return await _fallback_match(user_id, top_n)
    finally:
        await conn.close()


async def _fallback_match(user_id: str, top_n: int) -> list[dict]:
    """
    Fallback si pgvector no está disponible.
    Calcula similitud coseno en Python con numpy.
    Más lento pero no requiere la extensión instalada.
    """
    log.info(f"_fallback_match: calculando en Python para {user_id}")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        user_row = await conn.fetchrow(
            "SELECT profile_embedding FROM user_skills_progress WHERE user_id = $1",
            user_id,
        )
        if not user_row or not user_row["profile_embedding"]:
            return []

        # asyncpg devuelve el vector como string '[x1,x2,...]' con pgvector
        user_vec = _parse_vector(str(user_row["profile_embedding"]))

        hack_rows = await conn.fetch(
            "SELECT id, title, source, source_url, prize_pool, tags, deadline, embedding "
            "FROM active_hackathons WHERE embedding IS NOT NULL"
        )

        scored = []
        for row in hack_rows:
            h_vec = _parse_vector(str(row["embedding"]))
            score = cosine_similarity(user_vec, h_vec)
            tags  = row["tags"]
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except json.JSONDecodeError:
                    tags = []
            scored.append({
                "hackathon_id":    row["id"],
                "title":           row["title"],
                "source":          row["source"],
                "source_url":      row["source_url"],
                "prize_pool":      row["prize_pool"],
                "tags":            tags,
                "deadline":        row["deadline"],
                "match_score_raw": round(score, 4),
                "match_pct":       round(score * 100),
            })

        scored.sort(key=lambda x: x["match_score_raw"], reverse=True)
        return scored[:top_n]

    finally:
        await conn.close()


def _parse_vector(raw: str) -> list[float]:
    """Convierte '[0.1,0.2,...]' (pgvector format) a lista de floats."""
    return [float(x) for x in raw.strip("[]").split(",") if x.strip()]


# ─────────────────────────────────────────────
# 4. Batch — embebeder todas las hackatones sin vector
# ─────────────────────────────────────────────
async def run_full_batch(batch_size: int = 50) -> dict:
    """
    Genera embeddings para todas las hackatones en active_hackathons
    que aún no tienen vector. Útil para backfill inicial.

    Returns:
        {"processed": int, "failed": int, "skipped": int}
    """
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        ids = await conn.fetch(
            "SELECT id FROM active_hackathons WHERE embedding IS NULL LIMIT $1",
            batch_size,
        )
    finally:
        await conn.close()

    if not ids:
        log.info("run_full_batch: todas las hackatones ya tienen embedding ✓")
        return {"processed": 0, "failed": 0, "skipped": 0}

    log.info(f"run_full_batch: {len(ids)} hackatones sin embedding — iniciando...")

    processed = failed = 0
    for row in ids:
        ok = await embed_hackathon(row["id"])
        if ok:
            processed += 1
        else:
            failed += 1

    log.info(
        f"run_full_batch completado: "
        f"✓ {processed} procesadas  ✗ {failed} fallidas"
    )
    return {"processed": processed, "failed": failed, "skipped": 0}


# ─────────────────────────────────────────────
# Ruta FastAPI — opcional, para exponer via API
# ─────────────────────────────────────────────
def create_router():
    """
    Retorna un APIRouter de FastAPI con endpoints de matching.
    Importar en main.py: from engine.ml_matcher import create_router
    """
    from fastapi import APIRouter, HTTPException

    router = APIRouter()

    @router.get("/score/{user_id}")
    async def match_score(user_id: str, top_n: int = 3):
        """Top-N hackatones más afines al perfil del estudiante."""
        results = await calculate_match_score(user_id, top_n)
        if not results:
            raise HTTPException(
                status_code=404,
                detail="Sin datos de matching. Verifica que el perfil tenga skills registrados.",
            )
        return {"user_id": user_id, "matches": results}

    @router.post("/embed/hackathon/{hackathon_id}")
    async def embed_hack(hackathon_id: str):
        ok = await embed_hackathon(hackathon_id)
        return {"success": ok, "hackathon_id": hackathon_id}

    @router.post("/embed/user/{user_id}")
    async def embed_user(user_id: str):
        ok = await embed_user_profile(user_id)
        return {"success": ok, "user_id": user_id}

    @router.post("/batch")
    async def batch_embed(batch_size: int = 50):
        result = await run_full_batch(batch_size)
        return result

    return router


# ─────────────────────────────────────────────
# Entry point — modo batch standalone
# ─────────────────────────────────────────────
async def main() -> None:
    """Corre el backfill completo y calcula un match de prueba."""
    log.info("=" * 60)
    log.info("  ML Matcher — MarketMatch con sentence-transformers")
    log.info(f"  Modelo : {MODEL_NAME}  |  Dims: {EMBEDDING_DIMS}")
    log.info("=" * 60)

    # 1. Cargar modelo
    get_model()

    # 2. Backfill de embeddings de hackatones
    batch_result = await run_full_batch(batch_size=100)
    log.info(f"Batch: {batch_result}")

    # 3. Demo de match para un usuario de prueba
    demo_user = "test@xiimalab.dev"
    matches   = await calculate_match_score(demo_user, top_n=3)

    if matches:
        log.info(f"\n🎯 Top-3 matches para {demo_user}:")
        for i, m in enumerate(matches, 1):
            log.info(
                f"  {i}. {m['title'][:50]:<50} "
                f"{m['match_pct']:>3}%  "
                f"${m['prize_pool']:,}  "
                f"[{m['source']}]"
            )
    else:
        log.info(f"Sin matches para {demo_user} — agrega datos de skills primero.")


if __name__ == "__main__":
    asyncio.run(main())
