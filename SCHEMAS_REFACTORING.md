# 📐 Schemas Architecture Refactoring

## Overview

La estructura de esquemas Pydantic ha sido refactorizada de un único archivo `schemas.py` a un **módulo modular** que organiza esquemas por dominio de negocio.

```
services/api/
  schemas/          ← Nuevo módulo modular
    __init__.py     → Importaciones centralizadas
    analysis.py     → AI analysis & skill extraction
    hackathon.py    → Hackathon responses & scoring
    skill.py        → Skill demand & user profiles
    milestone.py    → Educational escrow milestones
  schemas.py        → DEPRECATED (mantiene compatibilidad temporalmente)
```

---

## New Modular Structure

### 1. **analysis.py** — AI Analysis & Skill Extraction
**Responsables:** `engine/agent_crew.py`, `services/api/routes/analyze.py`

```python
from services.api.schemas.analysis import (
    SkillExtraction,              # Skill individual del análisis
    SkillRequirement,             # Requisito de skill con contexto
    ProjectIdea,                  # Idea de proyecto
    HackathonAnalysisResult,      # Análisis completo del hackathon
    SkillMatchReport,             # Reporte de match de usuario
    AnalyzeHackathonRequest,
    AnalyzeHackathonResponse,
    BatchAnalysisRequest,
    BatchAnalysisResponse,
)
```

**Modelos principales:**

```python
# Raw skill extraction from LLM
SkillExtraction(
    skill_name="Solana",
    category="Blockchain",
    relevance_score=0.95,
    difficulty="intermediate",
    is_core_requirement=True
)

# Complete analysis result
HackathonAnalysisResult(
    hackathon_id="abc123",
    title="Solana Riptide",
    skills_required=[SkillExtraction(...)],
    core_tech_stack=["Solana", "Rust", "TypeScript"],
    project_ideas=[ProjectIdea(...)],
    difficulty_level="intermediate",
    best_for="Full-stack developers with Solana experience",
    estimated_preparation_hours=15,
    estimated_hackathon_hours=40,
    recommended_team_size=2,
    success_rate_estimate="high"
)
```

**Cuándo usar:**
- Respuestas de endpoints `/analyze/hackathon`
- Retornar resultados del agent_crew
- Datos en `Hackathon.ai_analysis` (JSON field)

---

### 2. **hackathon.py** — Hackathon Response Schemas
**Responsables:** `services/api/routes/hackathons.py`, `services/api/routes/devfolio.py`

```python
from services.api.schemas.hackathon import (
    HackathonBase,                 # Campos comunes
    HackathonCreate,               # Para crear registro
    HackathonRead,                 # GET response estándar
    HackathonExtendedRead,         # Con metadata Devfolio
    PersonalizedMatchScore,        # Scoring breakdown
    DevfolioHackathonPersonalizedResponse,  # Scoring personalizado
    SourceMetadata,                # Multi-source aggregation
    AggregatedHackathonResponse,   # Phase 4 aggregation
)
```

**Flujo de schemas:**

```
HackathonBase
    ↓ (add id)
HackathonCreate → INSERT
    ↓
HackathonRead ← GET /hackathons
    ↓ (add Devfolio fields)
HackathonExtendedRead ← GET /devfolio
    ↓ (add scoring)
DevfolioHackathonPersonalizedResponse ← GET /devfolio?wallet={address}
    ↓ (add aggregation)
AggregatedHackathonResponse ← GET /aggregated
```

**Ejemplo de uso:**

```python
from fastapi import APIRouter, Depends
from services.api.schemas.hackathon import HackathonRead, HackathonExtendedRead

router = APIRouter()

@router.get("/", response_model=list[HackathonRead])
async def list_hackathons(db: AsyncSession = Depends(get_db)):
    """Return paginated hackathons."""
    result = await db.execute(select(Hackathon))
    return result.scalars().all()

@router.get("/devfolio", response_model=list[HackathonExtendedRead])
async def list_devfolio(db: AsyncSession = Depends(get_db)):
    """Return Devfolio hackathons with extended metadata."""
    # ...
```

---

### 3. **skill.py** — Skill & User Profile Schemas
**Responsables:** `services/api/routes/skills.py`, `engine/agent_crew.py` (ProjectAnalyzer)

