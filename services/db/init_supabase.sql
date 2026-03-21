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

-- ─────────────────────────────────────────────
-- Stellar Escrow Lifecycle (Educational Staking)
-- ─────────────────────────────────────────────

-- Escrow State Enum
CREATE TYPE escrow_state AS ENUM (
    'INITIATION',
    'FUNDING',
    'MILESTONE_UPDATES',
    'APPROVAL',
    'RELEASE',
    'DISPUTE_RESOLUTION'
);

-- Escrow Ledger (educational staking contracts)
CREATE TABLE IF NOT EXISTS escrow_ledger (
    id SERIAL PRIMARY KEY,
    
    -- Stellar identifiers
    student_address VARCHAR(64) NOT NULL,
    coach_address VARCHAR(64) NOT NULL,
    escrow_account VARCHAR(64),
    
    -- Contract terms
    amount_xlm FLOAT NOT NULL,
    total_milestones INTEGER NOT NULL DEFAULT 1,
    
    -- Current state
    current_state escrow_state NOT NULL DEFAULT 'INITIATION',
    
    -- Stellar claimable balance info
    claimable_balance_id VARCHAR(128),
    
    -- Dates
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    funded_at TIMESTAMPTZ,
    approval_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    disputed_at TIMESTAMPTZ,
    
    -- Dispute resolution
    dispute_resolver_address VARCHAR(64),
    dispute_reason TEXT,
    dispute_outcome VARCHAR(32),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_ledger_student ON escrow_ledger(student_address);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_coach ON escrow_ledger(coach_address);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_state ON escrow_ledger(current_state);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_created ON escrow_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_active ON escrow_ledger(current_state)
    WHERE current_state NOT IN ('RELEASE', 'DISPUTE_RESOLUTION');

-- Escrow Timeline (audit trail for state transitions)
CREATE TABLE IF NOT EXISTS escrow_timeline (
    id SERIAL PRIMARY KEY,
    
    escrow_id INTEGER NOT NULL REFERENCES escrow_ledger(id) ON DELETE CASCADE,
    
    -- State transition
    from_state escrow_state NOT NULL,
    to_state escrow_state NOT NULL,
    
    -- Transition metadata
    actor VARCHAR(64) NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Transaction tracking
    stellar_tx_hash VARCHAR(128),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_timeline_escrow ON escrow_timeline(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_timeline_states ON escrow_timeline(from_state, to_state);
CREATE INDEX IF NOT EXISTS idx_escrow_timeline_created ON escrow_timeline(created_at DESC);

-- Escrow Milestones (individual milestone tracking)
CREATE TABLE IF NOT EXISTS escrow_milestones (
    id SERIAL PRIMARY KEY,
    
    escrow_id INTEGER NOT NULL REFERENCES escrow_ledger(id) ON DELETE CASCADE,
    
    -- Milestone details
    milestone_number INTEGER NOT NULL,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    required_skills JSONB DEFAULT '[]',
    
    -- Completion tracking
    marked_completed_at TIMESTAMPTZ,
    completion_proof_url TEXT,
    
    -- Approval tracking
    approved_at TIMESTAMPTZ,
    approver_notes TEXT,
    
    -- Release status
    funds_released_at TIMESTAMPTZ,
    release_amount_xlm FLOAT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_milestones_escrow ON escrow_milestones(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_approved ON escrow_milestones(approved_at) 
    WHERE approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_released ON escrow_milestones(funds_released_at) 
    WHERE funds_released_at IS NOT NULL;

-- Add escrow tracking to user_achievements
ALTER TABLE user_achievements
ADD COLUMN IF NOT EXISTS escrow_id INTEGER REFERENCES escrow_ledger(id),
ADD COLUMN IF NOT EXISTS escrow_milestone_id INTEGER REFERENCES escrow_milestones(id),
ADD COLUMN IF NOT EXISTS is_escrow_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_achievements_escrow ON user_achievements(escrow_id) 
    WHERE escrow_id IS NOT NULL;

-- Update escrow state from timeline
CREATE OR REPLACE FUNCTION update_escrow_state_from_timeline()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE escrow_ledger
    SET current_state = NEW.to_state,
        updated_at = NOW()
    WHERE id = NEW.escrow_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_escrow_timeline_update_state
    AFTER INSERT ON escrow_timeline
    FOR EACH ROW EXECUTE FUNCTION update_escrow_state_from_timeline();

-- Triggers for updated_at
CREATE OR REPLACE TRIGGER trg_escrow_ledger_updated_at
    BEFORE UPDATE ON escrow_ledger
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_escrow_milestones_updated_at
    BEFORE UPDATE ON escrow_milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Active Escrows View
CREATE OR REPLACE VIEW v_active_escrows AS
SELECT 
    el.id,
    el.student_address,
    el.coach_address,
    el.amount_xlm,
    el.current_state,
    el.total_milestones,
    COUNT(em.id) as completed_milestones,
    MAX(em.approved_at) as latest_approval,
    el.initiated_at,
    el.updated_at
FROM escrow_ledger el
LEFT JOIN escrow_milestones em ON em.escrow_id = el.id AND em.approved_at IS NOT NULL
WHERE el.current_state NOT IN ('RELEASE', 'DISPUTE_RESOLUTION')
GROUP BY el.id;

-- Disputed Escrows View
CREATE OR REPLACE VIEW v_disputed_escrows AS
SELECT 
    el.id,
    el.student_address,
    el.coach_address,
    el.amount_xlm,
    el.dispute_resolver_address,
    el.dispute_reason,
    el.dispute_outcome,
    el.disputed_at,
    COUNT(et.id) as state_change_count
FROM escrow_ledger el
LEFT JOIN escrow_timeline et ON et.escrow_id = el.id
WHERE el.current_state = 'DISPUTE_RESOLUTION'
GROUP BY el.id;

-- ─────────────────────────────────────────────
-- Market Trends (Real-Time Growth & Demand)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name VARCHAR(128) NOT NULL,
    demand_score INTEGER NOT NULL DEFAULT 0,
    growth_percentage VARCHAR(32) NOT NULL DEFAULT '+0%',
    category VARCHAR(64) NOT NULL DEFAULT 'tech',
    top_projects_keywords JSONB NOT NULL DEFAULT '[]',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_trends_demand ON market_trends (demand_score DESC);
CREATE INDEX IF NOT EXISTS idx_market_trends_category ON market_trends (category);

CREATE OR REPLACE TRIGGER trg_market_trends_updated_at
    BEFORE UPDATE ON market_trends
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable RLS and create public read policy
ALTER TABLE market_trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to market_trends" ON market_trends FOR SELECT USING (true);
-- Service role handles inserts/updates so it bypasses RLS

-- ─────────────────────────────────────────────
-- active_hackathons View
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW active_hackathons AS
SELECT
    id,
    title,
    prize_pool,
    tags,
    deadline,
    match_score,
    source_url,
    source,
    scraped_at AS last_seen_at,
    updated_at
FROM hackathons;

-- Dar acceso a anon
GRANT SELECT ON active_hackathons TO anon, authenticated, service_role;

