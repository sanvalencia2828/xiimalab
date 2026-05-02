"""
services/api/schemas/analysis.py
─────────────────────────────────────────────────────────────────────────────
AI Analysis & Skill Extraction Schemas

Used by:
  - engine/agent_crew.py (HackathonScout, ProjectAnalyzer, MatchOracle)
  - services/api/routes/analyze.py (POST /analyze/hackathon)
  - services/api/routes/insights.py (GET /insights/*)
  - Frontend components (PriorityBoard, NeuroProfileDashboard)

Flow:
  Raw Hackathon → LLM Analysis → HackathonAnalysisResult → SkillMatchReport
─────────────────────────────────────────────────────────────────────────────
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────
# Skill Extraction
# ─────────────────────────────────────────────

class SkillExtraction(BaseModel):
    """Single skill extracted from hackathon analysis."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "skill_name": "Solana",
        "category": "Blockchain",
        "relevance_score": 0.95,
        "difficulty": "intermediate",
        "is_core_requirement": True
    }})

    skill_name: str                             # e.g., "Solana", "React", "Python"
    category: str                               # e.g., "Frontend", "Blockchain", "Backend", "DevOps", "ML", "Data Science"
    relevance_score: float = Field(
        ..., 
        ge=0.0, 
        le=1.0,
        description="How central/important is this skill (0.0=optional, 1.0=critical)"
    )
    difficulty: str = Field(
        default="intermediate",
        pattern="^(beginner|intermediate|advanced)$",
        description="Recommended proficiency level"
    )
    is_core_requirement: bool = False           # True if essential for winning


class SkillRequirement(BaseModel):
    """Specific skill requirement with context."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "skill": "Rust",
        "proficiency_level": "intermediate",
        "years_of_experience": 2,
        "why_important": "Solana programs are written in Rust; core language for this hackathon"
    }})

    skill: str                                  # e.g., "Rust"
    proficiency_level: str = Field(
        default="intermediate",
        pattern="^(beginner|intermediate|advanced)$",
        description="Expected proficiency level"
    )
    years_of_experience: int = Field(
        default=1,
        ge=0,
        description="Suggested minimum years of experience"
    )
    why_important: str                          # Reason this skill matters for the hackathon


# ─────────────────────────────────────────────
# Project Ideas
# ─────────────────────────────────────────────

class ProjectIdea(BaseModel):
    """Project idea generated from hackathon analysis."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "title": "Solana NFT Marketplace",
        "description": "Build a peer-to-peer marketplace for NFTs using Solana's fast, low-cost network",
        "skills_covered": ["Solana", "Rust", "TypeScript", "React"],
        "estimated_hours": 40,
        "difficulty": "intermediate",
        "learning_outcomes": ["Understand Solana Program Library", "Deploy on devnet", "Build Web3 UX"],
        "revenue_potential": "high"
    }})

    title: str                                  # Project name
    description: str                            # Detailed description
    skills_covered: list[str]                   # Skills this project teaches/uses
    estimated_hours: int = Field(
        default=40,
        ge=4,
        le=200,
        description="Estimated time to build in hours"
    )
    difficulty: str = Field(
        default="intermediate",
        pattern="^(beginner|intermediate|advanced)$",
        description="Project difficulty level"
    )
    learning_outcomes: list[str] = Field(
        default_factory=list,
        description="What student will learn by completing this project"
    )
    revenue_potential: Optional[str] = Field(
        default=None,
        pattern="^(low|medium|high)$",
        description="For Web3 projects: earning potential"
    )


# ─────────────────────────────────────────────
# Complete Hackathon Analysis
# ─────────────────────────────────────────────

