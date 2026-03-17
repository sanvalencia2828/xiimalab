-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 005: Normalización de Tags + project_hackathon_matches
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Función de normalización de tags
-- Convierte variantes como 'Web 3', 'web3', 'Web3.0' → 'Web3'
-- Convierte 'Machine Learning', 'ML', 'ml' → 'Machine Learning'
CREATE OR REPLACE FUNCTION normalize_tag(tag TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(tag) IN ('web3','web 3','web3.0','web 3.0')     THEN 'Web3'
    WHEN lower(tag) IN ('blockchain','block chain')             THEN 'Blockchain'
    WHEN lower(tag) IN ('ai','artificial intelligence')         THEN 'AI'
    WHEN lower(tag) IN ('ml','machine learning','machinelearning') THEN 'Machine Learning'
    WHEN lower(tag) IN ('defi','de-fi','decentralized finance') THEN 'DeFi'
    WHEN lower(tag) IN ('nft','nfts','non-fungible token')      THEN 'NFT'
    WHEN lower(tag) IN ('computer vision','cv','opencv')        THEN 'Computer Vision'
    WHEN lower(tag) IN ('nlp','natural language processing')    THEN 'NLP'
    WHEN lower(tag) IN ('llm','large language model')          THEN 'LLM'
    WHEN lower(tag) IN ('python','py')                          THEN 'Python'
    WHEN lower(tag) IN ('typescript','ts')                      THEN 'TypeScript'
    WHEN lower(tag) IN ('docker','containers')                  THEN 'Docker'
    WHEN lower(tag) IN ('stellar','stellar network','xlm')      THEN 'Stellar'
    WHEN lower(tag) IN ('machine learning/ai','ai/ml')          THEN 'AI'
    WHEN lower(tag) IN ('beginner friendly','beginner-friendly') THEN 'Beginner Friendly'
    ELSE initcap(tag)
  END;
$$;

-- 2. Actualizar tags en active_hackathons (normalizar en lote)
UPDATE active_hackathons
SET tags = (
  SELECT jsonb_agg(normalize_tag(elem::text))
  FROM jsonb_array_elements_text(tags) AS elem
)
WHERE tags IS NOT NULL AND jsonb_array_length(tags) > 0;

-- 3. Tabla project_hackathon_matches — corazón de la Fase 3
CREATE TABLE IF NOT EXISTS project_hackathon_matches (
    id              SERIAL          PRIMARY KEY,
    project_id      VARCHAR(64)     NOT NULL REFERENCES user_projects(id) ON DELETE CASCADE,
    hackathon_id    VARCHAR(64)     NOT NULL REFERENCES active_hackathons(id) ON DELETE CASCADE,
    match_pct       INT             NOT NULL DEFAULT 0,
    shared_tags     JSONB           NOT NULL DEFAULT '[]',
    reasoning       TEXT            NOT NULL DEFAULT '',
    prize_pool      INT             NOT NULL DEFAULT 0,
    source          VARCHAR(32)     NOT NULL DEFAULT '',
    source_url      TEXT,
    hackathon_title VARCHAR(256),
    -- Estado: new | seen | applied | dismissed
    status          VARCHAR(16)     NOT NULL DEFAULT 'new',
    computed_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, hackathon_id)
);

CREATE INDEX IF NOT EXISTS idx_phm_project    ON project_hackathon_matches(project_id, match_pct DESC);
CREATE INDEX IF NOT EXISTS idx_phm_hackathon  ON project_hackathon_matches(hackathon_id);
CREATE INDEX IF NOT EXISTS idx_phm_status     ON project_hackathon_matches(status);

-- 4. Vista para el dashboard — Top match por proyecto
CREATE OR REPLACE VIEW v_project_top_matches AS
SELECT
    phm.project_id,
    up.title           AS project_title,
    up.status          AS project_status,
    phm.hackathon_id,
    phm.hackathon_title,
    phm.match_pct,
    phm.shared_tags,
    phm.reasoning,
    phm.prize_pool,
    phm.source,
    phm.source_url,
    phm.status         AS match_status,
    phm.computed_at,
    ROW_NUMBER() OVER (
        PARTITION BY phm.project_id
        ORDER BY phm.match_pct DESC
    )                  AS rank
FROM project_hackathon_matches phm
JOIN user_projects up ON up.id = phm.project_id
WHERE phm.match_pct >= 50;

-- 5. Columna wallet en user_skills_progress (para el WalletContext)
ALTER TABLE user_skills_progress
    ADD COLUMN IF NOT EXISTS stellar_public_key  VARCHAR(58),
    ADD COLUMN IF NOT EXISTS wallet_connected_at TIMESTAMPTZ;

COMMENT ON TABLE project_hackathon_matches IS
    'Matches calculados por el Agent Crew entre proyectos del usuario y hackatones activas';
COMMENT ON VIEW v_project_top_matches IS
    'Top match por proyecto — alimenta el Project Insight Card del dashboard';
