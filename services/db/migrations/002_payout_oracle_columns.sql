-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 002: Payout Oracle — columnas de auditoría Stellar
--
-- Ejecutar en Supabase Dashboard → SQL Editor:
--   \i services/db/migrations/002_payout_oracle_columns.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Columnas de auditoría en educational_escrows
ALTER TABLE educational_escrows
    ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(128),
    ADD COLUMN IF NOT EXISTS payout_error     TEXT,
    ADD COLUMN IF NOT EXISTS retry_count      INT NOT NULL DEFAULT 0;

-- 2. Índice para el payout oracle (busca failed_retry rápido)
CREATE INDEX IF NOT EXISTS idx_escrows_retry
    ON educational_escrows(status, retry_count)
    WHERE status IN ('active', 'failed_retry');

-- 3. Habilitar Supabase Realtime en user_skills_progress
-- (también puedes hacerlo desde Dashboard → Database → Replication)
-- Solo aplica si estás en Supabase (no Docker local)
ALTER PUBLICATION supabase_realtime ADD TABLE user_skills_progress;

-- 4. Columnas adicionales en user_skills_progress
ALTER TABLE user_skills_progress
    ADD COLUMN IF NOT EXISTS is_completed           BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS validator_processed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS profile_embedding      vector(384);

COMMENT ON COLUMN educational_escrows.transaction_hash IS
    'Hash de la transacción Stellar de pago — set por el Payout Oracle';
COMMENT ON COLUMN educational_escrows.retry_count IS
    'Número de reintentos fallidos — Oracle reintenta hasta MAX_RETRIES';
COMMENT ON COLUMN user_skills_progress.is_completed IS
    'TRUE cuando el frontend confirma que el estudiante completó el milestone';