class HackathonAnalysisResult(BaseModel):
    """Complete AI analysis result for a single hackathon."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "hackathon_id": "abc123def456",
        "title": "Solana Riptide Hackathon",
        "skills_required": [
            {
                "skill_name": "Solana",
                "category": "Blockchain",
                "relevance_score": 0.95,
                "difficulty": "intermediate",
                "is_core_requirement": True
            }
        ],
        "core_tech_stack": ["Solana", "Rust", "TypeScript", "React"],
        "difficulty_level": "intermediate",
        "project_ideas": [],
        "best_for": "Full-stack developers and blockchain engineers with Web3 experience",
        "estimated_preparation_hours": 15,
        "estimated_hackathon_hours": 40,
        "recommended_team_size": 2,
        "success_rate_estimate": "high"
    }})

    hackathon_id: str                           # Reference to hackathon ID
    title: str                                  # Hackathon title (for context)
    
    # Extracted requirements
    skills_required: list[SkillExtraction]      # All skills mentioned/inferred
    core_tech_stack: list[str]                  # Primary technologies (["Solana", "React"])
    difficulty_level: str = Field(
        default="intermediate",
        pattern="^(beginner|intermediate|advanced)$",
        description="Overall difficulty assessment"
    )
    
    # Recommended projects
    project_ideas: list[ProjectIdea] = Field(
        default_factory=list,
        description="2-5 project ideas to build during hackathon"
    )
    best_for: str                               # "Who should apply? e.g., 'Backend engineers with Rust experience'"
    
    # Timeline & effort
    estimated_preparation_hours: int = Field(
        default=10,
        ge=0,
        le=500,
        description="Prep time before applying"
    )
    estimated_hackathon_hours: int = Field(
        default=40,
        ge=4,
        le=200,
        description="Time needed during hackathon"
    )
    
    # Team & risk
    recommended_team_size: int = Field(
        default=1,
        ge=1,
        le=10,
        description="1 for solo, 2-3 for small team, etc."
    )
    success_rate_estimate: str = Field(
        default="medium",
        pattern="^(low|medium|high)$",
        description="Estimated likelihood of winning/success"
    )
    
    # Meta
    analysis_timestamp: datetime = Field(
        default_factory=datetime.now,
        description="When this analysis was created"
    )
    model_used: str = Field(
        default="claude-3.5-sonnet",
        description="LLM model version used for analysis"
    )


# ─────────────────────────────────────────────
# User Skill Match Report
# ─────────────────────────────────────────────

class SkillMatchReport(BaseModel):
    """User skill match assessment against a specific hackathon."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "hackathon_id": "abc123def456",
        "wallet_address": "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "user_skills": ["Python", "JavaScript", "React"],
        "required_skills": ["Solana", "Rust", "TypeScript", "React"],
        "skill_overlap": ["React"],
        "skill_gaps": ["Solana", "Rust", "TypeScript"],
        "skill_match_percentage": 25.0,
        "learning_feasibility_score": 0.7,
        "overall_readiness": "prepare",
        "recommended_prep_path": ["Learn Solana basics", "Practice Rust fundamentals", "Study Anchor framework"],
        "time_to_readiness_hours": 40
    }})

    hackathon_id: str                           # Reference to hackathon
    wallet_address: str                         # User's wallet address
    
    # Skills analysis
    user_skills: list[str]                      # Skills user has verified
    required_skills: list[str]                  # Skills hackathon requires
    skill_overlap: list[str]                    # Intersection (what user already has)
    skill_gaps: list[str]                       # What user needs to learn
    
    # Scoring
    skill_match_percentage: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="% of required skills user has (0-100)"
    )
    learning_feasibility_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Can user learn missing skills in time? (0=impossible, 1=easy)"
    )
    overall_readiness: str = Field(
        ...,
        pattern="^(ready|prepare|not_ready)$",
        description="Overall recommendation"
    )
    
    # Recommendations
    recommended_prep_path: list[str] = Field(
        default_factory=list,
        description="Specific learning steps (e.g., 'Learn Solana basics', 'Practice Rust')"
    )
    time_to_readiness_hours: int = Field(
        default=0,
        ge=0,
        le=500,
        description="Hours of study needed to be ready"
    )


# ─────────────────────────────────────────────
# Batch Analysis Request/Response
# ─────────────────────────────────────────────

class AnalyzeHackathonRequest(BaseModel):
    """Request to analyze a single hackathon."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "abc123def456",
        "title": "Solana Riptide Hackathon",
        "tags": ["web3", "blockchain", "solana"],
        "prize_pool": 250000,
        "description": "Build the next killer dApp on Solana"
    }})

    id: str                                     # Hackathon ID
    title: str                                  # Hackathon title
    tags: list[str]                             # Tags/keywords from scraper
    prize_pool: int                             # Prize pool in USD
    description: Optional[str] = None           # Full description (for LLM context)


class AnalyzeHackathonResponse(BaseModel):
    """Response from hackathon analysis."""
    hackathon_id: str
    analysis: HackathonAnalysisResult
    status: str = "success"                     # "success" or "failed"
    error: Optional[str] = None                 # Error message if failed


class BatchAnalysisRequest(BaseModel):
    """Request to analyze multiple hackathons."""
    hackathons: list[AnalyzeHackathonRequest]


class BatchAnalysisResponse(BaseModel):
    """Response from batch analysis."""
    total: int
    succeeded: int
    failed: int
    results: list[AnalyzeHackathonResponse]
