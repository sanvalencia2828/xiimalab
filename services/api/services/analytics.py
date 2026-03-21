"""
Analytics service — Skill relevance analysis without LLM
"""
from collections import Counter
from typing import List, Dict, Any, Optional
import asyncio
import json
import logging
import os
import random
import time
import hashlib

import httpx

log = logging.getLogger("xiima.analytics")

OPENROUTER_API_KEY: str = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "anthropic/claude-3.5-sonnet"
MAX_RETRIES = 3
MAX_TOKENS = 1024

RECOMMENDATIONS_CACHE_TTL = 3600
recommendations_cache: Dict[str, Dict[str, Any]] = {}

SYSTEM_PROMPT_PEDAGOGY = """You are an expert technical educator specializing in creating micro-syllabi for software engineering skills.

Your task is to generate a structured learning roadmap for a specific skill based on the target mastery level.

IMPORTANT CONSTRAINTS:
1. ONLY respond with technical and educational content
2. Focus strictly on the requested skill and related technical topics
3. Do NOT include any harmful, offensive, or non-educational content
4. Keep all recommendations professional and skill-development focused
5. Return ONLY valid JSON with no markdown, no explanations, no extra text

The roadmap should have 3-5 logical steps to reach the target level, where:
- Each step must include: title, duration (e.g., '2h', '4h', '1d'), type ('Video', 'Project', or 'Doc'), and description
- Steps should be ordered from foundational to advanced
- Duration should be realistic for the step complexity

Output format (EXACT JSON structure):
{
    "roadmap": [
        {"title": "str", "duration": "str", "type": "Video|Project|Doc", "description": "str"}
    ],
    "target_level": int,
    "estimated_total": "str"
}"""

SYSTEM_PROMPT_RECOMMENDATIONS = """You are an expert career advisor and technical matchmaker for hackathons.

Your task is to analyze user skills and hackathon requirements to provide personalized recommendations.

IMPORTANT CONSTRAINTS:
1. ONLY respond with technical and educational content
2. Focus on legitimate skill development and career growth
3. Do NOT include any harmful, offensive, or promotional content
4. Keep all recommendations professional and development-focused
5. Return ONLY valid JSON with no markdown, no explanations, no extra text

Analyze:
- User skills and their proficiency levels
- Hackathon requirements, prizes, and technologies
- Identify the TOP 3 hackathons with highest technical affinity

For each recommended hackathon, generate:
1. "matching_skill": The specific skill from the user that matches
2. "reasoning_phrase": A compelling explanation in Spanish (1-2 sentences) of WHY this skill is key
3. "potential_growth_score": 1-100 score of how much the user would learn (based on new tech involved vs existing skills)

Output format (EXACT JSON structure):
{
    "recommendations": [
        {
            "hackathon_id": "string",
            "hackathon_title": "string",
            "matching_skill": "string",
            "reasoning_phrase": "string (in Spanish, 1-2 sentences)",
            "potential_growth_score": int (1-100)
        }
    ]
}"""


SKILL_COMPLEXITY_WEIGHTS: Dict[str, float] = {
    "AI": 1.0, "ML": 1.0, "LLM": 1.0, "GPT": 1.0, "OPENAI": 1.0,
    "MACHINE LEARNING": 1.0, "ARTIFICIAL INTELLIGENCE": 1.0, "DEEP LEARNING": 1.0,
    "BLOCKCHAIN": 0.9, "WEB3": 0.9, "DEFI": 0.9, "NFT": 0.8, "SOLANA": 0.85,
    "ETHEREUM": 0.85, "SMART CONTRACTS": 0.9, "CRYPTO": 0.8,
    "RUST": 0.95, "GO": 0.85, "RUST": 0.95,
    "TYPESCRIPT": 0.6, "JAVASCRIPT": 0.5, "PYTHON": 0.55, "JAVA": 0.6,
    "REACT": 0.65, "NEXT.JS": 0.7, "NODE.JS": 0.65, "SVELTE": 0.6,
    "POSTGRESQL": 0.7, "MYSQL": 0.65, "MONGODB": 0.7, "DATABASE": 0.6,
    "DOCKER": 0.75, "KUBERNETES": 0.9, "AWS": 0.8, "GCP": 0.8, "AZURE": 0.8,
    "GRAPHQL": 0.7, "REST API": 0.55, "API": 0.5,
    "SMART CONTRACT": 0.9, "HARDHAT": 0.85, "FOUNDRY": 0.85,
    "IOS": 0.7, "ANDROID": 0.7, "MOBILE": 0.65, "REACT NATIVE": 0.7,
    "FIGMA": 0.4, "UI/UX": 0.45, "DESIGN": 0.4,
    "GIT": 0.3, "GITHUB": 0.3, "CI/CD": 0.65,
    "SECURITY": 0.85, "CRYPTOGRAPHY": 0.9, "ZKP": 0.95,
    "DATA SCIENCE": 0.85, "ANALYTICS": 0.7, "PANDAS": 0.7, "NUMPY": 0.7,
    "GAMEFI": 0.8, "GAMING": 0.7, "UNITY": 0.75, "UNREAL": 0.75,
    "AR/VR": 0.85, "METAVERSE": 0.8, "3D": 0.7,
}


