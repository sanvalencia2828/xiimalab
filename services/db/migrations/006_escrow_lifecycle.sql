/* Migration: Add Stellar Escrow Lifecycle States
   Date: 2026-03-19
   Purpose: Implement TrustlessWork escrow lifecycle phases for educational staking on Stellar
   
   Phases tracked:
   1. INITIATION - roles, terms, contract created
   2. FUNDING - funds deposited, escrow live
   3. MILESTONE_UPDATES - milestones marked complete with proof
   4. APPROVAL - approver reviews milestones
   5. RELEASE - funds transferred to receiver
   6. DISPUTE_RESOLUTION - alternative phase if conflict arises
*/

-- ─────────────────────────────────────────────
-- Escrow State Enum Type
-- ─────────────────────────────────────────────
CREATE TYPE escrow_state AS ENUM (
    'INITIATION',
    'FUNDING',
    'MILESTONE_UPDATES',
    'APPROVAL',
    'RELEASE',
    'DISPUTE_RESOLUTION'
);

-- ─────────────────────────────────────────────
-- Escrow Ledger (educational staking contracts)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_ledger (
    id SERIAL PRIMARY KEY,
    
    -- Stellar identifiers
    student_address VARCHAR(64) NOT NULL,      -- Student wallet (G...)
    coach_address VARCHAR(64) NOT NULL,        -- Coach/approver wallet
    escrow_account VARCHAR(64),                -- Escrow account on Stellar (if created)
    
    -- Contract terms
    amount_xlm FLOAT NOT NULL,                 -- XLM amount staked
    total_milestones INTEGER NOT NULL DEFAULT 1,
    
    -- Current state
    current_state escrow_state NOT NULL DEFAULT 'INITIATION',
    
    -- Stellar claimable balance info
    claimable_balance_id VARCHAR(128),         -- Condition ID for claimable balance
    
    -- Dates
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    funded_at TIMESTAMPTZ,
    approval_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    disputed_at TIMESTAMPTZ,
    
    -- Dispute resolution metadata (if applicable)
    dispute_resolver_address VARCHAR(64),
    dispute_reason TEXT,
    dispute_outcome VARCHAR(32),               -- 'FULL_REFUND', 'PARTIAL_REFUND', 'NO_REFUND'
    
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

-- ─────────────────────────────────────────────
-- Escrow Timeline (audit trail for state transitions)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_timeline (
    id SERIAL PRIMARY KEY,
    
    escrow_id INTEGER NOT NULL REFERENCES escrow_ledger(id) ON DELETE CASCADE,
    
    -- State transition
    from_state escrow_state NOT NULL,
    to_state escrow_state NOT NULL,
    
    -- Transition metadata
    actor VARCHAR(64) NOT NULL,                -- Who triggered the transition (wallet)
    reason TEXT,                               -- Why (e.g., 'milestone_completed', 'funds_deployed')
    metadata JSONB DEFAULT '{}',               -- Additional context (proof_url, approval_notes, etc.)
    
    -- Transaction tracking
    stellar_tx_hash VARCHAR(128),              -- Stellar transaction hash if applicable
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_timeline_escrow ON escrow_timeline(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_timeline_states ON escrow_timeline(from_state, to_state);
CREATE INDEX IF NOT EXISTS idx_escrow_timeline_created ON escrow_timeline(created_at DESC);

-- ─────────────────────────────────────────────
-- Escrow Milestones (tracks individual milestone completion)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_milestones (
    id SERIAL PRIMARY KEY,
    
    escrow_id INTEGER NOT NULL REFERENCES escrow_ledger(id) ON DELETE CASCADE,
    
    -- Milestone details
    milestone_number INTEGER NOT NULL,        -- 1, 2, 3, etc.
    title VARCHAR(256) NOT NULL,
    description TEXT,
    required_skills JSONB DEFAULT '[]',       -- Skills to validate
    
    -- Completion tracking
    marked_completed_at TIMESTAMPTZ,
    completion_proof_url TEXT,                -- Evidence URL or IPFS hash
    
    -- Approval tracking
    approved_at TIMESTAMPTZ,
    approver_notes TEXT,
    
    -- Release status
    funds_released_at TIMESTAMPTZ,
    release_amount_xlm FLOAT,                 -- May be different from full amount (multi-release)
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_milestones_escrow ON escrow_milestones(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_approved ON escrow_milestones(approved_at) 
    WHERE approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_released ON escrow_milestones(funds_released_at) 
    WHERE funds_released_at IS NOT NULL;

-- ─────────────────────────────────────────────
-- Add escrow tracking to user_achievements
-- ─────────────────────────────────────────────
ALTER TABLE user_achievements
ADD COLUMN IF NOT EXISTS escrow_id INTEGER REFERENCES escrow_ledger(id),
ADD COLUMN IF NOT EXISTS escrow_milestone_id INTEGER REFERENCES escrow_milestones(id),
ADD COLUMN IF NOT EXISTS is_escrow_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_achievements_escrow ON user_achievements(escrow_id) 
    WHERE escrow_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- Trigger: Update escrow_ledger.current_state when timeline entries are added
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- Trigger: Keep updated_at current on escrow tables
-- ─────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_escrow_ledger_updated_at
    BEFORE UPDATE ON escrow_ledger
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_escrow_milestones_updated_at
    BEFORE UPDATE ON escrow_milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- Helper View: Active Escrows by Student
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- Helper View: Dispute Status
-- ─────────────────────────────────────────────
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
-- Stats & Audit
-- ─────────────────────────────────────────────
ANALYZE escrow_ledger;
ANALYZE escrow_timeline;
ANALYZE escrow_milestones;
