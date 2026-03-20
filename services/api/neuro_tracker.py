"""
NeuroPsychological Skill Tracker — Xiimalab
============================================
Sistema de tracking que combina:
- Scraping de hackathons
- Análisis de demanda de skills
- Tracking de progreso cognitivo por categoría

Principios neuropsicológicos aplicados:
- Working Memory: carga cognitiva por skill
- Plasticidad: velocidad de aprendizaje estimada
- Atención sostenida: tiempo de práctica recomendado
- Transferencia: relación entre skills

Categorías cognitivas:
- MEMORY: retención y manipulación de información
- ATTENTION: enfoque selectivo y sostenida
- EXECUTIVE: planificación y toma de decisiones
- LANGUAGE: comprensión y producción verbal
- VISUOSPATIAL: procesamiento espacial
- MOTOR: coordinación y velocidad motora
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
import json

log = logging.getLogger("xiima.neuro_tracker")


class CognitiveCategory(Enum):
    MEMORY = "memory"
    ATTENTION = "attention"
    EXECUTIVE = "executive"
    LANGUAGE = "language"
    VISUOSPATIAL = "visuospatial"
    MOTOR = "motor"
    METACOGNITION = "metacognition"


class SkillType(Enum):
    TECHNICAL = "technical"
    CREATIVE = "creative"
    ANALYTICAL = "analytical"
    SOCIAL = "social"
    PRACTICAL = "practical"


@dataclass
class SkillMetrics:
    """Métricas neuropsicológicas de una skill."""
    skill_name: str
    category: CognitiveCategory
    
    # Demanda del mercado (del scraping)
    market_demand: float = 0.0
    avg_prize_pool: int = 0
    opportunity_count: int = 0
    
    # Perfil cognitivo requerido
    cognitive_load: float = 0.5  # 0-1, carga de working memory
    plasticity_index: float = 0.5  # 0-1, qué tan rápido se aprende
    attention_demand: float = 0.5  # 0-1
    transfer_potential: float = 0.5  # 0-1, transferencia a otras skills
    
    # Progresso do usuário
    practice_hours: float = 0.0
    mastery_level: float = 0.0  # 0-100
    last_practiced: Optional[datetime] = None
    streak_days: int = 0
    
    # Recomendações
    recommended_daily_minutes: int = 30
    optimal_session_length: int = 25  # Pomodoro-style
    rest_interval_minutes: int = 5


@dataclass
class NeuroLearningPath:
    """Caminho de aprendizaje personalizado baseado em perfil neuropsicológico."""
    user_id: str
    target_skills: list[str]
    
    # Ordem otimizada de aprendizado
    optimized_sequence: list[dict] = field(default_factory=list)
    
    # Déficits cognitivos identificados
    cognitive_gaps: list[CognitiveCategory] = field(default_factory=list)
    
    # Recomendações diarias
    daily_focus: Optional[str] = None
    daily_minutes: int = 90
    
    # Previsão de tempo para mastery
    estimated_weeks_to_mastery: dict[str, int] = field(default_factory=dict)
    
    # Hackathons recomendados para práctica
    recommended_hackathons: list[str] = field(default_factory=list)


@dataclass
class UserNeuroProfile:
    """Perfil neuropsicológico del usuario."""
    wallet_address: str
    
    # Habilidades actuales con métricas
    skills: dict[str, SkillMetrics] = field(default_factory=dict)
    
    # Perfil cognitivo dominante
    dominant_category: CognitiveCategory = CognitiveCategory.EXECUTIVE
    cognitive_strengths: list[CognitiveCategory] = field(default_factory=list)
    cognitive_weaknesses: list[CognitiveCategory] = field(default_factory=list)
    
    # Preferencia de aprendizaje
    learning_style: str = "visual"  # visual, auditory, kinesthetic
    optimal_time_of_day: str = "morning"  # morning, afternoon, evening
    
    # Histórico
    total_hours_learned: float = 0.0
    hackathons_participated: int = 0
    projects_completed: int = 0
    
    # Scores compostos
    neuroplasticity_score: float = 0.0
    learning_efficiency: float = 0.0
    

# ─────────────────────────────────────────────
# MAPA DE RELACIONES COGNITIVO-TÉCNICAS
# ─────────────────────────────────────────────
SKILL_COGNITIVE_MAP: dict[str, dict] = {
    # Technical Skills
    "python": {
        "category": CognitiveCategory.EXECUTIVE,
        "cognitive_load": 0.6,
        "plasticity_index": 0.7,
        "attention_demand": 0.5,
        "transfer_potential": 0.8,
        "related_cognitive": [CognitiveCategory.MEMORY, CognitiveCategory.METACOGNITION],
    },
    "javascript": {
        "category": CognitiveCategory.EXECUTIVE,
        "cognitive_load": 0.7,
        "plasticity_index": 0.8,
        "attention_demand": 0.6,
        "transfer_potential": 0.9,
        "related_cognitive": [CognitiveCategory.VISUOSPATIAL, CognitiveCategory.MOTOR],
    },
    "ai": {
        "category": CognitiveCategory.EXECUTIVE,
        "cognitive_load": 0.9,
        "plasticity_index": 0.5,
        "attention_demand": 0.8,
        "transfer_potential": 0.7,
        "related_cognitive": [CognitiveCategory.MEMORY, CognitiveCategory.METACOGNITION],
    },
    "ml": {
        "category": CognitiveCategory.METACOGNITION,
        "cognitive_load": 0.85,
        "plasticity_index": 0.45,
        "attention_demand": 0.85,
        "transfer_potential": 0.75,
        "related_cognitive": [CognitiveCategory.MEMORY, CognitiveCategory.EXECUTIVE],
    },
    "blockchain": {
        "category": CognitiveCategory.EXECUTIVE,
        "cognitive_load": 0.75,
        "plasticity_index": 0.5,
        "attention_demand": 0.7,
        "transfer_potential": 0.6,
        "related_cognitive": [CognitiveCategory.MEMORY, CognitiveCategory.LANGUAGE],
    },
    "docker": {
        "category": CognitiveCategory.EXECUTIVE,
        "cognitive_load": 0.5,
        "plasticity_index": 0.8,
        "attention_demand": 0.4,
        "transfer_potential": 0.7,
        "related_cognitive": [CognitiveCategory.MOTOR],
    },
    "web3": {
        "category": CognitiveCategory.EXECUTIVE,
        "cognitive_load": 0.7,
        "plasticity_index": 0.5,
        "attention_demand": 0.65,
        "transfer_potential": 0.65,
        "related_cognitive": [CognitiveCategory.MEMORY, CognitiveCategory.LANGUAGE],
    },
    "defi": {
        "category": CognitiveCategory.METACOGNITION,
        "cognitive_load": 0.8,
        "plasticity_index": 0.4,
        "attention_demand": 0.8,
        "transfer_potential": 0.5,
        "related_cognitive": [CognitiveCategory.EXECUTIVE, CognitiveCategory.MEMORY],
    },
    "data": {
        "category": CognitiveCategory.METACOGNITION,
        "cognitive_load": 0.65,
        "plasticity_index": 0.7,
        "attention_demand": 0.55,
        "transfer_potential": 0.85,
        "related_cognitive": [CognitiveCategory.MEMORY, CognitiveCategory.EXECUTIVE],
    },
    "smart contracts": {
        "category": CognitiveCategory.EXECUTIVE,
        "cognitive_load": 0.8,
        "plasticity_index": 0.4,
        "attention_demand": 0.85,
        "transfer_potential": 0.55,
        "related_cognitive": [CognitiveCategory.MEMORY, CognitiveCategory.LANGUAGE],
    },
    "fastapi": {
        "category": CognitiveCategory.EXECUTIVE,
        "cognitive_load": 0.55,
        "plasticity_index": 0.8,
        "attention_demand": 0.5,
        "transfer_potential": 0.75,
        "related_cognitive": [CognitiveCategory.EXECUTIVE],
    },
    "react": {
        "category": CognitiveCategory.VISUOSPATIAL,
        "cognitive_load": 0.6,
        "plasticity_index": 0.75,
        "attention_demand": 0.55,
        "transfer_potential": 0.8,
        "related_cognitive": [CognitiveCategory.EXECUTIVE, CognitiveCategory.MOTOR],
    },
    "rust": {
        "category": CognitiveCategory.EXECUTIVE,
        "cognitive_load": 0.9,
        "plasticity_index": 0.3,
        "attention_demand": 0.9,
        "transfer_potential": 0.6,
        "related_cognitive": [CognitiveCategory.MEMORY],
    },
}


# ─────────────────────────────────────────────
# ENGINE DE ANÁLISIS
# ─────────────────────────────────────────────
class NeuroSkillEngine:
    """
    Motor de análisis neuropsicológico para desarrollo de skills.
    
    Usa datos de mercado (hackathons) para:
    1. Calcular demanda de skills
    2. Generar paths de aprendizaje personalizados
    3. Predecir tiempos de mastery
    4. Recomendar práctica óptima
    """
    
    def __init__(self):
        self.skill_profiles: dict[str, SkillMetrics] = {}
        self._initialize_skill_profiles()
    
    def _initialize_skill_profiles(self):
        """Inicializa perfiles cognitivos para todas las skills conocidas."""
        for skill_name, cognitive_data in SKILL_COGNITIVE_MAP.items():
            self.skill_profiles[skill_name] = SkillMetrics(
                skill_name=skill_name,
                category=cognitive_data["category"],
                cognitive_load=cognitive_data["cognitive_load"],
                plasticity_index=cognitive_data["plasticity_index"],
                attention_demand=cognitive_data["attention_demand"],
                transfer_potential=cognitive_data["transfer_potential"],
            )
    
    def analyze_market_data(self, hackathons: list[dict]) -> dict[str, dict]:
        """
        Analiza datos de hackathons para calcular demanda de mercado por skill.
        
        Args:
            hackathons: Lista de hackathons con tags
            
        Returns:
            Dict con métricas de mercado por skill
        """
        skill_stats: dict[str, dict] = {}
        
        for hackathon in hackathons:
            tags = hackathon.get("tags", [])
            prize = hackathon.get("prize_pool", 0)
            
            for tag in tags:
                tag_lower = tag.lower().strip()
                
                if tag_lower not in skill_stats:
                    skill_stats[tag_lower] = {
                        "count": 0,
                        "total_prize": 0,
                        "hackathons": [],
                    }
                
                skill_stats[tag_lower]["count"] += 1
                skill_stats[tag_lower]["total_prize"] += prize
                skill_stats[tag_lower]["hackathons"].append(hackathon.get("id"))
        
        # Calcular demandas relativas
        max_count = max(s["count"] for s in skill_stats.values()) if skill_stats else 1
        
        for skill, stats in skill_stats.items():
            stats["market_demand"] = round(stats["count"] / max_count * 100, 2)
            stats["avg_prize"] = stats["total_prize"] // stats["count"] if stats["count"] else 0
            stats["opportunity_count"] = stats["count"]
        
        return skill_stats
    
    def generate_learning_path(
        self,
        user_profile: UserNeuroProfile,
        target_skills: list[str],
        market_data: dict[str, dict],
        available_time_daily: int = 90
    ) -> NeuroLearningPath:
        """
        Genera un camino de aprendizaje optimizado para el usuario.
        
        Args:
            user_profile: Perfil neuropsicológico del usuario
            target_skills: Skills que quiere desarrollar
            market_data: Datos de demanda de mercado
            available_time_daily: Minutos diarios disponibles
            
        Returns:
            NeuroLearningPath otimizado
        """
        path = NeuroLearningPath(
            user_id=user_profile.wallet_address,
            target_skills=target_skills,
            daily_minutes=available_time_daily,
        )
        
        # Calcular score composto para cada skill
        skill_scores = []
        for skill in target_skills:
            skill_lower = skill.lower()
            
            # Base profile
            base_profile = self.skill_profiles.get(skill_lower, SkillMetrics(
                skill_name=skill,
                category=CognitiveCategory.EXECUTIVE,
            ))
            
            # Dados de mercado
            market_info = market_data.get(skill_lower, {})
            
            # Calcular compatibilidad con el usuario
            user_category = user_profile.dominant_category
            category_match = 1.0 if base_profile.category == user_category else 0.6
            
            # Calcular score de prioridad
            priority_score = (
                (market_info.get("market_demand", 50) * 0.4) +
                (category_match * 100 * 0.3) +
                (base_profile.plasticity_index * 100 * 0.2) +
                (base_profile.transfer_potential * 100 * 0.1)
            )
            
            # Estimar semanas para mastery
            base_weeks = 12  # Promedio
            plasticity_factor = base_profile.plasticity_index
            weekly_hours = (available_time_daily * 7) / 60
            weeks_to_mastery = int(base_weeks / plasticity_factor / weekly_hours * 4)
            
            skill_scores.append({
                "skill": skill,
                "priority_score": round(priority_score, 2),
                "market_demand": market_info.get("market_demand", 0),
                "weeks_to_mastery": max(2, weeks_to_mastery),
                "cognitive_load": base_profile.cognitive_load,
                "plasticity_index": base_profile.plasticity_index,
                "daily_minutes": self._calculate_daily_minutes(
                    base_profile,
                    available_time_daily
                ),
            })
        
        # Ordenar por priority score
        skill_scores.sort(key=lambda x: x["priority_score"], reverse=True)
        
        # Crear secuencia otimizada
        path.optimized_sequence = skill_scores
        
        # Estimar tiempos totales
        for skill_data in skill_scores:
            path.estimated_weeks_to_mastery[skill_data["skill"]] = skill_data["weeks_to_mastery"]
        
        # Identificar gaps cognitivos
        path.cognitive_gaps = self._identify_cognitive_gaps(skill_scores)
        
        # Definir focus diario
        if skill_scores:
            path.daily_focus = skill_scores[0]["skill"]
        
        return path
    
    def _calculate_daily_minutes(
        self,
        skill: SkillMetrics,
        total_available: int
    ) -> int:
        """Calcula minutos diarios recomendados baseado no perfil cognitivo."""
        # Skills con alta carga cognitiva = sesiones mais curtas
        if skill.cognitive_load > 0.7:
            return min(45, total_available // 3)
        # Skills con baixa carga = mais tiempo
        elif skill.cognitive_load < 0.4:
            return min(60, total_available // 2)
        # Padrón
        return total_available // 3
    
    def _identify_cognitive_gaps(
        self,
        skill_sequence: list[dict]
    ) -> list[CognitiveCategory]:
        """Identifica qué categorias cognitivas necesitan desarrollo."""
        categories_needed = []
        
        for skill_data in skill_sequence[:3]:  # Top 3
            skill_name = skill_data["skill"].lower()
            if skill_name in SKILL_COGNITIVE_MAP:
                cat = SKILL_COGNITIVE_MAP[skill_name]["category"]
                if cat not in categories_needed:
                    categories_needed.append(cat)
        
        return categories_needed
    
    def calculate_neuroplasticity(
        self,
        user_profile: UserNeuroProfile,
        market_data: dict[str, dict]
    ) -> float:
        """
        Calcula el índice de neuroplasticidad do usuário.
        
        Baseado em:
        - Velocidade de aprendizado (plasticity das skills)
        - Diversidade de categorias cognitivas
        - Constância de práctica
        """
        if not user_profile.skills:
            return 0.5  # Valor padrão
        
        total_plasticity = 0
        for skill_name in user_profile.skills:
            if skill_name in self.skill_profiles:
                total_plasticity += self.skill_profiles[skill_name].plasticity_index
        
        avg_plasticity = total_plasticity / len(user_profile.skills)
        
        # Bônus por diversidad cognitiva
        categories = set()
        for skill_name in user_profile.skills:
            if skill_name in SKILL_COGNITIVE_MAP:
                categories.add(SKILL_COGNITIVE_MAP[skill_name]["category"])
        diversity_bonus = min(len(categories) / 6, 1.0) * 0.2
        
        # Bônus por práctica regular
        streak_bonus = min(user_profile.skills[list(user_profile.skills.keys())[0]].streak_days / 30, 1.0) * 0.2
        
        return round(avg_plasticity * 0.6 + diversity_bonus + streak_bonus, 2)


# ─────────────────────────────────────────────
# GLOBALS
# ─────────────────────────────────────────────
_engine = NeuroSkillEngine()


def get_neuro_engine() -> NeuroSkillEngine:
    """Retorna la instância global del motor."""
    return _engine