def get_default_complexity(skill: str) -> float:
    """Estimate complexity based on skill name patterns"""
    skill_upper = skill.upper()
    if any(x in skill_upper for x in ["AI", "ML", "LLM", "DEEP", "NEURAL"]):
        return 0.9
    if any(x in skill_upper for x in ["BLOCKCHAIN", "WEB3", "CRYPTO", "ZKP"]):
        return 0.85
    if any(x in skill_upper for x in ["RUST", "GOLANG", "KUBERNETES"]):
        return 0.8
    if any(x in skill_upper for x in ["REACT", "NEXT", "SVELTE", "NODE"]):
        return 0.55
    if any(x in skill_upper for x in ["PYTHON", "JAVASCRIPT", "TYPESCRIPT"]):
        return 0.45
    return 0.5


def get_skill_complexity(skill: str) -> float:
    """Get complexity weight for a skill"""
    skill_upper = skill.upper().strip()
    for key, weight in SKILL_COMPLEXITY_WEIGHTS.items():
        if key.upper() in skill_upper or skill_upper in key.upper():
            return weight
    return get_default_complexity(skill)


async def get_skill_relevance_report(hackathons: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate skill relevance without LLM.
    
    Algorithm:
    1. Extract all tags from hackathons
    2. Count frequency of each skill
    3. Calculate complexity score for each skill
    4. Final score = frequency_score * 0.6 + complexity * 0.4
    5. Determine trend based on recent appearance
    
    Args:
        hackathons: List of hackathon dicts with 'tags' field
        
    Returns:
        Dict with 'relevance_report' containing list of:
        { 'skill': str, 'score': int, 'trend': 'up' | 'stable' }
    """
    if not hackathons:
        return {"relevance_report": [], "generated_at": _get_timestamp()}
    
    tag_counter: Counter = Counter()
    tag_hackathon_count: Dict[str, int] = {}
    total_hackathons = len(hackathons)
    
    for hackathon in hackathons:
        tags = hackathon.get("tags") or []
        seen_in_hack = set()
        for tag in tags:
            tag_clean = tag.strip()
            if tag_clean and tag_clean.lower() not in seen_in_hack:
                tag_counter[tag_clean] += 1
                tag_hackathon_count[tag_clean] = tag_hackathon_count.get(tag_clean, 0) + 1
                seen_in_hack.add(tag_clean.lower())
    
    max_freq = max(tag_counter.values()) if tag_counter else 1
    
    skill_scores: List[Dict[str, Any]] = []
    for skill, freq in tag_counter.items():
        freq_score = (freq / max_freq) * 100
        complexity = get_skill_complexity(skill)
        complexity_score = complexity * 100
        final_score = (freq_score * 0.6) + (complexity_score * 0.4)
        
        trend = "stable"
        if freq >= 3 and freq >= total_hackathons * 0.15:
            trend = "up"
        
        skill_scores.append({
            "skill": skill,
            "score": int(min(100, round(final_score))),
            "frequency": freq,
            "complexity": round(complexity, 2),
            "trend": trend,
        })
    
    skill_scores.sort(key=lambda x: x["score"], reverse=True)
    top_10 = skill_scores[:10]
    
    for i, item in enumerate(top_10):
        del item["frequency"]
        del item["complexity"]
    
    return {
        "relevance_report": top_10,
        "total_skills_analyzed": len(tag_counter),
        "total_hackathons": total_hackathons,
        "generated_at": _get_timestamp(),
    }


def _get_timestamp() -> str:
    """Get current ISO timestamp"""
    from datetime import datetime
    return datetime.utcnow().isoformat() + "Z"


FALLBACK_ROADMAPS: Dict[str, Dict[str, Any]] = {
    "AI": {
        "roadmap": [
            {"title": "Fundamentos de Machine Learning", "duration": "4h", "type": "Doc", "description": "Aprende los conceptos básicos: regresión, clasificación, clustering"},
            {"title": "Deep Learning Essentials", "duration": "6h", "type": "Video", "description": "Redes neuronales, backpropagation, optimizadores"},
            {"title": "LLM Fundamentals", "duration": "5h", "type": "Doc", "description": "Transformers, attention mechanism, fine-tuning básico"},
            {"title": "Proyecto: Clasificador de Imágenes", "duration": "8h", "type": "Project", "description": "Construye un modelo de clasificación con PyTorch o TensorFlow"},
            {"title": "API con OpenAI/Anthropic", "duration": "3h", "type": "Doc", "description": "Integración de modelos en aplicaciones reales"},
        ],
        "estimated_total": "26h"
    },
    "BLOCKCHAIN": {
        "roadmap": [
            {"title": "Conceptos de Blockchain", "duration": "3h", "type": "Doc", "description": "Descentralización, consenso, criptografía básica"},
            {"title": "Ethereum y Smart Contracts", "duration": "5h", "type": "Video", "description": "EVM, Solidity, estructuras de datos en blockchain"},
            {"title": "Desarrollo con Hardhat", "duration": "6h", "type": "Project", "description": "Setup, testing y deployment de contratos"},
            {"title": "Tokens ERC-20 y ERC-721", "duration": "4h", "type": "Doc", "description": "Estándares de tokens y mejores prácticas"},
            {"title": "Proyecto: Token y NFT", "duration": "10h", "type": "Project", "description": "Crea tu propio token y colección NFT"},
        ],
        "estimated_total": "28h"
    },
    "DEFI": {
        "roadmap": [
            {"title": "Fundamentos DeFi", "duration": "3h", "type": "Doc", "description": "AMMs, liquidity pools, yield farming"},
            {"title": "Solidity Intermedio", "duration": "5h", "type": "Video", "description": "Mappings, modifiers, eventos, gas optimization"},
            {"title": "Protocolos: Uniswap, Aave", "duration": "4h", "type": "Doc", "description": "Cómo funcionan los protocolos DeFi principales"},
            {"title": "Security en DeFi", "duration": "4h", "type": "Doc", "description": "Reentrancy, flash loans, auditorías"},
            {"title": "Proyecto: DEX básico", "duration": "12h", "type": "Project", "description": "Construye un exchange descentralizado simplificado"},
        ],
        "estimated_total": "28h"
    },
    "WEB3": {
        "roadmap": [
            {"title": "Introducción a Web3", "duration": "2h", "type": "Doc", "description": "Wallets, dApps, blockchain networks"},
            {"title": "Web3.js / Ethers.js", "duration": "4h", "type": "Video", "description": "Conexión a blockchain desde JavaScript"},
            {"title": "IPFS y Almacenamiento", "duration": "3h", "type": "Doc", "description": "Almacenamiento descentralizado de archivos"},
            {"title": "Autenticación con Wallet", "duration": "3h", "type": "Project", "description": "Login con MetaMask u otras wallets"},
            {"title": "Proyecto: dApp Completa", "duration": "10h", "type": "Project", "description": "Construye una dApp con frontend y smart contracts"},
        ],
        "estimated_total": "22h"
    },
    "PYTHON": {
        "roadmap": [
            {"title": "Sintaxis y Estructuras", "duration": "3h", "type": "Doc", "description": "Variables, funciones, listas, diccionarios"},
            {"title": "POO en Python", "duration": "3h", "type": "Doc", "description": "Clases, herencia, polimorfismo"},
            {"title": "Módulos y Paquetes", "duration": "2h", "type": "Doc", "description": "pip, virtualenv, imports"},
            {"title": "FastAPI o Flask", "duration": "5h", "type": "Video", "description": "Crear APIs REST con Python"},
            {"title": "Proyecto: API REST", "duration": "8h", "type": "Project", "description": "Construye una API completa con base de datos"},
        ],
        "estimated_total": "21h"
    },
    "REACT": {
        "roadmap": [
            {"title": "Fundamentos de React", "duration": "4h", "type": "Video", "description": "Componentes, JSX, props, estado"},
            {"title": "Hooks Essenciales", "duration": "4h", "type": "Doc", "description": "useState, useEffect, useContext"},
            {"title": "React Router", "duration": "2h", "type": "Doc", "description": "Navegación SPA"},
            {"title": "State Management", "duration": "3h", "type": "Doc", "description": "Context API, Zustand, o Redux basics"},
            {"title": "Proyecto: App Completa", "duration": "12h", "type": "Project", "description": "Construye una app con API y routing"},
        ],
        "estimated_total": "25h"
    },
    "SOLIDITY": {
        "roadmap": [
            {"title": "Sintaxis de Solidity", "duration": "4h", "type": "Doc", "description": "Tipos, funciones, visibilidad"},
            {"title": "Estructuras de Datos", "duration": "3h", "type": "Doc", "description": "Mappings, structs, arrays"},
            {"title": "Smart Contract Patterns", "duration": "4h", "type": "Doc", "description": "Modifiers, events, error handling"},
            {"title": "Testing con Hardhat", "duration": "5h", "type": "Project", "description": "Unit tests y integration tests"},
            {"title": "Proyecto: Token ERC-20", "duration": "6h", "type": "Project", "description": "Despliega tu propio token en testnet"},
        ],
        "estimated_total": "22h"
    },
}


def _backoff_delay(attempt: int) -> float:
    """Return delay in seconds for given attempt with jitter."""
    base_delay = 1.0
    delay = min(base_delay * (2 ** attempt), 10.0)
    jitter = delay * 0.2 * (random.random() * 2 - 1)
    return max(0.1, delay + jitter)


async def _call_openrouter(prompt: str) -> str:
    """Call OpenRouter API with retries."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://xiimalab.vercel.app",
        "X-Title": "Xiimalab Learning Roadmap Generator",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "max_tokens": MAX_TOKENS,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT_PEDAGOGY},
            {"role": "user", "content": prompt},
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(MAX_RETRIES):
            try:
                resp = await client.post(OPENROUTER_BASE_URL, headers=headers, json=payload)
                if resp.status_code in (400, 401, 403):
                    raise RuntimeError(f"Non-retryable HTTP {resp.status_code}")
                if resp.status_code in {429, 500, 502, 503, 504}:
                    await asyncio.sleep(_backoff_delay(attempt))
                    continue
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            except (httpx.TimeoutException, httpx.RequestError):
                await asyncio.sleep(_backoff_delay(attempt))
                continue

    raise RuntimeError("OpenRouter failed after max retries")


