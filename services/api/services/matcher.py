"""
Intelligent Hackathon Matching Service — Phase 3
╭─────────────────────────────────────────────────────────╮
│ Multi-factor scoring for personalized recommendations   │
│ • Skill Overlap (40%)        — Jaccard similarity       │
│ • Urgency (20%)              — Days to deadline         │
│ • Prize Value (15%)          — Relative percentile      │
│ • Tech Stack (15%)           — Stack preference match   │
│ • Neuroplasticity (10%)      — User learning profile    │
│                                                         │
│ Target: 40% improvement vs baseline scoring             │
╰─────────────────────────────────────────────────────────╯
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

log = logging.getLogger("xiima.services.matcher")


@dataclass
class MatchingScores:
    """Container for detailed scoring metrics."""
    skill_overlap_score: float      # 0-100
    urgency_score: float            # 0-100  
    value_score: float              # 0-100
    tech_stack_score: float         # 0-100
    neuro_score: float              # 0-100
    
    # Weighted composite
    personalized_score: float       # 0-100
    
    # Reasoning for UI display
    reasoning: str                  # Human-readable explanation


class HackathonMatcher:
    """
    Intelligent multi-factor matcher for hackathons.
    
    **Weights (must sum to 1.0):**
    - Skill overlap:   40%
    - Urgency:         20%
    - Prize value:     15%
    - Tech stack:      15%
    - Neuroplasticity: 10%
    """
    
    # Weights configuration
    WEIGHTS = {
        "skill_overlap": 0.40,
        "urgency": 0.20,
        "value": 0.15,
        "tech_stack": 0.15,
        "neuro": 0.10,
    }
    
    def __init__(self):
        assert abs(sum(self.WEIGHTS.values()) - 1.0) < 0.001, "Weights must sum to 1.0"
    
    # ─────────────────────────────────────────────
    # Skill Overlap Scoring
    # ─────────────────────────────────────────────
    def compute_skill_overlap_score(
        self,
        user_skills: list[str],
        hackathon_tags: list[str],
    ) -> float:
        """
        Compute Jaccard similarity between user skills and hackathon tech requirements.
        
        Jaccard = |intersection| / |union|
        
        Returns:
            Score 0-100 with floor of 5 (no perfect rejection)
        """
        if not user_skills or not hackathon_tags:
            return 5.0  # Neutral score if no skills
        
        user_set = {s.lower().strip() for s in user_skills}
        hackathon_set = {t.lower().strip() for t in hackathon_tags}
        
        if not user_set or not hackathon_set:
            return 5.0
        
        intersection = len(user_set & hackathon_set)
        union = len(user_set | hackathon_set)
        
        jaccard = intersection / max(union, 1)
        # Scale to 0-100 with floor of 5
        score = max(5.0, jaccard * 100)
        
        log.debug(
            f"Skill overlap: {intersection}/{union} (Jaccard={jaccard:.2f}) → {score:.1f}"
        )
        return score
    
    # ─────────────────────────────────────────────
    # Urgency Scoring
    # ─────────────────────────────────────────────
    def compute_urgency_score(self, deadline_str: str) -> float:
        """
        Compute urgency score based on days until deadline.
        
        - 0-7 days:     100 (urgent)
        - 8-30 days:    80-100 (high)
        - 31-90 days:   50-80 (medium)
        - 90+ days:     5-50 (low)
        """
        try:
            deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            days_left = (deadline - now).days
            
            if days_left <= 0:
                return 0.0
            elif days_left <= 7:
                return 100.0
            elif days_left <= 30:
                # Linear interpolation: 30 days → 80, 8 days → 100
                progress = (days_left - 8) / 22
                return 80 + progress * 20
            elif days_left <= 90:
                # Linear: 90 days → 50, 31 days → 80
                progress = (days_left - 31) / 59
                return 50 + progress * 30
            else:
                # Asymptotic: 180 days → 27, 90+ → 5
                progress = min(1.0, (days_left - 90) / 90)
                return 5 + (1 - progress) * 22
        except Exception as e:
            log.warning(f"Error computing urgency: {e}")
            return 50.0
    
    # ─────────────────────────────────────────────
    # Prize Value Scoring
    # ─────────────────────────────────────────────
    def compute_value_score(
        self,
        prize_pool: int,
        median_prize: int = 50000,
    ) -> float:
        """
        Compute prize value score as percentile of prize pool.
        
        - $50K (median):  50 pts
        - $100K:          75 pts
        - $25K:           25 pts
        """
        if prize_pool == 0:
            return 10.0
        
        ratio = prize_pool / max(median_prize, 1)
        # Logarithmic scale: log_2(ratio)
        
        try:
            base_score = 50 + 25 * math.log(ratio, 2)
            return max(5.0, min(100.0, base_score))
        except (ValueError, ZeroDivisionError):
            return 50.0
    
    # ─────────────────────────────────────────────
    # Tech Stack Scoring
    # ─────────────────────────────────────────────
    def compute_tech_stack_score(
        self,
        user_preferred_stack: list[str],
        hackathon_tech_stack: list[str],
    ) -> float:
        """
        Score based on user's preferred tech stack vs hackathon stack.
        Different from skill_overlap: focuses on **tools/languages** not just tags.
        """
        if not user_preferred_stack or not hackathon_tech_stack:
            return 50.0  # Neutral if no preference
        
        user_stack = {s.lower().strip() for s in user_preferred_stack}
        hack_stack = {t.lower().strip() for t in hackathon_tech_stack}
        
        if not user_stack or not hack_stack:
            return 50.0
        
        intersection = len(user_stack & hack_stack)
        union = len(user_stack | hack_stack)
        
        jaccard = intersection / max(union, 1)
        score = max(5.0, jaccard * 100)
        
        log.debug(f"Tech stack match: {intersection}/{union} → {score:.1f}")
        return score
    
    # ─────────────────────────────────────────────
    # Neuroplasticity/Profile Scoring
    # ─────────────────────────────────────────────
    def compute_neuro_score(
        self,
        user_neuroplasticity: Optional[float] = None,
        hackathon_difficulty: Optional[str] = None,
    ) -> float:
        """
        Score based on user's learning capacity vs hackathon difficulty.
        
        neuroplasticity: 0.0-1.0 (learning capacity)
        difficulty: "beginner" | "intermediate" | "advanced" | None
        """
        if not hackathon_difficulty:
            return 50.0  # Neutral if no difficulty specified
        
        # Map difficulty to required neuroplasticity
        difficulty_map = {
            "beginner": 0.3,
            "intermediate": 0.6,
            "advanced": 0.9,
        }
        
        required = difficulty_map.get(hackathon_difficulty.lower(), 0.5)
        user_neuro = user_neuroplasticity or 0.5  # Default: average capacity
        
        # Score is higher when user capacity >= required difficulty
        # Gap penalty if user capacity < required difficulty
        gap = user_neuro - required
        
        if gap >= 0:
            # User is well-matched or over-qualified
            # Bonus for stretch goals (up to 20pts)
            bonus = min(20, gap * 100)
            return 80 + bonus
        else:
            # User is under-qualified
            # Penalty but still shows potential (floor 40)
            penalty = abs(gap) * 50
            return max(40, 80 - penalty)
    
    # ─────────────────────────────────────────────
    # Composite Scoring
    # ─────────────────────────────────────────────
    def compute_personalized_score(
        self,
        skill_overlap: float,
        urgency: float,
        value: float,
        tech_stack: float,
        neuro: float,
    ) -> float:
        """Weighted composite score."""
        weighted_score = (
            skill_overlap * self.WEIGHTS["skill_overlap"]
            + urgency * self.WEIGHTS["urgency"]
            + value * self.WEIGHTS["value"]
            + tech_stack * self.WEIGHTS["tech_stack"]
            + neuro * self.WEIGHTS["neuro"]
        )
        return max(0, min(100, weighted_score))
    
    # ─────────────────────────────────────────────
    # Full Matching Pipeline
    # ─────────────────────────────────────────────
    def match_hackathon(
        self,
        user_skills: list[str],
        user_tech_stack: list[str],
        user_neuroplasticity: Optional[float] = None,
        hackathon_tags: list[str] = None,
        hackathon_tech_stack: list[str] = None,
        hackathon_difficulty: Optional[str] = None,
        deadline_str: Optional[str] = None,
        prize_pool: int = 0,
    ) -> MatchingScores:
        """
        Full matching pipeline: compute all scores and return composite.
        """
        hackathon_tags = hackathon_tags or []
        hackathon_tech_stack = hackathon_tech_stack or []
        
        # Compute individual scores
        skill_score = self.compute_skill_overlap_score(user_skills, hackathon_tags)
        urgency_score = self.compute_urgency_score(deadline_str or "")
        value_score = self.compute_value_score(prize_pool)
        tech_score = self.compute_tech_stack_score(user_tech_stack, hackathon_tech_stack)
        neuro_score = self.compute_neuro_score(user_neuroplasticity, hackathon_difficulty)
        
        # Composite
        personalized = self.compute_personalized_score(
            skill_score, urgency_score, value_score, tech_score, neuro_score
        )
        
        # Build reasoning
        reasons = []
        if skill_score >= 70:
            reasons.append("Strong skill match")
        if urgency_score >= 80:
            reasons.append("Urgent deadline")
        if value_score >= 75:
            reasons.append("High-value prize")
        if tech_score >= 70:
            reasons.append("Great tech stack fit")
        
        reasoning = " • ".join(reasons) if reasons else "Good opportunity"
        
        return MatchingScores(
            skill_overlap_score=skill_score,
            urgency_score=urgency_score,
            value_score=value_score,
            tech_stack_score=tech_score,
            neuro_score=neuro_score,
            personalized_score=personalized,
            reasoning=reasoning,
        )


# Global instance
_matcher = HackathonMatcher()


def get_matcher() -> HackathonMatcher:
    """Get or create global matcher instance."""
    return _matcher
