/* Migration: Add Devfolio extended metadata columns to hackathons table
   Date: 2026-03-19
*/

-- Add new columns to hackathons table with DEFAULT NULL for backward compatibility
ALTER TABLE hackathons
ADD COLUMN IF NOT EXISTS tech_stack JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS difficulty VARCHAR(32) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS talent_pool_estimate INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS organizer VARCHAR(256) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS city VARCHAR(128) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS event_type VARCHAR(32) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS participation_count_estimate INTEGER DEFAULT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_hackathons_source_deadline 
  ON hackathons(source, deadline DESC);

CREATE INDEX IF NOT EXISTS idx_hackathons_difficulty 
  ON hackathons(difficulty) 
  WHERE difficulty IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hackathons_city 
  ON hackathons(city) 
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hackathons_event_type 
  ON hackathons(event_type) 
  WHERE event_type IS NOT NULL;

-- Index for JSON tech_stack column (GIN for better performance on large JSON arrays)
CREATE INDEX IF NOT EXISTS idx_hackathons_tech_stack 
  ON hackathons USING GIN(tech_stack);

-- Create a partial index for Devfolio hackathons only (faster queries for MVP)
CREATE INDEX IF NOT EXISTS idx_devfolio_hackathons_created 
  ON hackathons(source, created_at DESC) 
  WHERE source = 'devfolio';

-- Update table statistics for query planner
ANALYZE hackathons;
