"use server";

import { createClient } from "@supabase/supabase-js";

export interface PriorityHackathon {
    id: string;
    title: string;
    prize_pool: number;
    tags: string[];
    deadline: string;
    match_score: number;
    source_url?: string;
    days_until_deadline: number;
    urgency_score: number;
    value_score: number;
    total_priority: number;
    reasoning: string;
}

export interface TagInsight {
    tag: string;
    count: number;
    percentage: number;
    avg_match_score: number;
    trend: "rising" | "stable" | "falling";
}

export interface SkillRelevance {
    skill: string;
    hackathon_count: number;   // how many hackathons need this skill
    percentage: number;        // % of hackathons in pool
    prize_coverage: number;    // sum of prizes from hackathons with this skill
    top_hackathon: string;     // hackathon title with highest prize needing this skill
}

export interface MarketInsights {
    total_hackathons: number;
    avg_prize_pool: number;
    avg_match_score: number;
    top_tags: TagInsight[];
    skill_relevance: SkillRelevance[];   // NEW: skills ranked by hackathon demand
    urgent_hackathons: number;
    high_value_hackathons: number;
    recommended_actions: string[];
    prioritized_hackathons: PriorityHackathon[];
}

export interface PrioritiesResponse {
    insights: MarketInsights;
    generated_at: string;
}

function getDaysUntilDeadline(deadline: string): number {
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
}

function calcPriority(hack: { match_score: number; prize_pool: number; deadline: string }) {
    const days = getDaysUntilDeadline(hack.deadline);
    const urgency = days <= 0 ? 0 : Math.max(0, 100 - (days / 90) * 80);
    const prizeScore = Math.min(100, (Math.log10(Math.max(hack.prize_pool, 1000)) / 6) * 100);
    const value = hack.match_score * 0.6 + prizeScore * 0.4;
    const total = urgency * 0.4 + value * 0.6;

    const reasoning =
        days <= 3 ? "⚡ Cierre inminente — actúa hoy" :
        days <= 7 ? "🔥 Última semana — prioridad alta" :
        hack.match_score >= 85 ? "🎯 Excelente match con tu perfil" :
        hack.prize_pool >= 50000 ? "💰 Premio alto — vale la pena" :
        "📅 Buena oportunidad a mediano plazo";

    return { urgency, value, total, days, reasoning };
}

export async function getPrioritiesAction(daysWindow: number = 60): Promise<PrioritiesResponse | { error: string }> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { error: "Supabase no configurado" };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
        .from("hackathons")
        .select("id, title, prize_pool, tags, deadline, match_score, source_url")
        .order("match_score", { ascending: false })
        .limit(60);

    if (error || !data || data.length === 0) {
        return { error: "No se encontraron hackatones en la base de datos" };
    }

    const hackathons = data as Array<{
        id: string; title: string; prize_pool: number;
        tags: string[]; deadline: string; match_score: number; source_url?: string;
    }>;

    // Filter to daysWindow
    const pool = hackathons.filter(h => getDaysUntilDeadline(h.deadline) <= daysWindow);
    const workPool = pool.length > 0 ? pool : hackathons;

    // ── Skill Relevance Analysis ──────────────────────────────────────────
    // Build map: skill → { count, total_prize, top_hackathon }
    const skillMap = new Map<string, {
        count: number;
        total_prize: number;
        top_prize: number;
        top_title: string;
    }>();

    workPool.forEach(h => {
        const tags = Array.isArray(h.tags) ? h.tags : [];
        tags.forEach(tag => {
            const existing = skillMap.get(tag) ?? { count: 0, total_prize: 0, top_prize: 0, top_title: "" };
            skillMap.set(tag, {
                count: existing.count + 1,
                total_prize: existing.total_prize + (h.prize_pool ?? 0),
                top_prize: Math.max(existing.top_prize, h.prize_pool ?? 0),
                top_title: h.prize_pool > existing.top_prize ? h.title : existing.top_title,
            });
        });
    });

    const skill_relevance: SkillRelevance[] = Array.from(skillMap.entries())
        .map(([skill, { count, total_prize, top_title }]) => ({
            skill,
            hackathon_count: count,
            percentage: Math.round((count / workPool.length) * 100),
            prize_coverage: total_prize,
            top_hackathon: top_title,
        }))
        .sort((a, b) => b.prize_coverage - a.prize_coverage || b.hackathon_count - a.hackathon_count)
        .slice(0, 12);

    // ── Tag Analysis (for backwards compat) ───────────────────────────────
    const tagMap = new Map<string, { count: number; total_match: number }>();
    workPool.forEach(h => {
        (Array.isArray(h.tags) ? h.tags : []).forEach(tag => {
            const e = tagMap.get(tag) ?? { count: 0, total_match: 0 };
            tagMap.set(tag, { count: e.count + 1, total_match: e.total_match + h.match_score });
        });
    });
    const top_tags: TagInsight[] = Array.from(tagMap.entries())
        .map(([tag, { count, total_match }]) => ({
            tag,
            count,
            percentage: Math.round((count / workPool.length) * 100),
            avg_match_score: Math.round(total_match / count),
            trend: (count >= 3 ? "rising" : "stable") as "rising" | "stable" | "falling",
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // ── Prioritize ─────────────────────────────────────────────────────────
    const prioritized: PriorityHackathon[] = workPool
        .map(h => {
            const { urgency, value, total, days, reasoning } = calcPriority(h);
            return {
                ...h,
                tags: Array.isArray(h.tags) ? h.tags : [],
                days_until_deadline: days,
                urgency_score: Math.round(urgency),
                value_score: Math.round(value),
                total_priority: Math.round(total),
                reasoning,
            };
        })
        .sort((a, b) => b.total_priority - a.total_priority);

    const avg_prize_pool = Math.round(workPool.reduce((s, h) => s + h.prize_pool, 0) / workPool.length);
    const avg_match_score = Math.round(workPool.reduce((s, h) => s + h.match_score, 0) / workPool.length);
    const urgent = prioritized.filter(h => h.days_until_deadline <= 7).length;
    const high_value = prioritized.filter(h => h.prize_pool >= 50000).length;

    const recommended_actions: string[] = [];
    if (urgent > 0) recommended_actions.push(`${urgent} hackathon(s) cierran esta semana — aplica hoy`);
    if (skill_relevance[0]) recommended_actions.push(`Aprende "${skill_relevance[0].skill}" — aparece en ${skill_relevance[0].percentage}% de las convocatorias activas`);
    if (high_value > 0) recommended_actions.push(`${high_value} hackatón(es) con premios >$50k disponibles`);
    if (avg_match_score >= 75) recommended_actions.push("Tu perfil tiene buen match — aplica al menos a 2 este sprint");

    return {
        insights: {
            total_hackathons: workPool.length,
            avg_prize_pool,
            avg_match_score,
            top_tags,
            skill_relevance,
            urgent_hackathons: urgent,
            high_value_hackathons: high_value,
            recommended_actions,
            prioritized_hackathons: prioritized,
        },
        generated_at: new Date().toISOString(),
    };
}

export async function getTagAnalysisAction(): Promise<{ tag_analysis: TagInsight[]; error?: string }> {
    const result = await getPrioritiesAction(90);
    if ("error" in result) return { tag_analysis: [], error: result.error };
    return { tag_analysis: result.insights.top_tags };
}
