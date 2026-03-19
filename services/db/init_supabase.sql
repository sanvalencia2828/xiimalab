-- ─────────────────────────────────────────────
-- Xiimalab — Supabase schema migration
-- Run once against your Supabase project:
--   Option A: paste into Supabase Dashboard > SQL Editor
--   Option B: psql "$(DATABASE_URL)" -f init_supabase.sql
-- ─────────────────────────────────────────────

-- Enable uuid extension (available by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- hackathons
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hackathons (
    id          VARCHAR(64)  PRIMARY KEY,
    title       VARCHAR(256) NOT NULL,
    prize_pool  INTEGER      NOT NULL DEFAULT 0,
    tags        JSONB        NOT NULL DEFAULT '[]',
    deadline    VARCHAR(32)  NOT NULL,
    match_score INTEGER      NOT NULL DEFAULT 0,
    source_url  TEXT,
    source      VARCHAR(32)  NOT NULL DEFAULT 'dorahacks',
    ai_analysis JSONB,
    
    -- Devfolio-specific metadata
    tech_stack                  JSONB,
    difficulty                  VARCHAR(32),
    requirements                JSONB,
    talent_pool_estimate        INTEGER,
    organizer                   VARCHAR(256),
    city                        VARCHAR(128),
    event_type                  VARCHAR(32),
    description                 TEXT,
    participation_count_estimate INTEGER,
    
    scraped_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hackathons_match_score ON hackathons (match_score DESC);
CREATE INDEX IF NOT EXISTS idx_hackathons_source      ON hackathons (source);
CREATE INDEX IF NOT EXISTS idx_hackathons_source_deadline ON hackathons(source, deadline DESC);
CREATE INDEX IF NOT EXISTS idx_hackathons_difficulty ON hackathons(difficulty) WHERE difficulty IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hackathons_city ON hackathons(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hackathons_event_type ON hackathons(event_type) WHERE event_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hackathons_tech_stack ON hackathons USING GIN(tech_stack);

-- ─────────────────────────────────────────────
-- user_achievements
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_achievements (
    id             SERIAL       PRIMARY KEY,
    title          VARCHAR(256) NOT NULL,
    issuer         VARCHAR(128) NOT NULL,
    category       VARCHAR(64)  NOT NULL DEFAULT 'certification',
    skills         JSONB        NOT NULL DEFAULT '[]',
    issued_date    VARCHAR(32),
    credential_url TEXT,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_category  ON user_achievements (category);
CREATE INDEX IF NOT EXISTS idx_achievements_is_active ON user_achievements (is_active);

-- ─────────────────────────────────────────────
-- skill_demands
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_demands (
    id             SERIAL        PRIMARY KEY,
    label          VARCHAR(128)  NOT NULL UNIQUE,
    sublabel       VARCHAR(256),
    user_score     FLOAT         NOT NULL DEFAULT 0.0,
    market_demand  FLOAT         NOT NULL DEFAULT 0.0,
    color          VARCHAR(16)   NOT NULL DEFAULT '#7dd3fc',
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_demands_market ON skill_demands (market_demand DESC);

-- ─────────────────────────────────────────────
-- Agent Infrastructure Tables
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_knowledge (
    id              SERIAL       PRIMARY KEY,
    agent_id        VARCHAR(64)  NOT NULL,  -- e.g., 'scout', 'strategist', 'coach'
    topic           VARCHAR(128) NOT NULL,  -- e.g., 'roadmap-nextjs-hackathon', 'user-preference'
    content         JSONB        NOT NULL,  -- arbitrary structured data
    relevance_score FLOAT        NOT NULL DEFAULT 1.0,  -- for sorting/filtering
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_topic ON agent_knowledge (topic);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent ON agent_knowledge (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_relevance ON agent_knowledge (relevance_score DESC);

CREATE TABLE IF NOT EXISTS agent_signals (
    id              SERIAL       PRIMARY KEY,
    source_agent    VARCHAR(64)  NOT NULL,
    target_agent    VARCHAR(64),            -- NULL = broadcast
    signal_type     VARCHAR(64)  NOT NULL, -- e.g., 'new_discovery', 'analysis_ready'
    payload         JSONB,                  -- optional data to pass
    is_processed    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_signals_target ON agent_signals (target_agent);
CREATE INDEX IF NOT EXISTS idx_agent_signals_type ON agent_signals (signal_type);
CREATE INDEX IF NOT EXISTS idx_agent_signals_unprocessed ON agent_signals (is_processed) WHERE is_processed = FALSE;

-- ─────────────────────────────────────────────
-- User Progress Tracking
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_skills_progress (
    student_address     VARCHAR(64)  PRIMARY KEY,  -- wallet address or unique ID
    aura_images_count   INTEGER      NOT NULL DEFAULT 0,
    hackathons_applied  INTEGER      NOT NULL DEFAULT 0,
    is_completed        BOOLEAN      NOT NULL DEFAULT FALSE,  -- true when both modules pass
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Hackathon Applications (for verification)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hackathon_applications (
    id               SERIAL       PRIMARY KEY,
    student_address  VARCHAR(64)  NOT NULL,
    hackathon_id     VARCHAR(64)  NOT NULL REFERENCES hackathons(id),
    platform         VARCHAR(32)  NOT NULL, -- 'dorahacks', 'devfolio', 'manual'
    verified         BOOLEAN      NOT NULL DEFAULT FALSE,
    applied_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(student_address, hackathon_id)
);

CREATE INDEX IF NOT EXISTS idx_hackathon_apps_student ON hackathon_applications (student_address);
CREATE INDEX IF NOT EXISTS idx_hackathon_apps_hackathon ON hackathon_applications (hackathon_id);

-- ─────────────────────────────────────────────
-- Trigger: keep updated_at current on hackathons
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_hackathons_updated_at
    BEFORE UPDATE ON hackathons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_achievements_updated_at
    BEFORE UPDATE ON user_achievements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_skill_demands_updated_at
    BEFORE UPDATE ON skill_demands
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- user_skill_profiles (Phase 3: Personalized Scoring)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_skill_profiles (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(64) NOT NULL UNIQUE,
    
    -- Skill inventory
    verified_skills JSONB NOT NULL DEFAULT '[]',
    preferred_tech_stack JSONB NOT NULL DEFAULT '[]',
    
    -- Learning history and certifications
    learning_history JSONB NOT NULL DEFAULT '[]',
    certifications JSONB NOT NULL DEFAULT '[]',
    
    -- Computed metrics
    total_skill_hours FLOAT NOT NULL DEFAULT 0.0,
    skill_diversity_score FLOAT NOT NULL DEFAULT 0.0,
    
    -- User preferences
    preferred_difficulty VARCHAR(32),
    preferred_event_types JSONB NOT NULL DEFAULT '[]',
    
    -- Cross-reference with neuro profile
    neuroplasticity_score FLOAT NOT NULL DEFAULT 0.5,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_skill_profiles_wallet ON user_skill_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_skill_profiles_neuroplasticity ON user_skill_profiles(neuroplasticity_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_skill_profiles_updated ON user_skill_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_skill_profiles_skills_gin ON user_skill_profiles USING GIN(verified_skills);
CREATE INDEX IF NOT EXISTS idx_user_skill_profiles_tech_stack_gin ON user_skill_profiles USING GIN(preferred_tech_stack);

-- Trigger for user_skill_profiles updated_at
CREATE OR REPLACE TRIGGER trg_user_skill_profiles_updated_at
    BEFORE UPDATE ON user_skill_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