async def generate_learning_roadmap(skill: str, target_level: int) -> Dict[str, Any]:
    """
    Generate a micro-syllabus for learning a specific skill using AI.
    
    Args:
        skill: The skill to learn (e.g., "Python", "AI", "Solidity")
        target_level: Target mastery level (1-100)
        
    Returns:
        Dict with roadmap steps and metadata
    """
    skill_upper = skill.upper()
    
    for fallback_skill, fallback_data in FALLBACK_ROADMAPS.items():
        if fallback_skill in skill_upper or skill_upper in fallback_skill:
            return {
                **fallback_data,
                "skill": skill,
                "target_level": target_level,
                "source": "fallback",
            }
    
    if not OPENROUTER_API_KEY:
        log.warning("OPENROUTER_API_KEY not set, using default roadmap")
        return _get_default_roadmap(skill, target_level)
    
    prompt = f"""Genera una ruta de aprendizaje para: {skill}
Nivel objetivo: {target_level}/100

El nivel {target_level} significa:
- 1-30: Principiante (fundamentos)
- 31-60: Intermedio (aplicación práctica)
- 61-80: Avanzado (proyectos complejos)
- 81-100: Experto (contribución y liderazgo técnico)

Devuelve SOLO el JSON, sin explicaciones."""

    try:
        raw_text = await _call_openrouter(prompt)
        result = json.loads(raw_text.strip())
        
        if "roadmap" in result and isinstance(result["roadmap"], list):
            return {
                **result,
                "skill": skill,
                "target_level": target_level,
                "source": "ai",
            }
        else:
            log.warning(f"Invalid AI response format for {skill}, using fallback")
            return _get_default_roadmap(skill, target_level)
            
    except json.JSONDecodeError as exc:
        log.error(f"JSON decode error for {skill}: {exc}")
        return _get_default_roadmap(skill, target_level)
    except RuntimeError as exc:
        log.error(f"OpenRouter error for {skill}: {exc}")
        return _get_default_roadmap(skill, target_level)
    except Exception as exc:
        log.error(f"Unexpected error for {skill}: {exc}")
        return _get_default_roadmap(skill, target_level)