```python
from services.api.schemas.skill import (
    # Skill Demand
    SkillDemandBase,
    SkillDemandRead,
    SkillDemandMetric,
    SkillTrendReport,
    
    # User Skill Profile
    UserSkillProfileBase,
    UserSkillProfileCreate,
    UserSkillProfileRead,
    SkillProgressEntry,
    
    # Neuro Profile
    CognitiveProfile,
    LearningPreferences,
    UserNeuroProfileBase,
    UserNeuroProfileRead,
    
    # Analysis
    SkillGapAnalysis,
)
```

**Casos de uso:**

```python
# Get user skill profile
@router.get("/user-profiles/{wallet}", response_model=UserSkillProfileRead)
async def get_user_profile(wallet: str, db: AsyncSession):
    """Get user's verified skills and preferences."""
    profile = await db.get(UserSkillProfile, {"wallet_address": wallet})
    return profile

# Get skill market demand
@router.get("/demand", response_model=list[SkillDemandRead])
async def get_skill_demand(db: AsyncSession):
    """Get trending skills in the market."""
    skills = await db.execute(
        select(SkillDemand).order_by(SkillDemand.market_demand.desc())
    )
    return skills.scalars().all()

# Get user's neuro profile
@router.get("/neuro-profiles/{wallet}", response_model=UserNeuroProfileRead)
async def get_neuro_profile(wallet: str, db: AsyncSession):
    """Get user's neuropsychological profile."""
    profile = await db.get(UserNeuroProfile, {"wallet_address": wallet})
    return profile
```

---

### 4. **milestone.py** — Educational Escrow Milestones
**Responsables:** `services/api/routes/educational-escrow.py`, `engine/staking_manager.py`

```python
from services.api.schemas.milestone import (
    # Requests
    MarkMilestoneCompletedRequest,
    ApproveMilestoneRequest,
    RejectMilestoneRequest,
    CreateEscrowRequest,
    
    # Responses
    MilestoneStatusRead,
    PendingMilestoneRead,
    CreateEscrowResponse,
    EscrowCompletionReport,
    
    # Tracking
    MilestoneProgressEntry,
    MilestoneProgressTrack,
    EscrowState,
    MilestoneReleaseEvent,
)
```

**Escrow lifecycle:**

```python
# 1. Create escrow
@router.post("/escrows", response_model=CreateEscrowResponse)
async def create_escrow(req: CreateEscrowRequest, db: AsyncSession):
    """Create educational escrow with milestones."""
    escrow = await create_escrow_in_db(req, db)
    return CreateEscrowResponse(escrow_id=escrow.id, status="pending")

# 2. Student marks milestone complete
@router.post("/milestones/{id}/mark-completed", response_model=MilestoneStatusRead)
async def mark_milestone_completed(
    id: int,
    req: MarkMilestoneCompletedRequest,
    db: AsyncSession
):
    """Student submits completion proof."""
    milestone = await db.get(Milestone, id)
    milestone.marked_completed_at = datetime.now()
    milestone.completion_proof_url = req.completion_proof_url
    return milestone

# 3. Coach approves milestone
@router.post("/milestones/{id}/approve", response_model=MilestoneStatusRead)
async def approve_milestone(
    id: int,
    req: ApproveMilestoneRequest,
    db: AsyncSession
):
    """Coach approves completed milestone."""
    milestone = await db.get(Milestone, id)
    milestone.approved_at = datetime.now()
    milestone.approver_notes = req.approver_notes
    # Trigger Stellar XLM release
    await release_xlm_payment(milestone)
    return milestone
```

---

## Migration Guide: Old → New

### Before (single schemas.py)
```python
from services.api.schemas import (
    HackathonRead,
    SkillDemandRead,
    UserSkillProfileRead,
    HackathonAnalysisResult,
)
```

### After (modular schemas/)
```python
# Option 1: Import from submodules (recommended for clarity)
from services.api.schemas.hackathon import HackathonRead
from services.api.schemas.skill import SkillDemandRead, UserSkillProfileRead
from services.api.schemas.analysis import HackathonAnalysisResult

# Option 2: Import from __init__ (backward compatible)
from services.api.schemas import (
    HackathonRead,
    SkillDemandRead,
    UserSkillProfileRead,
    HackathonAnalysisResult,
)
```

**⚠️ Important:** 
- The old `services/api/schemas.py` remains for backward compatibility
- New code should use the modular imports
- Old file will be removed in v2.0

---

