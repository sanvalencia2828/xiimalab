"""
engine/test_ml_match.py
─────────────────────────────────────────────────────────────────────────────
Prueba de Fuego — MarketMatch ML

Corre este script dentro del contenedor ml-matcher:
  docker compose run --rm ml-matcher python test_ml_match.py

O localmente si tienes las dependencias:
  pip install sentence-transformers numpy asyncpg python-dotenv
  python engine/test_ml_match.py

Qué hace:
  1. Carga all-MiniLM-L6-v2 y muestra dims
  2. Hace backfill de embeddings en active_hackathons (solo las NULL)
  3. Genera/actualiza el profile_embedding para tu usuario
  4. Ejecuta calculate_match_score y muestra Top-3 con % exacto
─────────────────────────────────────────────────────────────────────────────
"""
import asyncio
import os
import sys

# Asegurar que el engine está en el path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

import numpy as np
from sentence_transformers import SentenceTransformer

# ── 1. Verificar modelo ──────────────────────────────────
print("\n" + "=" * 60)
print("  PASO 1 — Carga del modelo sentence-transformers")
print("=" * 60)

model = SentenceTransformer("all-MiniLM-L6-v2")
dims  = model.get_sentence_embedding_dimension()
print(f"✅ Modelo cargado: all-MiniLM-L6-v2")
print(f"   Dimensiones : {dims}")
print(f"   Dispositivo : {'GPU' if 'cuda' in str(model.device) else 'CPU'}")

# ── 2. Test de embedding rápido ──────────────────────────
sample = model.encode("Python Blockchain AI Stellar", normalize_embeddings=True)
print(f"   Test embed   : vector[{len(sample)}] OK  (primeros 4 dims: {sample[:4].tolist()})")


