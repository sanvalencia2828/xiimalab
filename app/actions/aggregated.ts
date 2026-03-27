"use server";

import { createClient } from "@supabase/supabase-js";
import type { AggregatedHackathon } from "@/lib/types";
import { getApiBase, safeFetch } from "@/lib/api";

// ── Supabase direct client (server-side, service role) ─────────────────────
function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

// ── Helper: internal Vercel URL ─────────────────────────────────────────────
function getInternalBase() {
    const vercelUrl = process.env.VERCEL_URL;
    return vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000";
}

// ── Sort & filter helpers ───────────────────────────────────────────────────
function daysUntil(deadline: string) {
    return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000));
}

function scoreHackathon(h: AggregatedHackathon, sortBy: string) {
    const days = daysUntil(h.deadline ?? "");
    const urgency = days <= 0 ? 0 : Math.max(0, 100 - (days / 90) * 80);
    const prizeScore = Math.min(100, (Math.log10(Math.max(h.prize_pool ?? 1000, 1000)) / 6) * 100);
    const value = (h.match_score ?? 50) * 0.6 + prizeScore * 0.4;
    switch (sortBy) {
        case "urgency":          return urgency;
        case "prize":            return h.prize_pool ?? 0;
        case "match":            return h.match_score ?? 0;
        case "value":            return value;
        case "personalized_score":
        default:                 return urgency * 0.4 + value * 0.6;
    }
}

/**
 * Fetch hackathons from Supabase → fallback to internal /api/hackathons
 */
async function fetchFromSupabase(params: {
    tags?: string[];
    minPrize?: number;
    sortBy?: string;
    limit?: number;
    offset?: number;
}): Promise<AggregatedHackathon[]> {
    const supabase = getSupabase();

    if (supabase) {
        let query = supabase
            .from("hackathons")
            .select("id, title, prize_pool, tags, deadline, match_score, source_url, source")
            .limit(params.limit ?? 50);

        if (params.minPrize) query = query.gte("prize_pool", params.minPrize);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
            let hackathons = data as AggregatedHackathon[];

            // Tag filter
            if (params.tags?.length) {
                hackathons = hackathons.filter(h =>
                    params.tags!.some(tag =>
                        (Array.isArray(h.tags) ? h.tags : []).some((t: string) =>
                            t.toLowerCase().includes(tag.toLowerCase())
                        )
                    )
                );
            }

            // Sort
            const sortBy = params.sortBy ?? "urgency";
            hackathons.sort((a, b) => scoreHackathon(b, sortBy) - scoreHackathon(a, sortBy));

            return hackathons.slice(params.offset ?? 0);
        }
    }

    // Fallback: /api/hackathons
    const base = getInternalBase();
    const res = await safeFetch<AggregatedHackathon[]>(`${base}/api/hackathons?limit=${params.limit ?? 50}`);
    return res ?? [];
}

// ── Main action ─────────────────────────────────────────────────────────────
export async function getAggregatedHackathons(params: {
    tags?: string[];
    minPrize?: number;
    wallet?: string;
    sortBy?: "personalized_score" | "urgency" | "value" | "match" | "prize";
    dedupThreshold?: number;
    limit?: number;
    offset?: number;
} = {}): Promise<{ hackathons: AggregatedHackathon[]; total: number; error?: string }> {

    // 1. Try FastAPI if available
    const apiBase = getApiBase();
    if (apiBase) {
        const qp = new URLSearchParams();
        if (params.tags?.length)         qp.set("tags", params.tags.join(","));
        if (params.minPrize !== undefined) qp.set("min_prize", String(params.minPrize));
        if (params.wallet)               qp.set("wallet", params.wallet);
        if (params.sortBy)               qp.set("sort_by", params.sortBy);
        if (params.dedupThreshold !== undefined) qp.set("dedup_threshold", String(params.dedupThreshold));
        if (params.limit !== undefined)  qp.set("limit", String(params.limit));
        if (params.offset !== undefined) qp.set("offset", String(params.offset));

        const data = await safeFetch<{ hackathons: AggregatedHackathon[]; total: number }>(
            `${apiBase}/hackathons/aggregated?${qp}`
        );
        if (data?.hackathons?.length) {
            return { hackathons: data.hackathons, total: data.total ?? data.hackathons.length };
        }
    }

    // 2. Supabase / internal API
    const hackathons = await fetchFromSupabase(params);
    return { hackathons, total: hackathons.length };
}

// ── Stats action ─────────────────────────────────────────────────────────────
export async function getAggregatedStats(): Promise<{
    total_hackathons: number;
    sources_breakdown: Record<string, number>;
    top_tags: Array<{ tag: string; count: number }>;
    multi_source_count: number;
    avg_source_confidence: number;
    error?: string;
}> {
    const apiBase = getApiBase();
    if (apiBase) {
        const data = await safeFetch<{
            total_hackathons: number;
            sources_breakdown: Record<string, number>;
            top_tags: Array<{ tag: string; count: number }>;
            multi_source_count: number;
            avg_source_confidence: number;
        }>(`${apiBase}/hackathons/aggregated/stats`);
        if (data) return data;
    }

    // Build stats from Supabase
    const hackathons = await fetchFromSupabase({ limit: 100 });
    const sources: Record<string, number> = {};
    const tagMap: Record<string, number> = {};
    hackathons.forEach(h => {
        if (h.source) sources[h.source] = (sources[h.source] ?? 0) + 1;
        (Array.isArray(h.tags) ? h.tags : []).forEach((t: string) => {
            tagMap[t] = (tagMap[t] ?? 0) + 1;
        });
    });
    const top_tags = Object.entries(tagMap).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    return {
        total_hackathons: hackathons.length,
        sources_breakdown: sources,
        top_tags,
        multi_source_count: 0,
        avg_source_confidence: 0.85,
    };
}

// ── Personalized recommendations ─────────────────────────────────────────────
export async function getPersonalizedRecommendations(
    wallet: string,
    params: { tags?: string[]; minPrize?: number; limit?: number } = {}
): Promise<{ hackathons: AggregatedHackathon[]; error?: string }> {
    if (!wallet) return { hackathons: [], error: "Wallet requerida" };
    const result = await getAggregatedHackathons({ wallet, sortBy: "personalized_score", ...params });
    return { hackathons: result.hackathons, error: result.error };
}