## Field Validation Best Practices

All schemas use Pydantic v2 with strict field validation:

```python
from pydantic import BaseModel, Field

class SkillExtraction(BaseModel):
    skill_name: str
    category: str
    relevance_score: float = Field(
        ...,
        ge=0.0,                    # Greater than or equal
        le=1.0,                    # Less than or equal
        description="How important is this skill"
    )
    difficulty: str = Field(
        default="intermediate",
        pattern="^(beginner|intermediate|advanced)$",  # Regex validation
        description="Proficiency level"
    )
    is_core_requirement: bool = False
```

**Common Field Types:**
- `ge` / `le` — Range validation (0.0 to 1.0)
- `pattern` — Regex for enum-like strings
- `default` / `default_factory` — Default values
- `description` — API documentation (OpenAPI)
- `json_schema_extra` — Custom JSON schema examples

---

## Usage in API Routes

### Example: Analyze Hackathon Endpoint

```python
# services/api/routes/analyze.py
from fastapi import APIRouter, HTTPException
from services.api.schemas.analysis import (
    AnalyzeHackathonRequest,
    AnalyzeHackathonResponse,
    HackathonAnalysisResult,
)

router = APIRouter()

@router.post("/hackathon", response_model=AnalyzeHackathonResponse)
async def analyze_hackathon(req: AnalyzeHackathonRequest):
    """
    Analyze a single hackathon with LLM.
    
    Request body:
        {
            "id": "abc123",
            "title": "Solana Riptide",
            "tags": ["web3", "solana"],
            "prize_pool": 250000,
            "description": "..."
        }
    
    Response:
        {
            "hackathon_id": "abc123",
            "analysis": {
                "skills_required": [...],
                "project_ideas": [...],
                "difficulty_level": "intermediate"
            },
            "status": "success"
        }
    """
    try:
        # Call agent crew
        analysis = await run_hackathon_analysis(req)
        
        return AnalyzeHackathonResponse(
            hackathon_id=req.id,
            analysis=analysis,
            status="success"
        )
    except Exception as e:
        return AnalyzeHackathonResponse(
            hackathon_id=req.id,
            analysis=None,
            status="failed",
            error=str(e)
        )
```

---

## Testing Schemas

```python
# tests/test_schemas.py
from services.api.schemas.analysis import SkillExtraction, HackathonAnalysisResult
from services.api.schemas.skill import SkillDemandRead

def test_skill_extraction_validation():
    """Test that invalid relevance_score is rejected."""
    with pytest.raises(ValidationError):
        SkillExtraction(
            skill_name="Python",
            category="Backend",
            relevance_score=1.5  # Invalid: > 1.0
        )

def test_hackathon_analysis_result():
    """Test creating a valid analysis result."""
    result = HackathonAnalysisResult(
        hackathon_id="test123",
        title="Test Hackathon",
        skills_required=[
            SkillExtraction(
                skill_name="Python",
                category="Backend",
                relevance_score=0.9
            )
        ],
        core_tech_stack=["Python", "FastAPI"],
        difficulty_level="intermediate",
        best_for="Python backend developers"
    )
    assert result.hackathon_id == "test123"
    assert len(result.skills_required) == 1
```

---

## OpenAPI/Swagger Documentation

The modular structure automatically generates better OpenAPI docs:

```python
# Each schema with Field description generates docs
class SkillExtraction(BaseModel):
    relevance_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="How central/important is this skill (0.0=optional, 1.0=critical)"
        # ^ This shows up in Swagger UI!
    )

# View at: http://localhost:8000/docs (Swagger)
#          http://localhost:8000/redoc (ReDoc)
```

---

## Performance Considerations

✅ **Advantages of modular structure:**
- Easier to locate and modify schemas
- Clear domain boundaries
- Better for team collaboration
- Simpler testing and validation
- Reduced circular imports

⚠️ **Maintain import performance:**
```python
# ❌ AVOID: Import entire module
from services.api import schemas

# ✅ GOOD: Import specific schemas
from services.api.schemas.analysis import HackathonAnalysisResult
```

---

## Next Steps

1. **Update existing routes** to use new modular imports
2. **Create tests** for new schemas in `tests/test_schemas/`
3. **Document API endpoints** with schema examples in `docs/`
4. **Deprecate** old `schemas.py` in v2.0
5. **Monitor imports** in logs to ensure migration success