def _get_default_roadmap(skill: str, target_level: int) -> Dict[str, Any]:
    """Get a default roadmap when AI is unavailable."""
    return {
        "roadmap": [
            {"title": f"Fundamentos de {skill}", "duration": "4h", "type": "Doc", "description": "Aprende los conceptos básicos y la teoría"},
            {"title": f"Primeros Pasos en {skill}", "duration": "6h", "type": "Video", "description": "Tutoriales prácticos y ejercicios guiados"},
            {"title": f"Proyecto Introductorio", "duration": "8h", "type": "Project", "description": "Aplica lo aprendido en un proyecto pequeño"},
            {"title": f"Avanzando en {skill}", "duration": "8h", "type": "Doc", "description": "Temas intermedios y patrones comunes"},
            {"title": f"Proyecto Intermedio", "duration": "12h", "type": "Project", "description": "Construye algo más complejo"},
        ],
        "skill": skill,
        "target_level": target_level,
        "estimated_total": "38h",
        "source": "default",
    }


def _get_cache_key(user_skills: List[str], hackathon_ids: List[str]) -> str:
    """Generate cache key based on user skills and hackathon IDs."""
    skills_str = ",".join(sorted(s.lower() for s in user_skills))
    hacks_str = ",".join(sorted(hackathon_ids))
    combined = f"{skills_str}|{hacks_str}"
    return hashlib.md5(combined.encode()).hexdigest()


