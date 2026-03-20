-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 007: Fix Escrow Schema & Add Missing Tables
-- Sincroniza el schema con staking_manager.py expectations
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Alterar educational_escrows para renombrar y añadir campos necesarios
BEGIN;

ALTER TABLE IF EXISTS educational_escrows RENAME COLUMN buyer_stellar_address TO user_stellar_pubkey;
ALTER TABLE IF EXISTS educational_escrows RENAME COLUMN xlm_amount TO amount_xlm;
ALTER TABLE IF EXISTS educational_escrows RENAME COLUMN escrow_status TO status;
ALTER TABLE IF EXISTS educational_escrows RENAME COLUMN hotmart_transaction_id TO hotmart_order_id;
ALTER TABLE IF EXISTS educational_escrows RENAME COLUMN buyer_email TO user_id;

-- Agregar campos faltantes si no existen
ALTER TABLE IF EXISTS educational_escrows ADD COLUMN IF NOT EXISTS course_id VARCHAR(256);
ALTER TABLE IF EXISTS educational_escrows ADD COLUMN IF NOT EXISTS stellar_balance_id VARCHAR(256);
ALTER TABLE IF EXISTS educational_escrows ADD COLUMN IF NOT EXISTS milestone_type VARCHAR(64);
ALTER TABLE IF EXISTS educational_escrows ADD COLUMN IF NOT EXISTS milestone_reached_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS educational_escrows ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS educational_escrows ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Cambiar tipos si es necesario y hacer ID secuencial
ALTER TABLE IF EXISTS educational_escrows ALTER COLUMN amount_xlm TYPE NUMERIC(18, 7) USING amount_xlm::NUMERIC(18, 7);

-- 2. Recrear user_skills_progress con los campos esperados por el código
DROP TABLE IF EXISTS user_skills_progress CASCADE;

CREATE TABLE user_skills_progress (
    user_id                    VARCHAR(256) PRIMARY KEY,
    aura_images_processed      INTEGER          NOT NULL DEFAULT 0,
    hackathon_applications     JSONB            NOT NULL DEFAULT '[]',
    total_milestones_reached   INTEGER          NOT NULL DEFAULT 0,
    last_activity_at           TIMESTAMPTZ,
    created_at                 TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_skills_progress_updated ON user_skills_progress(updated_at DESC);

-- 3. Crear escrow_milestones (para workflow de aprobación)
CREATE TABLE IF NOT EXISTS escrow_milestones (
    id                    SERIAL          PRIMARY KEY,
    escrow_id             INTEGER         NOT NULL REFERENCES educational_escrows(id) ON DELETE CASCADE,
    milestone_number      INTEGER         NOT NULL,
    description           TEXT,
    marked_completed_at   TIMESTAMPTZ,
    completion_proof_url  TEXT,
    approved_at           TIMESTAMPTZ,
    approved_by           VARCHAR(256),
    rejected_at           TIMESTAMPTZ,
    rejection_reason      TEXT,
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE(escrow_id, milestone_number)
);

CREATE INDEX IF NOT EXISTS idx_escrow_milestones_escrow_id ON escrow_milestones(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_status ON escrow_milestones(marked_completed_at) 
    WHERE marked_completed_at IS NULL;

-- 4. Crear escrow_timeline (para auditoría)
CREATE TABLE IF NOT EXISTS escrow_timeline (
    id          SERIAL       PRIMARY KEY,
    escrow_id   INTEGER      NOT NULL REFERENCES educational_escrows(id) ON DELETE CASCADE,
    from_state   VARCHAR(64),
    to_state    VARCHAR(64),
    actor       VARCHAR(256),
    reason      VARCHAR(256),
    metadata    JSONB,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_timeline_escrow_id ON escrow_timeline(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_timeline_created_at ON escrow_timeline(created_at DESC);

-- 5. Crear escrow_lifecycle_log (para logging de fases)
CREATE TABLE IF NOT EXISTS escrow_lifecycle_log (
    id          SERIAL       PRIMARY KEY,
    user_id     VARCHAR(256) NOT NULL,
    escrow_id   VARCHAR(256),
    phase       VARCHAR(64)  NOT NULL,
    details     JSONB,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_lifecycle_log_user_id ON escrow_lifecycle_log(user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_lifecycle_log_phase ON escrow_lifecycle_log(phase);
CREATE INDEX IF NOT EXISTS idx_escrow_lifecycle_log_created_at ON escrow_lifecycle_log(created_at DESC);

-- Mantener el trigger para updated_at si existe la función set_updated_at
CREATE OR REPLACE TRIGGER trg_user_skills_progress_updated_at
    BEFORE UPDATE ON user_skills_progress
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_escrow_milestones_updated_at
    BEFORE UPDATE ON escrow_milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
