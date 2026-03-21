import asyncio
import json
import os
from typing import Dict
import asyncpg
from dotenv import load_dotenv

load_dotenv()

db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/xiimalab")
if db_url.startswith("sqlite"):
    db_url = "postgresql://postgres:postgres@localhost:5432/xiimalab"
DATABASE_URL = db_url

async def calculate_live_market_demand() -> Dict[str, float]:
    """
    Extrea todas las hackatones activas de la base de datos, calcula la 
    frecuencia de cada tag (skill) ponderada por su prize_pool, y normaliza 
    el resultado en un porcentaje (0-100%) para reflejar la demanda del mercado libre.
    """
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # 1. Extraer todas las hackatones activas
        records = await conn.fetch(
            "SELECT title, prize_pool, tags FROM active_hackathons WHERE prize_pool > 0"
        )
    finally:
        await conn.close()

    tag_scores: Dict[str, float] = {}
    max_score = 0.0

    # 2. Calcular la frecuencia ponderada por prize_pool
    for record in records:
        prize_pool = float(record["prize_pool"] or 0)
        tags_raw = record["tags"]
        
        # Manejar tags como string JSON o lista
        if isinstance(tags_raw, str):
            try:
                tags = json.loads(tags_raw)
            except json.JSONDecodeError:
                tags = [tags_raw]
        else:
            tags = tags_raw or []
            
        # Ponderamos cada tag por el prize pool
        for tag in tags:
            tag_clean = tag.strip().upper()  # Normalizar tag
            tag_scores[tag_clean] = tag_scores.get(tag_clean, 0) + prize_pool

    # Encontrar el máximo para normalizar
    if tag_scores:
        max_score = max(tag_scores.values())

    # 3. Normalizar a porcentaje (Demand %)
    market_demand: Dict[str, float] = {}
    for tag, score in tag_scores.items():
        if max_score > 0:
            # Multiplicar por 100 y redondear
            market_demand[tag] = round((score / max_score) * 100, 2)
        else:
            market_demand[tag] = 0.0
            
    # Ordenar por demanda descendente
    sorted_demand = dict(sorted(market_demand.items(), key=lambda item: item[1], reverse=True))

    return sorted_demand

async def main():
    print("🚀 Calculando Demanda de Mercado en Vivo (Prize-Weighted)...")
    try:
        demand = await calculate_live_market_demand()
        print("\n📈 [MARKET DEMAND %] Top 10 Skills:")
        
        top_10 = list(demand.items())[:10]
        for idx, (skill, pct) in enumerate(top_10, 1):
            bar = "█" * int(pct / 5)
            print(f"{idx:2d}. {skill:<20} {pct:>6.2f}% | {bar}")
            
    except Exception as e:
        print(f"Error conectando a la BD: {e}")

if __name__ == "__main__":
    asyncio.run(main())
