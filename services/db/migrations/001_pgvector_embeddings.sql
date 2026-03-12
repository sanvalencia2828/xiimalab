-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 001: pgvector — Embeddings para MarketMatch con ML
--
-- Requisito: PostgreSQL con la extensión pgvector instalada.
-- En Supabase: ya está disponible. Ejecutar via SQL Editor del Dashboard.
-- En Docker local: usa imagen pgvector/pgvector:pg16
--
-- Ejecutar en orden:
--   1. Habilitar extensión
--   2. Modificar active_hackathons
--   3. Modificar user_skills_progress
--   4. Crear índices IVFFLAT para búsqueda eficiente
--   5. Crear función SQL de matching
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Columna embedding en active_hackathons (vector de 384 dims — all-MiniLM-L6-v2)
ALTER TABLE active_hackathons
    ADD COLUMN IF NOT EXISTS embedding vector(384);

-- 3. Columna embedding en user_skills_progress
ALTER TABLE user_skills_progress
    ADD COLUMN IF NOT EXISTS profile_embedding vector(384);

-- 4. Índices IVFFLAT para búsqueda aproximada eficiente por similitud coseno
--    lists=100 es adecuado para tablas de hasta ~1M filas
CREATE INDEX IF NOT EXISTS idx_hackathons_embedding
    ON active_hackathons
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_skills_embedding
    ON user_skills_progress
    USING ivfflat (profile_embedding vector_cosine_ops)
    WITH (lists = 100);

-- 5. Función SQL: Top-N hackatones con mayor afinidad para un estudiante
--    Uso: SELECT * FROM match_hackathons_for_user('user@email.com', 5);
CREATE OR REPLACE FUNCTION match_hackathons_for_user(
    p_user_id TEXT,
    p_top_n   INT DEFAULT 3
)
RETURNS TABLE (
    hackathon_id    VARCHAR(64),
    title           VARCHAR(256),
    source          VARCHAR(32),
    source_url      TEXT,
    prize_pool      INTEGER,
    tags            JSONB,
    deadline        VARCHAR(32),
    match_score_raw FLOAT,       -- similitud coseno cruda (0-1)
    match_pct       INTEGER      -- porcentaje de afinidad (0-100)
)
LANGUAGE sql STABLE AS $$
    SELECT
        ah.id                                                       AS hackathon_id,
        ah.title,
        ah.source,
        ah.source_url,
        ah.prize_pool,
        ah.tags,
        ah.deadline,
        1 - (ah.embedding <=> usp.profile_embedding)               AS match_score_raw,
        ROUND(
            (1 - (ah.embedding <=> usp.profile_embedding)) * 100
        )::INT                                                      AS match_pct
    FROM active_hackathons ah
    CROSS JOIN user_skills_progress usp
    WHERE usp.user_id               = p_user_id
      AND ah.embedding              IS NOT NULL
      AND usp.profile_embedding     IS NOT NULL
    ORDER BY ah.embedding <=> usp.profile_embedding   -- orden por distancia coseno ASC
    LIMIT p_top_n;
$$;

-- 6. Vista útil: ranking global de afinidad (para dashboard admin)
CREATE OR REPLACE VIEW v_top_matches AS
SELECT
    usp.user_id,
    ah.id           AS hackathon_id,
    ah.title,
    ah.source,
    ah.prize_pool,
    ROUND(
        (1 - (ah.embedding <=> usp.profile_embedding)) * 100
    )::INT          AS match_pct,
    ah.deadline
FROM active_hackathons ah
CROSS JOIN user_skills_progress usp
WHERE ah.embedding          IS NOT NULL
  AND usp.profile_embedding IS NOT NULL
ORDER BY match_pct DESC;

COMMENT ON FUNCTION match_hackathons_for_user IS
    'Retorna el Top-N de hackatones con mayor similitud coseno al perfil del estudiante. Requiere pgvector.';