def _calculate_match_and_growth(
    user_skills: List[str],
    hackathon_tags: List[str],
    hackathon_id: str,
    hackathon_title: str
) -> Optional[Dict[str, Any]]:
    """Calculate match and growth score without LLM for fallback."""
    user_skill_set = set(s.lower() for s in user_skills)
    matching_skills = []
    
    for tag in hackathon_tags:
        tag_lower = tag.lower()
        for user_skill in user_skills:
            user_lower = user_skill.lower()
            if tag_lower in user_lower or user_lower in tag_lower:
                matching_skills.append(user_skill)
                break
    
    if not matching_skills:
        return None
    
    primary_match = matching_skills[0]
    match_score = min(100, 30 + (len(matching_skills) * 20))
    
    new_tech_count = sum(
        1 for tag in hackathon_tags
        if not any(
            tag.lower() in s.lower() or s.lower() in tag.lower()
            for s in user_skills
        )
    )
    growth_score = min(100, 40 + (new_tech_count * 15))
    
    reasoning_templates = {
        "python": f"Tu experiencia en Python te permite implementar rápidamente los algoritmos requeridos.",
        "react": f"Tu dominio de React te da ventaja en el desarrollo del frontend.",
        "blockchain": f"Tu conocimiento en Blockchain es clave para la arquitectura que pide este reto.",
        "ai": f"Tu background en AI/ML te posiciona perfectamente para la clasificación de datos.",
        "web3": f"Tu experiencia en Web3.js es esencial para el puente de tokens.",
        "solidity": f"Tu skill en Solidity te permite desplegar contratos seguros.",
        "default": f"Tu combinación de skills técnicos te da ventaja competitiva.",
    }
    
    reasoning = reasoning_templates.get(
        primary_match.lower(),
        reasoning_templates["default"]
    )
    
    return {
        "hackathon_id": hackathon_id,
        "hackathon_title": hackathon_title,
        "matching_skill": primary_match,
        "reasoning_phrase": reasoning,
        "potential_growth_score": growth_score,
        "match_score": match_score,
    }


