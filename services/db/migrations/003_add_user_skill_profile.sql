-- Migration 003: Add UserSkillProfile table for Phase 3 personalized scoring
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_skill_profiles (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(64) NOT NULL UNIQUE,
    
    -- Skill inventory
    verified_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferred_tech_stack JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Learning history and certifications
    learning_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Computed metrics
    total_skill_hours FLOAT NOT NULL DEFAULT 0.0,
    skill_diversity_score FLOAT NOT NULL DEFAULT 0.0,
    
    -- User preferences
    preferred_difficulty VARCHAR(32),
    preferred_event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Cross-reference with neuro profile
    neuroplasticity_score FLOAT NOT NULL DEFAULT 0.5,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for quick lookups and filtering
CREATE INDEX idx_user_skill_profiles_wallet ON user_skill_profiles(wallet_address);
CREATE INDEX idx_user_skill_profiles_neuroplasticity ON user_skill_profiles(neuroplasticity_score DESC) 
    WHERE neuroplasticity_score > 0;
CREATE INDEX idx_user_skill_profiles_updated ON user_skill_profiles(updated_at DESC);

-- GIN indexes for JSONB queries
CREATE INDEX idx_user_skill_profiles_skills_gin ON user_skill_profiles USING GIN(verified_skills);
CREATE INDEX idx_user_skill_profiles_tech_stack_gin ON user_skill_profiles USING GIN(preferred_tech_stack);

-- Analytics: ANALYZE for query planner
ANALYZE user_skill_profiles;

-- Migration end ─────────────────────────────────────────────────────────
