-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: educational_escrows
-- Sistema de Reembolso por Competencias (Proof of Skill)
--
-- Ejecutar en Supabase Dashboard > SQL Editor
-- o: psql "$(DATABASE_URL)" -f migrate_educational_escrows.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS educational_escrows (
    id                      SERIAL          PRIMARY KEY,

    -- Identificadores del pago
    hotmart_transaction_id  VARCHAR(128)    NOT NULL UNIQUE,
    buyer_email             VARCHAR(256)    NOT NULL,
    buyer_stellar_address   VARCHAR(64)     NOT NULL,

    -- Clasificación de la habilidad
    skill_tag               VARCHAR(64)     NOT NULL,   -- ej: 'diseño_ia', 'blockchain_dev'

    -- Stellar
    stellar_balance_id      VARCHAR(256)    NOT NULL,   -- Claimable Balance ID en Horizon
    xlm_amount              NUMERIC(18, 7)  NOT NULL,
    window_days             INTEGER         NOT NULL DEFAULT 30,

    -- Estado del escrow
    -- pending    → esperando hitos
    -- releasable → ambos hitos completos, listo para reclamar
    -- claimed    → usuario reclamó el balance en Stellar
    -- expired    → venció el plazo sin reclamo
    escrow_status           VARCHAR(32)     NOT NULL DEFAULT 'pending',

    -- ─── Hitos de competencia ────────────────────────────────────────────────
    -- Trigger AURA: imágenes procesadas con la herramienta de redimensionamiento
    aura_milestone_count    INTEGER         NOT NULL DEFAULT 0,

    -- Trigger Hackathon: referencia al hackathon scrapeado en el portal
    hackathon_id            VARCHAR(64)     REFERENCES hackathons(id) ON DELETE SET NULL,

    -- ─── Timestamps ──────────────────────────────────────────────────────────
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Índices para las consultas más frecuentes del validador
CREATE INDEX IF NOT EXISTS idx_escrows_email
    ON educational_escrows (buyer_email);

CREATE INDEX IF NOT EXISTS idx_escrows_status
    ON educational_escrows (escrow_status)
    WHERE escrow_status IN ('pending', 'releasable');

CREATE INDEX IF NOT EXISTS idx_escrows_skill_tag
    ON educational_escrows (skill_tag);

-- Trigger para updated_at (reutiliza la función ya definida en init_supabase.sql)
CREATE OR REPLACE TRIGGER trg_escrows_updated_at
    BEFORE UPDATE ON educational_escrows
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
