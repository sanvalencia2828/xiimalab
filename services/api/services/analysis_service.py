"""
services/api/services/analysis_service.py
─────────────────────────────────────────────────────────────────────────────
Business logic layer for hackathon AI analysis.

Responsabilidades:
  1. Fetch raw hackathon data from DB
  2. Call Claude 3.5 Sonnet via ai_engine
  3. Transform response → HackathonAnalysisResult (with SkillExtraction, ProjectIdea)
  4. Handle validation errors gracefully
  5. Persist result to DB

Used by: routes/analyze.py
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_engine import analyze_competitiveness
from models import Hackathon
from schemas.analysis import (
    AnalyzeHackathonRequest,
    AnalyzeHackathonResponse,
    HackathonAnalysisResult,
    ProjectIdea,
    SkillExtraction,
)

log = logging.getLogger("xiima.services.analysis")


# ─────────────────────────────────────────────
# Schema Transformation Functions
# ─────────────────────────────────────────────

def _parse_skills_from_response(raw_response: dict) -> list[SkillExtraction]:
    """
    Transform Claude's response into validated SkillExtraction objects.
    
    Claude typically returns:
        {
            "skills": [
                {"name": "Solana", "category": "Blockchain", "relevance": 0.95, ...},
                {"name": "Rust", "category": "Backend", "relevance": 0.85, ...}
            ]
        }
    """
    extracted = []
    
    try:
        skills_raw = raw_response.get("skills_required", [])
        if not isinstance(skills_raw, list):
            log.warning(f"Expected list of skills, got {type(skills_raw)}")
            return extracted
        
        for skill_dict in skills_raw:
            try:
                skill = SkillExtraction(
                    skill_name=skill_dict.get("name") or skill_dict.get("skill_name", "Unknown"),
                    category=skill_dict.get("category", "Other"),
                    relevance_score=float(skill_dict.get("relevance", skill_dict.get("relevance_score", 0.5))),
                    difficulty=skill_dict.get("difficulty", "intermediate"),
                    is_core_requirement=bool(skill_dict.get("is_core", skill_dict.get("is_core_requirement", False)))
                )
                extracted.append(skill)
            except ValidationError as e:
                log.warning(f"Failed to parse skill {skill_dict}: {e}")
                continue
        
        log.info(f"✅ Parsed {len(extracted)} skills from Claude response")
        return extracted
    
    except Exception as e:
        log.error(f"❌ Error parsing skills: {e}")
        return extracted


def _parse_project_ideas_from_response(raw_response: dict) -> list[ProjectIdea]:
    """
    Transform Claude's project ideas into validated ProjectIdea objects.
    """
    ideas = []
    
    try:
        ideas_raw = raw_response.get("project_ideas", [])
        if not isinstance(ideas_raw, list):
            log.warning(f"Expected list of project ideas, got {type(ideas_raw)}")
            return ideas
        
        for idea_dict in ideas_raw:
            try:
                idea = ProjectIdea(
                    title=idea_dict.get("title", "Untitled Project"),
                    description=idea_dict.get("description", ""),
                    skills_covered=idea_dict.get("skills_covered", []),
                    estimated_hours=int(idea_dict.get("estimated_hours", 40)),
                    difficulty=idea_dict.get("difficulty", "intermediate"),
                    learning_outcomes=idea_dict.get("learning_outcomes", []),
                    revenue_potential=idea_dict.get("revenue_potential")
                )
                ideas.append(idea)
            except ValidationError as e:
                log.warning(f"Failed to parse project idea {idea_dict}: {e}")
                continue
        
        log.info(f"✅ Parsed {len(ideas)} project ideas from Claude response")
        return ideas
    
    except Exception as e:
        log.error(f"❌ Error parsing project ideas: {e}")
        return ideas


def _transform_claude_response_to_analysis(
    hackathon_request: AnalyzeHackathonRequest,
    claude_response: dict[str, Any]
) -> HackathonAnalysisResult:
    """
    Transform Claude's raw JSON response into a validated HackathonAnalysisResult.
    
    Claude returns something like:
        {
            "skills_required": [...],
            "core_tech_stack": ["Solana", "Rust", "TypeScript"],
            "difficulty_level": "intermediate",
            "project_ideas": [...],
            "best_for": "...",
            "estimated_prep_hours": 10,
            "estimated_hackathon_hours": 40,
            "recommended_team_size": 2,
            "success_rate": "high"
        }
    """
    
    log.info(f"🔄 Transforming Claude response for {hackathon_request.title}")
    
    try:
        # Parse skills
        skills_required = _parse_skills_from_response(claude_response)
        
        # Parse project ideas
        project_ideas = _parse_project_ideas_from_response(claude_response)
        
        # Create validated result
        result = HackathonAnalysisResult(
            hackathon_id=hackathon_request.id,
            title=hackathon_request.title,
            
            # Skills
            skills_required=skills_required,
            core_tech_stack=claude_response.get("core_tech_stack", hackathon_request.tags[:3]),
            difficulty_level=claude_response.get("difficulty_level", "intermediate"),
            
            # Projects & recommendations
            project_ideas=project_ideas,
            best_for=claude_response.get("best_for", "Developers interested in this technology"),
            
            # Effort estimation
            estimated_preparation_hours=int(claude_response.get("estimated_prep_hours", 10)),
            estimated_hackathon_hours=int(claude_response.get("estimated_hackathon_hours", 40)),
            
            # Team & success
            recommended_team_size=int(claude_response.get("recommended_team_size", 1)),
            success_rate_estimate=claude_response.get("success_rate_estimate", "medium"),
            
            # Meta
            model_used="claude-3.5-sonnet",
        )
        
        log.info(f"✅ Transformed analysis: {len(skills_required)} skills, {len(project_ideas)} projects")
        return result
    
    except ValidationError as e:
        log.error(f"❌ Validation error transforming response: {e}")
        # Return minimal valid result on validation error
        return HackathonAnalysisResult(
            hackathon_id=hackathon_request.id,
            title=hackathon_request.title,
            skills_required=[],
            core_tech_stack=hackathon_request.tags[:3],
            difficulty_level="intermediate",
            project_ideas=[],
            best_for="Developers interested in this technology",
            success_rate_estimate="unknown"
        )


# ─────────────────────────────────────────────
# Main Analysis Service
# ─────────────────────────────────────────────

async def analyze_hackathon_with_validation(
    request: AnalyzeHackathonRequest,
    db: AsyncSession,
    force_refresh: bool = False
) -> tuple[HackathonAnalysisResult, bool]:
    """
    Comprehensive hackathon analysis with caching.
    
    Args:
        request: AnalyzeHackathonRequest (validated)
        db: AsyncSession for DB access
        force_refresh: Bypass cache and re-analyze
    
    Returns:
        Tuple of (HackathonAnalysisResult, was_cached: bool)
    
    Raises:
        ValueError: If request is invalid
    """
    
    log.info(f"🔍 Analyzing hackathon: {request.title} (ID: {request.id})")
    
    # Check if hackathon exists in DB
    existing_hackathon = await db.get(Hackathon, request.id)
    
    # Return cached result if available
    if existing_hackathon and existing_hackathon.ai_analysis and not force_refresh:
        log.info(f"📦 Cache hit for {request.id} — using existing analysis")
        
        try:
            # Try to deserialize from JSON
            cached_dict = existing_hackathon.ai_analysis
            
            # Rebuild HackathonAnalysisResult from stored JSON
            analysis = HackathonAnalysisResult(
                hackathon_id=request.id,
                title=request.title,
                skills_required=_parse_skills_from_response(cached_dict),
                core_tech_stack=cached_dict.get("core_tech_stack", request.tags[:3]),
                difficulty_level=cached_dict.get("difficulty_level", "intermediate"),
                project_ideas=_parse_project_ideas_from_response(cached_dict),
                best_for=cached_dict.get("best_for", ""),
                estimated_preparation_hours=cached_dict.get("estimated_preparation_hours", 10),
                estimated_hackathon_hours=cached_dict.get("estimated_hackathon_hours", 40),
                recommended_team_size=cached_dict.get("recommended_team_size", 1),
                success_rate_estimate=cached_dict.get("success_rate_estimate", "medium"),
                model_used=cached_dict.get("model_used", "claude-3.5-sonnet")
            )
            return analysis, True
        
        except ValidationError as e:
            log.warning(f"Failed to deserialize cached analysis: {e} — will re-analyze")
            force_refresh = True
    
    # Call Claude for new analysis
    log.info(f"🧠 Calling Claude 3.5 for new analysis...")
    
    opportunity = {
        "title": request.title,
        "tags": request.tags,
        "prize_pool_usd": request.prize_pool,
        "description": request.description or "",
    }
    
    try:
        claude_response = await analyze_competitiveness(opportunity)
        log.info(f"✅ Claude responded with analysis")
    except Exception as e:
        log.error(f"❌ Claude analysis failed: {e}")
        raise ValueError(f"Failed to analyze hackathon: {e}")
    
    # Transform response
    analysis = _transform_claude_response_to_analysis(request, claude_response)
    
    # Persist to DB
    if existing_hackathon:
        log.info(f"💾 Updating existing hackathon record in DB")
        existing_hackathon.ai_analysis = analysis.model_dump()
        db.add(existing_hackathon)
    else:
        log.info(f"💾 Creating new hackathon record in DB")
        new_hackathon = Hackathon(
            id=request.id,
            title=request.title,
            prize_pool=request.prize_pool,
            tags=[],  # Will be populated by scraper
            deadline="2099-12-31",  # Placeholder
            match_score=0,
            source_url="",
            source="manual",
            ai_analysis=analysis.model_dump()
        )
        db.add(new_hackathon)
    
    await db.commit()
    log.info(f"✅ Analysis persisted to DB")
    
    return analysis, False


async def get_cached_analysis(
    hackathon_id: str,
    db: AsyncSession
) -> Optional[HackathonAnalysisResult]:
    """
    Retrieve cached analysis for a hackathon.
    
    Returns None if not found or invalid.
    """
    hackathon = await db.get(Hackathon, hackathon_id)
    
    if not hackathon:
        log.warning(f"Hackathon {hackathon_id} not found in DB")
        return None
    
    if not hackathon.ai_analysis:
        log.warning(f"No cached analysis for hackathon {hackathon_id}")
        return None
    
    try:
        # Rebuild from stored JSON
        analysis = HackathonAnalysisResult(
            hackathon_id=hackathon_id,
            title=hackathon.title,
            skills_required=_parse_skills_from_response(hackathon.ai_analysis),
            core_tech_stack=hackathon.ai_analysis.get("core_tech_stack", []),
            difficulty_level=hackathon.ai_analysis.get("difficulty_level", "intermediate"),
            project_ideas=_parse_project_ideas_from_response(hackathon.ai_analysis),
            best_for=hackathon.ai_analysis.get("best_for", ""),
            estimated_preparation_hours=hackathon.ai_analysis.get("estimated_preparation_hours", 10),
            estimated_hackathon_hours=hackathon.ai_analysis.get("estimated_hackathon_hours", 40),
            recommended_team_size=hackathon.ai_analysis.get("recommended_team_size", 1),
            success_rate_estimate=hackathon.ai_analysis.get("success_rate_estimate", "medium"),
            model_used=hackathon.ai_analysis.get("model_used", "claude-3.5-sonnet")
        )
        return analysis
    
    except ValidationError as e:
        log.error(f"Failed to deserialize cached analysis for {hackathon_id}: {e}")
        return None
