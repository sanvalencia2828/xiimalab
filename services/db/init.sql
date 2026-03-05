-- Xiimalab PostgreSQL initialization
-- This runs automatically on first `docker compose up`

-- Enable uuid extension (for future use)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Hackathons table
CREATE TABLE IF NOT EXISTS hackathons (
    id            VARCHAR(64)  PRIMARY KEY,
    title         VARCHAR(256) NOT NULL,
    prize_pool    INTEGER      NOT NULL DEFAULT 0,
    tags          JSONB        NOT NULL DEFAULT '[]',
    deadline      VARCHAR(32)  NOT NULL,
    match_score   INTEGER      NOT NULL DEFAULT 0,
    source_url    TEXT,
    source        VARCHAR(32)  NOT NULL DEFAULT 'dorahacks',
    ai_analysis   JSONB        NULL,
    scraped_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hackathons_match_score ON hackathons(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_hackathons_deadline    ON hackathons(deadline);

-- Skill demands table
CREATE TABLE IF NOT EXISTS skill_demands (
    id            SERIAL       PRIMARY KEY,
    label         VARCHAR(128) NOT NULL UNIQUE,
    sublabel      VARCHAR(256),
    user_score    FLOAT        NOT NULL DEFAULT 0,
    market_demand FLOAT        NOT NULL DEFAULT 0,
    color         VARCHAR(16)  NOT NULL DEFAULT '#7dd3fc',
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Achievements / certifications table
CREATE TABLE IF NOT EXISTS user_achievements (
    id            SERIAL       PRIMARY KEY,
    title         VARCHAR(256) NOT NULL,
    issuer        VARCHAR(128) NOT NULL,
    category      VARCHAR(64)  NOT NULL DEFAULT 'certification',
    skills        JSONB        NOT NULL DEFAULT '[]',
    issued_date   VARCHAR(32),
    credential_url TEXT,
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_issuer   ON user_achievements(issuer);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON user_achievements(category);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_hackathons_updated_at') THEN
        CREATE TRIGGER set_hackathons_updated_at
        BEFORE UPDATE ON hackathons
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_skills_updated_at') THEN
        CREATE TRIGGER set_skills_updated_at
        BEFORE UPDATE ON skill_demands
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_achievements_updated_at') THEN
        CREATE TRIGGER set_achievements_updated_at
        BEFORE UPDATE ON user_achievements
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- Seed initial achievements (Santiago's verified certifications)
INSERT INTO user_achievements (title, issuer, category, skills, issued_date, credential_url) VALUES
(
    'Data Analytics Professional',
    'NODO-EAFIT',
    'certification',
    '["Python", "Pandas", "Data Visualization", "Statistics", "SQL"]',
    '2024-01',
    NULL
),
(
    'Data Analytics',
    'MINTIC',
    'certification',
    '["Python", "Data Analysis", "Business Intelligence", "Excel", "Power BI"]',
    '2024-03',
    NULL
),
(
    'Stellar Blockchain Developer',
    'Stellar Impacta Program',
    'certification',
    '["Stellar SDK", "Horizon API", "Smart Contracts", "DeFi", "Web3"]',
    '2024-06',
    NULL
),
(
    'Avalanche Academy — DeFi & Smart Contracts',
    'Avalanche',
    'certification',
    '["Avalanche", "EVM", "Solidity basics", "DeFi protocols", "Fuji testnet"]',
    '2024-08',
    NULL
)
ON CONFLICT DO NOTHING;
