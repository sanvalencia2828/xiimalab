/**
 * lib/types.ts — Single source of truth for all shared TypeScript types.
 *
 * Mirrors the Python Pydantic schemas in services/api/schemas.py.
 * All fields use snake_case to match the database and API responses directly.
 *
 * Rule: frontend components should use these types (not define their own).
 */

// ─────────────────────────────────────────────
// AI Analysis (from ai_engine.py → ai_analysis column)
// ─────────────────────────────────────────────
export interface AiAnalysis {
  match_score:       number;       // 0-100
  missing_skills:    string[];     // top skills the dev is missing
  project_highlight: string;       // how to use RedimensionAI in this hackathon
}

// ─────────────────────────────────────────────
// Hackathon (mirrors HackathonRead in schemas.py)
// ─────────────────────────────────────────────
export interface Hackathon {
  id:                string;
  title:             string;
  prize_pool:        number;
  tags:              string[];
  deadline:          string;        // ISO date string "YYYY-MM-DD"
  match_score:       number;        // 0-100 — computed by ML matcher
  source_url:        string | null;
  source:            string;        // "dorahacks" | "devfolio" | "devpost"
  scraped_at?:       string;
  updated_at?:       string;
  // AI-enriched fields (from ai_analysis JSON column)
  missing_skills:    string[];      // top 3-5 skills to improve for this hackathon
  project_highlight: string;        // personalized pitch for RedimensionAI
  ai_analysis?:      AiAnalysis | null;
}

// ─────────────────────────────────────────────
// Skill Demand (mirrors SkillDemandRead in schemas.py)
// ─────────────────────────────────────────────
export interface SkillDemand {
  id:            number;
  label:         string;
  sublabel:      string | null;
  user_score:    number;   // 0-100 — developer's current level
  market_demand: number;   // 0-100 — market demand for this skill
  color:         string;   // hex color for charts
  updated_at?:   string;
}

// ─────────────────────────────────────────────
// Agent Insight (from agent_insights table)
// ─────────────────────────────────────────────
export interface AgentInsight {
  id:          number;
  agent_name:  string;    // "Scout" | "Analyzer" | "Oracle" | "Writer"
  insight:     string;    // the actual insight text
  confidence:  number;    // 0-1
  created_at:  string;
}

// ─────────────────────────────────────────────
// Market Trends (Real-Time Growth & Demand)
// ─────────────────────────────────────────────
export interface MarketTrend {
  role_name: string;
  demand_score: number;
  growth_percentage?: string;
  category?: string;
  top_projects_keywords?: string[];
}

// ─────────────────────────────────────────────
// Project + Hackathon match (from project_hackathon_matches table)
// ─────────────────────────────────────────────
export interface ProjectMatch {
  project_id:      string;
  hackathon_id:    string;
  hackathon_title: string;
  match_score:     number;   // 0-100
  reasoning:       string;
  crew:            string;   // which agent crew produced this match
  created_at:      string;
}

// ─────────────────────────────────────────────
// Phase 4: Multi-source Aggregation
// ─────────────────────────────────────────────
export interface SourceMetadata {
  sources:             string[];           // ["devfolio", "dorahacks"]
  primary_source:      string;             // Highest priority source
  source_urls:         Record<string, string>;  // source → URL mapping
  is_multi_source:     boolean;            // True if multiple sources
  source_confidence:   number;             // 0.7-1.0 based on source count
}

export interface PersonalizedMatchScore {
  skill_overlap_score:  number;
  urgency_score:        number;
  value_score:          number;
  tech_stack_score:     number;
  neuro_score:          number;
  personalized_score:   number;
  reasoning:            string;
}

export interface AggregatedHackathon extends Hackathon {
  // Extended metadata from Devfolio/multi-source
  tech_stack?:              string[] | null;
  difficulty?:              string | null;        // "beginner" | "intermediate" | "advanced"
  requirements?:            string[] | null;
  talent_pool_estimate?:    number | null;
  organizer?:               string | null;
  city?:                    string | null;
  event_type?:              string | null;        // "virtual" | "in-person" | "hybrid"
  description?:             string | null;
  participation_count_estimate?: number | null;
  
  // Phase 3 Scoring
  urgency_score?:           number | null;
  value_score?:             number | null;
  personalized_score?:      number | null;       // Only if wallet provided
  match_breakdown?:         PersonalizedMatchScore | null;
  
  // Multi-source metadata
  source_metadata?:         Partial<SourceMetadata>;
}

// ─────────────────────────────────────────────
// Normalize helper — convert API snake_case to this type safely
// Handles legacy camelCase responses from Devfolio/Devpost scrapers
// ─────────────────────────────────────────────
export function normalizeHackathon(raw: Record<string, unknown>): Hackathon {
  // Support both snake_case (DB/FastAPI) and camelCase (legacy Devfolio scraper)
  const prize_pool =
    (raw.prize_pool as number) ??
    (raw.prizePool as number) ??
    0;
  const match_score =
    (raw.match_score as number) ??
    (raw.matchScore as number) ??
    0;
  const source_url =
    (raw.source_url as string | null) ??
    (raw.sourceUrl as string | null) ??
    null;

  // Unpack ai_analysis if present
  const ai = raw.ai_analysis as AiAnalysis | null | undefined;

  return {
    id:                String(raw.id ?? ""),
    title:             String(raw.title ?? ""),
    prize_pool:        Number(prize_pool),
    tags:              Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    deadline:          String(raw.deadline ?? ""),
    match_score:       Math.max(0, Math.min(100, Number(match_score))),
    source_url,
    source:            String(raw.source ?? "dorahacks"),
    scraped_at:        raw.scraped_at as string | undefined,
    updated_at:        raw.updated_at as string | undefined,
    // AI fields — prefer top-level (populated by scraper), fallback to ai_analysis JSON
    missing_skills:    (raw.missing_skills as string[]) ?? ai?.missing_skills ?? [],
    project_highlight: (raw.project_highlight as string) ?? ai?.project_highlight ?? "",
    ai_analysis:       ai ?? null,
  };
}
