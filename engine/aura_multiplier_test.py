import asyncio
from typing import List, Dict

async def calculate_match_score(user_skills: Dict[str, int], hackathon: Dict) -> Dict:
    """
    Calcula la competitividad de un usuario para una hackatón específica.
    """
    hackathon_tags = hackathon.get("tags", [])
    if not hackathon_tags:
        return {"score": 0, "analysis": "Faltan datos de la hackatón."}

    base_score = 0
    matched_tags = 0
    
    # 1. Cálculo Base: ¿Qué tanto cubre el usuario los requerimientos?
    for tag in hackathon_tags:
        if tag in user_skills:
            base_score += user_skills[tag]
            matched_tags += 1
            
    if matched_tags == 0:
         return {"score": 0, "is_golden": False, "analysis": "No hay alineación con tu perfil actual."}

    # Promedio de las habilidades requeridas que el usuario posee
    final_score = base_score / len(hackathon_tags)
    analysis = "Buen match basado en tu portafolio actual."

    # 2. El Multiplicador AURA (Compensación del Gap)
    # Sabemos que el mercado pide 99% en AI/LLM. Si la hackatón lo requiere y el usuario tiene una base (ej. > 60%),
    # el acceso a la plataforma AURA cerrará ese gap drásticamente.
    if "AI / LLM" in hackathon_tags:
        user_ai_level = user_skills.get("AI / LLM", 0)
        
        if user_ai_level >= 70:
            final_score += 15  # ¡Este es el empujón para superar el 90%!
            analysis = "🔥 Golden Match: Tienes buena base en IA y las herramientas de AURA cerrarán tu gap al 99% para competir por el premio."
        elif user_ai_level >= 40:
            final_score += 10
            analysis = "AURA te dará una ventaja competitiva, pero el Coach te sugiere un roadmap intensivo primero."

    # Bonus por Data Analytics (Tu fuerte al 82%)
    if "Data Analytics" in hackathon_tags and user_skills.get("Data Analytics", 0) >= 80:
         final_score += 5

    # 3. Limitar a 100 y redondear
    final_score = min(round(final_score), 100)
    
    return {
        "hackathon_name": hackathon.get("name"),
        "prize": hackathon.get("prize"),
        "score": final_score,
        "is_golden": final_score >= 90,
        "analysis": analysis
    }

async def rank_top_opportunities(user_skills: Dict[str, int], hackathons_db: List[Dict]) -> List[Dict]:
    """
    Cruza el perfil del usuario con toda la base de datos y devuelve el Top 3.
    """
    tasks = [calculate_match_score(user_skills, hack) for hack in hackathons_db]
    results = await asyncio.gather(*tasks)
    
    # Ordenar de mayor a menor score
    ranked_results = sorted(results, key=lambda x: x["score"], reverse=True)
    
    # Devolver solo el Top 3
    return ranked_results[:3]

# --- BLOQUE DE PRUEBA LOCAL ---
async def test_strategist():
    perfil_santiago = {
        "AI / LLM": 70,
        "Data Analytics": 82,
        "Web3 / DeFi": 65
    }
    
    base_de_datos_mock = [
        {"name": "GitLab AI", "prize": "$65k", "tags": ["AI / LLM", "Data Analytics"]},
        {"name": "ETHLatam", "prize": "$10k", "tags": ["Web3 / DeFi", "ZK / Privacy"]},
        {"name": "Smart Innovation", "prize": "$75k", "tags": ["AI / LLM", "Web3 / DeFi"]}
    ]
    
    top_3 = await rank_top_opportunities(perfil_santiago, base_de_datos_mock)
    
    print("\n🏆 TOP 3 HACKATONES PARA TI:")
    for i, op in enumerate(top_3, 1):
        glow = "✨ [GLOW ACTIVADO]" if op['is_golden'] else ""
        print(f"{i}. {op['hackathon_name']} ({op['prize']}) - Score: {op['score']}% {glow}")
        print(f"   Analista: {op['analysis']}\n")

if __name__ == "__main__":
    asyncio.run(test_strategist())
