"use server";

import { supabase } from "@/lib/supabase";
import type { AggregatedHackathon } from "@/lib/types";
import { getApiBase, safeFetch } from "@/lib/api";
import { getLiveHackathons } from "@/lib/hackathons/live";

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

type FetchParams = {
    tags?: string[];
    minPrize?: number;
    sortBy?: string;
    limit?: number;
    offset?: number;
};

/** Filtro por tags/premio + orden + paginación, común a todas las fuentes. */
function applyParams(list: AggregatedHackathon[], params: FetchParams): AggregatedHackathon[] {
    let hackathons = list;
    if (params.minPrize) hackathons = hackathons.filter(h => (h.prize_pool ?? 0) >= params.minPrize!);
    if (params.tags?.length) {
        hackathons = hackathons.filter(h =>
            params.tags!.some(tag =>
                (Array.isArray(h.tags) ? h.tags : []).some((t: string) =>
                    t.toLowerCase().includes(tag.toLowerCase())
                )
            )
        );
    }
    const sortBy = params.sortBy ?? "urgency";
    hackathons = [...hackathons].sort((a, b) => scoreHackathon(b, sortBy) - scoreHackathon(a, sortBy));
    const offset = params.offset ?? 0;
    return hackathons.slice(offset, offset + (params.limit ?? 50));
}

/**
 * Hackatones en vivo (DoraHacks + Devpost + Devfolio) → fallback a Supabase.
 * Ya no se auto-llama a /api/hackathons vía VERCEL_URL (Vercel lo bloquea con
 * Deployment Protection y añade una ida y vuelta innecesaria).
 */
async function fetchFromSupabase(params: FetchParams): Promise<AggregatedHackathon[]> {
    // 1. Agregador en vivo
    try {
        const live = await getLiveHackathons();
        if (live.hackathons.length > 0) return applyParams(live.hackathons, params);
    } catch (err) {
        console.warn("[aggregated] live sources failed:", err);
    }

    // 2. Supabase (datos guardados por el scraper / sync)
    if (supabase) {
        const { data, error } = await supabase
            .from("hackathons")
            .select("id, title, prize_pool, tags, deadline, match_score, source_url, source")
            .limit(200);
        if (!error && data && data.length > 0) {
            const today = new Date().toISOString().slice(0, 10);
            const open = (data as AggregatedHackathon[]).filter(h => !h.deadline || h.deadline >= today);
            return applyParams(open, params);
        }
    }
    return [];
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

    // 2. Fuentes en vivo / Supabase
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