# ── 3. Backfill + Match con DB ───────────────────────────
async def run():
    try:
        import asyncpg
    except ImportError:
        print("\n⚠️  asyncpg no instalado. Solo modo offline disponible.")
        _demo_offline(model)
        return

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("\n⚠️  DATABASE_URL no configurada. Corriendo demo offline.")
        _demo_offline(model)
        return

    try:
        conn = await asyncpg.connect(db_url)
        print(f"\n✅ Conexión a DB: OK")
    except Exception as exc:
        print(f"\n❌ No se pudo conectar a la DB: {exc}")
        print("   Corriendo demo offline...")
        _demo_offline(model)
        return

    try:
        # ── PASO 2: Backfill de hackatones ────────────────
        print("\n" + "=" * 60)
        print("  PASO 2 — Backfill embeddings en active_hackathons")
        print("=" * 60)

        rows = await conn.fetch(
            "SELECT id, title, tags, prize_pool, source "
            "FROM active_hackathons WHERE embedding IS NULL LIMIT 100"
        )
        print(f"   Sin embedding: {len(rows)} hackatones")

        processed = 0
        import json as _json
        for row in rows:
            tags = row["tags"] or []
            if isinstance(tags, str):
                try:
                    tags = _json.loads(tags)
                except Exception:
                    tags = []
            text = (
                f"{row['title']} | "
                f"Skills: {', '.join(tags)} | "
                f"Premio: {row['prize_pool']} USD | "
                f"Fuente: {row['source']}"
            )
            vector = model.encode(text, normalize_embeddings=True).tolist()
            vec_str = "[" + ",".join(f"{v:.8f}" for v in vector) + "]"
            await conn.execute(
                "UPDATE active_hackathons SET embedding = $1 WHERE id = $2",
                vec_str, row["id"],
            )
            processed += 1
            if processed % 10 == 0:
                print(f"   ... {processed}/{len(rows)} procesadas")

        print(f"✅ Backfill completado: {processed} hackatones vectorizadas")

        # ── PASO 3: Profile embedding de Santiago ─────────
        print("\n" + "=" * 60)
        print("  PASO 3 — Profile embedding del estudiante")
        print("=" * 60)

        user_id = os.environ.get("TEST_USER_ID", "sanvalencia2828@gmail.com")
        user_text = (
            "Desarrollador con experiencia en AURA IA procesamiento de imágenes | "
            "Habilidades: Python, Stellar SDK, Analítica de Datos NODO-EAFIT, "
            "Docker, Blockchain, Machine Learning, FastAPI, Next.js | "
            "Experiencia en hackatones blockchain y Web3 | "
            "Certificado Stellar Impacta | Medellín Colombia"
        )

        user_vec = model.encode(user_text, normalize_embeddings=True).tolist()
        vec_str  = "[" + ",".join(f"{v:.8f}" for v in user_vec) + "]"

        # Upsert en user_skills_progress
        await conn.execute(
            """
            INSERT INTO user_skills_progress (user_id, profile_embedding)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET
                profile_embedding = $2,
                updated_at        = NOW()
            """,
            user_id, vec_str,
        )
        print(f"✅ Profile embedding guardado para: {user_id}")

        # ── PASO 4: Top-3 Match ───────────────────────────
        print("\n" + "=" * 60)
        print(f"  PASO 4 — Top-3 MarketMatch para {user_id}")
        print("=" * 60)

        # Calcular en Python (compatibilidad sin función SQL pgvector)
        hack_rows = await conn.fetch(
            "SELECT id, title, source, source_url, prize_pool, tags, deadline, embedding "
            "FROM active_hackathons WHERE embedding IS NOT NULL"
        )

        scores = []
        for h in hack_rows:
            h_vec = [float(x) for x in str(h["embedding"]).strip("[]").split(",")]
            sim   = float(np.dot(np.array(user_vec), np.array(h_vec)))
            tags  = h["tags"] or []
            if isinstance(tags, str):
                try:
                    tags = _json.loads(tags)
                except Exception:
                    tags = []
            scores.append({
                "id":         h["id"],
                "title":      h["title"],
                "source":     h["source"],
                "source_url": h["source_url"],
                "prize_pool": h["prize_pool"],
                "tags":       tags,
                "deadline":   h["deadline"],
                "match_pct":  round(sim * 100),
                "sim":        sim,
            })

        scores.sort(key=lambda x: x["sim"], reverse=True)
        top3 = scores[:3]

        print()
        for rank, m in enumerate(top3, 1):
            bar  = "█" * (m["match_pct"] // 5) + "░" * (20 - m["match_pct"] // 5)
            tags = ", ".join(m["tags"][:4]) if m["tags"] else "–"
            print(f"  {rank}. {m['title'][:45]:<45}  {m['match_pct']:>3}%")
            print(f"     {bar}")
            print(f"     💰 ${m['prize_pool']:>8,}  |  🏷  {tags}")
            print(f"     🔗 {(m['source_url'] or '–')[:60]}")
            print()

        print("=" * 60)
        print(f"  Total hackatones comparadas: {len(scores)}")
        print(f"  Similitud promedio Top-3:    {round(sum(m['match_pct'] for m in top3)/3)}%")
        print("=" * 60)

    finally:
        await conn.close()


def _demo_offline(model):
    """Demostración sin DB usando datos de ejemplo."""
    print("\n" + "=" * 60)
    print("  DEMO OFFLINE — Sin conexión a DB")
    print("=" * 60)

    hackathons = [
        {"title": "AI x Web3 Global Sprint",      "tags": ["AI", "Python", "Blockchain", "Web3"],  "prize_pool": 100000, "source": "devpost"},
        {"title": "Stellar Build Challenge 2026",  "tags": ["Stellar", "DeFi", "Smart Contracts"],  "prize_pool": 50000,  "source": "devfolio"},
        {"title": "Data Analytics Hackathon",      "tags": ["Python", "Data", "SQL", "Analytics"],  "prize_pool": 30000,  "source": "devpost"},
        {"title": "Avalanche Summit Hackathon",    "tags": ["Avalanche", "NFT", "EVM", "Web3"],     "prize_pool": 75000,  "source": "dorahacks"},
        {"title": "ETHIndia 2026",                 "tags": ["Solidity", "EVM", "DeFi", "Ethereum"], "prize_pool": 60000,  "source": "devfolio"},
    ]

    user_text = (
        "Python Stellar SDK Analítica de Datos NODO-EAFIT Docker Blockchain "
        "Machine Learning FastAPI Next.js AURA IA procesamiento imágenes hackatones Web3"
    )

    hack_texts = [
        f"{h['title']} | {', '.join(h['tags'])} | {h['prize_pool']} USD"
        for h in hackathons
    ]

    vecs  = model.encode(hack_texts + [user_text], normalize_embeddings=True)
    u_vec = vecs[-1]

    scores = []
    for i, h in enumerate(hackathons):
        sim = float(np.dot(u_vec, vecs[i]))
        scores.append((sim, h))
    scores.sort(reverse=True)

    print("\n  🎯 Top-3 para Santiago (demo sin DB):\n")
    for rank, (sim, h) in enumerate(scores[:3], 1):
        pct = round(sim * 100)
        bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
        print(f"  {rank}. {h['title']:<42}  {pct:>3}%")
        print(f"     {bar}")
        print(f"     Tags: {', '.join(h['tags'])}  |  💰 ${h['prize_pool']:,}\n")


if __name__ == "__main__":
    asyncio.run(run())
