export interface AiAnalysis {
  match_score: number;
  missing_skills: string[];
  project_highlight: string;
}

export interface Hackathon {
  id: string;
  title: string;
  prize_pool: number;
  tags: string[];
  deadline: string;
  match_score: number;
  source_url: string | null;
  source: string;
  scraped_at?: string;
  updated_at?: string;
  missing_skills: string[];
  project_highlight: string;
  ai_analysis?: AiAnalysis | null;
}

export interface SkillDemand {
  id: number;
  label: string;
  sublabel: string | null;
  user_score: number;
  market_demand: number;
  color: string;
  updated_at?: string;
}

export interface AgentInsight {
  id: number;
  agent_name: string;
  insight: string;
  confidence: number;
  created_at: string;
}

export interface MarketTrend {
  role_name: string;
  demand_score: number;
  growth_percentage?: string;
  category?: string;
  top_projects_keywords?: string[];
}

export interface ProjectMatch {
  project_id: string;
  hackathon_id: string;
  hackathon_title: string;
  match_score: number;
  reasoning: string;
  crew: string;
  created_at: string;
}

export interface SourceMetadata {
  sources: string[];
  primary_source: string;
  source_urls: Record<string, string>;
  is_multi_source: boolean;
  source_confidence: number;
}

export interface PersonalizedMatchScore {
  skill_overlap_score: number;
  urgency_score: number;
  value_score: number;
  tech_stack_score: number;
  neuro_score: number;
  personalized_score: number;
  reasoning: string;
}

export interface AggregatedHackathon extends Hackathon {
  tech_stack?: string[] | null;
  difficulty?: string | null;
  requirements?: string[] | null;
  talent_pool_estimate?: number | null;
  organizer?: string | null;
  city?: string | null;
  event_type?: string | null;
  description?: string | null;
  participation_count_estimate?: number | null;
  urgency_score?: number | null;
  value_score?: number | null;
  personalized_score?: number | null;
  match_breakdown?: PersonalizedMatchScore | null;
  source_metadata?: Partial<SourceMetadata>;
}

export interface RealmUserProfile {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  preferences: { theme: 'light' | 'dark'; notifications: boolean };
}

export interface RealmHackathon {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  prizePool: number;
  tags: string[];
  skills: string[];
  matchScore?: number;
  urgencyScore?: number;
  valueScore?: number;
  priority?: number;
}

export interface RealmUserAchievement {
  _id: string;
  userId: string;
  title: string;
  description: string;
  earnedAt: string;
  imageUrl?: string;
  skillsDemonstrated: string[];
}

export interface RealmSkillDemand {
  _id: string;
  skill: string;
  frequency: number;
  trend: 'rising' | 'stable' | 'declining';
  lastUpdated: string;
}

export function normalizeHackathon(raw: Record<string, unknown>): Hackathon {
  const prize_pool = (raw['prize_pool'] as number) ?? (raw['prizePool'] as number) ?? 0;
  const match_score = (raw['match_score'] as number) ?? (raw['matchScore'] as number) ?? 0;
  const source_url = (raw['source_url'] as string | null) ?? (raw['sourceUrl'] as string | null) ?? null;
  const ai = raw['ai_analysis'] as AiAnalysis | null | undefined;

  return {
    id: String(raw['id'] ?? ''),
    title: String(raw['title'] ?? ''),
    prize_pool: Number(prize_pool),
    tags: Array.isArray(raw['tags']) ? (raw['tags'] as string[]) : [],
    deadline: String(raw['deadline'] ?? ''),
    match_score: Math.max(0, Math.min(100, Number(match_score))),
    source_url,
    source: String(raw['source'] ?? 'dorahacks'),
    scraped_at: raw['scraped_at'] as string | undefined,
    updated_at: raw['updated_at'] as string | undefined,
    missing_skills: (raw['missing_skills'] as string[]) ?? ai?.missing_skills ?? [],
    project_highlight: (raw['project_highlight'] as string) ?? ai?.project_highlight ?? '',
    ai_analysis: ai ?? null,
  };
}
