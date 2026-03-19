"use server";

import type { AggregatedHackathon } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Server action to fetch aggregated hackathons from multiple sources.
 * Supports filtering, sorting, and personalized scoring.
 */
export async function getAggregatedHackathons(params: {
  tags?: string[];
  minPrize?: number;
  wallet?: string;
  sortBy?: "personalized_score" | "urgency" | "value" | "match" | "prize";
  dedupThreshold?: number;
  limit?: number;
  offset?: number;
} = {}): Promise<{
  hackathons: AggregatedHackathon[];
  total: number;
  error?: string;
}> {
  try {
    const queryParams = new URLSearchParams();

    if (params.tags?.length) {
      queryParams.append("tags", params.tags.join(","));
    }
    if (params.minPrize !== undefined) {
      queryParams.append("min_prize", String(params.minPrize));
    }
    if (params.wallet) {
      queryParams.append("wallet", params.wallet);
    }
    if (params.sortBy) {
      queryParams.append("sort_by", params.sortBy);
    }
    if (params.dedupThreshold !== undefined) {
      queryParams.append("dedup_threshold", String(params.dedupThreshold));
    }
    if (params.limit !== undefined) {
      queryParams.append("limit", String(params.limit));
    }
    if (params.offset !== undefined) {
      queryParams.append("offset", String(params.offset));
    }

    const url = `${API_BASE}/hackathons/aggregated?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 600 }, // Cache for 10 minutes
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        hackathons: [],
        total: 0,
        error: errorData.detail || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      hackathons: Array.isArray(data.hackathons) ? data.hackathons : [],
      total: data.total ?? 0,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[getAggregatedHackathons] Error:", errorMessage);
    return {
      hackathons: [],
      total: 0,
      error: errorMessage,
    };
  }
}

/**
 * Server action to fetch aggregated stats (tag frequency, source breakdown).
 */
export async function getAggregatedStats(): Promise<{
  total_hackathons: number;
  sources_breakdown: Record<string, number>;
  top_tags: Array<{ tag: string; count: number }>;
  multi_source_count: number;
  avg_source_confidence: number;
  error?: string;
}> {
  try {
    const url = `${API_BASE}/hackathons/aggregated/stats`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 600 }, // Cache for 10 minutes
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        total_hackathons: 0,
        sources_breakdown: {},
        top_tags: [],
        multi_source_count: 0,
        avg_source_confidence: 0,
        error: errorData.detail || `HTTP ${response.status}`,
      };
    }

    return await response.json();
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[getAggregatedStats] Error:", errorMessage);
    return {
      total_hackathons: 0,
      sources_breakdown: {},
      top_tags: [],
      multi_source_count: 0,
      avg_source_confidence: 0,
      error: errorMessage,
    };
  }
}

/**
 * Server action for personalized recommendations based on user wallet.
 */
export async function getPersonalizedRecommendations(
  wallet: string,
  params: {
    tags?: string[];
    minPrize?: number;
    limit?: number;
  } = {}
): Promise<{
  hackathons: AggregatedHackathon[];
  error?: string;
}> {
  try {
    if (!wallet) {
      return {
        hackathons: [],
        error: "Wallet address is required",
      };
    }

    const result = await getAggregatedHackathons({
      wallet,
      sortBy: "personalized_score",
      ...params,
    });

    return {
      hackathons: result.hackathons,
      error: result.error,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return {
      hackathons: [],
      error: errorMessage,
    };
  }
}
