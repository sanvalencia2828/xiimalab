-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 003: Sistema Multi-Agente — Agent Crew
--
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tabla de proyectos del usuario (dinámicos, no hardcodeados en el frontend)
CREATE TABLE IF NOT EXISTS user_projects (
    id              VARCHAR(64)     PRIMARY KEY,
    title           VARCHAR(256)    NOT NULL,
    description     TEXT            NOT NULL DEFAULT '',
    status          VARCHAR(32)     NOT NULL DEFAULT 'in-development',
    -- status: active | completed | in-development | archived
    stack           JSONB           NOT NULL DEFAULT '[]',
    metrics         JSONB           NOT NULL DEFAULT '{}',
    accent_color    VARCHAR(16),
    github_url      TEXT,
    demo_url        TEXT,
    -- embedding del proyecto para matching semántico
    project_embedding vector(384),
    owner_id        VARCHAR(128)    NOT NULL DEFAULT 'sanvalencia2828',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 2. Tabla de insights generados por los agentes
CREATE TABLE IF NOT EXISTS agent_insights (
    id              SERIAL          PRIMARY KEY,
    -- Qué agente lo generó
    agent_name      VARCHAR(64)     NOT NULL,
    -- Tipo: opportunity | warning | recommendation | match
    insight_type    VARCHAR(32)     NOT NULL DEFAULT 'opportunity',
    -- Proyecto involucrado (puede ser NULL si es global)
    project_id      VARCHAR(64)     REFERENCES user_projects(id) ON DELETE SET NULL,
    -- Hackatón involucrada (puede ser NULL)
    hackathon_id    VARCHAR(64)     REFERENCES active_hackathons(id) ON DELETE SET NULL,
    -- Contenido del insight
    title           VARCHAR(256)    NOT NULL,
    summary         TEXT            NOT NULL,
    reasoning       TEXT,           -- por qué el agente lo recomienda
    action_url      TEXT,           -- link directo a la hackatón
    -- Puntuación de relevancia del agente (0-100)
    relevance_score INT             NOT NULL DEFAULT 0,
    match_pct       INT             NOT NULL DEFAULT 0,
    -- Estado: new | read | acted | dismissed
    status          VARCHAR(16)     NOT NULL DEFAULT 'new',
    -- Metadata del agente
    agent_metadata  JSONB           NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ     -- insights caducan (hackatones cerradas)
);

-- 3. Tabla de ejecuciones de agentes (trazabilidad)
CREATE TABLE IF NOT EXISTS agent_runs (
    id              SERIAL          PRIMARY KEY,
    run_id          VARCHAR(64)     NOT NULL UNIQUE DEFAULT gen_random_uuid()::VARCHAR,
    status          VARCHAR(16)     NOT NULL DEFAULT 'running',
    -- status: running | completed | failed
    agents_invoked  JSONB           NOT NULL DEFAULT '[]',
    insights_created INT             NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    error_log       TEXT,
    triggered_by    VARCHAR(64)     -- api | cron | webhook
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_insights_project    ON agent_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_insights_hackathon  ON agent_insights(hackathon_id);
CREATE INDEX IF NOT EXISTS idx_insights_type       ON agent_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_status     ON agent_insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_relevance  ON agent_insights(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_projects_owner      ON user_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_runs_status         ON agent_runs(status);

-- 5. Datos iniciales — proyectos de Santiago
INSERT INTO user_projects (id, title, description, status, stack, metrics, accent_color) VALUES
(
    'aura-v1',
    'AURA',
    'Motor de resize de imágenes con IA. Redimensiona y optimiza automáticamente para múltiples plataformas sociales aplicando neural style transfer y content-awareness.',
    'active',
    '["Python", "Docker", "FastAPI", "OpenCV", "Neural Style Transfer", "AI"]',
    '{"accuracy": "94%", "latency": "< 80ms", "platforms": 6}',
    '#7dd3fc'
),
(
    'redimension-ai',
    'RedimensionAI',
    'Optimizador de imágenes para redes sociales. Detecta el contenido principal y genera versiones optimizadas para cada formato con reducción de peso de hasta 70%.',
    'completed',
    '["Python", "Next.js", "TypeScript", "Docker"]',
    '{"formats": 8, "reduction": "70%", "speed": "2x"}',
    '#38bdf8'
),
(
    'xiimalab-platform',
    'Xiimalab',
    'Hub de inteligencia personal IA + Blockchain. Centraliza proyectos, detecta hackatones en tiempo real y analiza el match con el mercado usando ML y pgvector.',
    'in-development',
    '["Next.js", "TypeScript", "FastAPI", "Stellar", "PostgreSQL", "pgvector", "sentence-transformers"]',
    '{"pages": 5, "scrapers": 3, "integrations": "MCP + Stellar"}',
    '#a78bfa'
)
ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    stack       = EXCLUDED.stack,
    metrics     = EXCLUDED.metrics,
    updated_at  = NOW();

COMMENT ON TABLE agent_insights IS
    'Oportunidades y recomendaciones generadas por el Agent Crew de Xiimalab';
COMMENT ON TABLE agent_runs IS
    'Historial de ejecuciones del sistema multi-agente para trazabilidad';