async def get_personalized_recommendations(
    user_skills: List[str],
    hackathons: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Get personalized hackathon recommendations for a user based on their skills.
    
    Uses AI (Claude via OpenRouter) for intelligent matching, with fallback to
    statistical matching if AI is unavailable.
    
    Results are cached for 1 hour to avoid burning API tokens.
    
    Args:
        user_skills: List of user's skills (e.g., ["Python", "React", "Blockchain"])
        hackathons: List of hackathon dicts with at least 'id', 'title', 'tags' fields
        
    Returns:
        Dict with 'recommendations' list containing:
        - hackathon_id, hackathon_title
        - matching_skill, reasoning_phrase
        - potential_growth_score, match_score
    """
    if not user_skills or not hackathons:
        return {"recommendations": [], "generated_at": _get_timestamp(), "source": "empty"}
    
    hackathon_ids = [h.get("id", "") for h in hackathons]
    cache_key = _get_cache_key(user_skills, hackathon_ids)
    
    if cache_key in recommendations_cache:
        cached = recommendations_cache[cache_key]
        if time.time() - cached.get("_cached_at", 0) < RECOMMENDATIONS_CACHE_TTL:
            log.info(f"Returning cached recommendations for key: {cache_key[:8]}...")
            return cached
    
    if not OPENROUTER_API_KEY:
        log.warning("OPENROUTER_API_KEY not set, using statistical fallback")
        return _get_statistical_recommendations(user_skills, hackathons)
    
    hackathons_json = json.dumps([
        {
            "id": h.get("id", ""),
            "title": h.get("title", ""),
            "tags": h.get("tags", []),
            "prize_pool": h.get("prize_pool", 0),
            "match_score": h.get("match_score", 50),
        }
        for h in hackathons[:20]
    ], ensure_ascii=False)
    
    skills_json = json.dumps(user_skills, ensure_ascii=False)
    
    prompt = f"""Analiza las skills del usuario y los hackatones disponibles para generar recomendaciones personalizadas.

Skills del usuario:
{skills_json}

Hackatones disponibles:
{hackathons_json}

Identifica las 3 misiones con mayor afinidad técnica y genera la respuesta JSON."""

    try:
        raw_text = await _call_openrouter_with_system(prompt, SYSTEM_PROMPT_RECOMMENDATIONS)
        result = json.loads(raw_text.strip())
        
        if "recommendations" in result and isinstance(result["recommendations"], list):
            for rec in result["recommendations"]:
                rec["match_score"] = min(100, 50 + rec.get("potential_growth_score", 0) // 2)
            
            cached_result = {
                **result,
                "generated_at": _get_timestamp(),
                "source": "ai",
            }
            cached_result["_cached_at"] = time.time()
            recommendations_cache[cache_key] = cached_result
            
            return cached_result
        else:
            log.warning("Invalid AI recommendations format, using fallback")
            return _get_statistical_recommendations(user_skills, hackathons)
            
    except json.JSONDecodeError as exc:
        log.error(f"JSON decode error for recommendations: {exc}")
        return _get_statistical_recommendations(user_skills, hackathons)
    except Exception as exc:
        log.error(f"Error getting recommendations: {exc}")
        return _get_statistical_recommendations(user_skills, hackathons)


def _get_statistical_recommendations(
    user_skills: List[str],
    hackathons: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Generate recommendations using statistical matching (fallback)."""
    recommendations = []
    
    for hackathon in hackathons:
        tags = hackathon.get("tags", [])
        result = _calculate_match_and_growth(
            user_skills,
            tags,
            hackathon.get("id", ""),
            hackathon.get("title", ""),
        )
        if result:
            result["match_score"] = hackathon.get("match_score", result["match_score"])
            recommendations.append(result)
    
    recommendations.sort(key=lambda x: x["match_score"], reverse=True)
    top_3 = recommendations[:3]
    
    return {
        "recommendations": top_3,
        "generated_at": _get_timestamp(),
        "source": "statistical",
    }


async def _call_openrouter_with_system(prompt: str, system_prompt: str) -> str:
    """Call OpenRouter API with a custom system prompt."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://xiimalab.vercel.app",
        "X-Title": "Xiimalab Semantic Recommendations",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "max_tokens": MAX_TOKENS,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(MAX_RETRIES):
            try:
                resp = await client.post(OPENROUTER_BASE_URL, headers=headers, json=payload)
                if resp.status_code in (400, 401, 403):
                    raise RuntimeError(f"Non-retryable HTTP {resp.status_code}")
                if resp.status_code in {429, 500, 502, 503, 504}:
                    await asyncio.sleep(_backoff_delay(attempt))
                    continue
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            except (httpx.TimeoutException, httpx.RequestError):
                await asyncio.sleep(_backoff_delay(attempt))
                continue

    raise RuntimeError("OpenRouter failed after max retries")
