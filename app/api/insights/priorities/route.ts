import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getDaysUntilDeadline(deadline: string): number {
    const now = new Date();
    const target = new Date(deadline);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
}

function calcPriority(hack: {
    match_score: number;
    prize_pool: number;
    deadline: string;
}): { urgency: number; value: number; total: number; days: number; reasoning: string } {
    const days = getDaysUntilDeadline(hack.deadline);
    // Urgency: peaks at 1-3 days, decays over 90 days
    const urgency = days <= 0 ? 0 : Math.max(0, 100 - (days / 90) * 80);
    // Value: normalized match_score (60%) + prize pool log-scaled (40%)
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

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const daysWindow = parseInt(searchParams.get("days_window") ?? "90");

    // Try Supabase first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let hackathons: Array<{
        id: string; title: string; prize_pool: number;
        tags: string[]; deadline: string; match_score: number;
        source_url?: string;
    }> = [];

    if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase
            .from("hackathons")
            .select("id, title, prize_pool, tags, deadline, match_score, source_url")
            .order("match_score", { ascending: false })
            .limit(50);

        if (!error && data && data.length > 0) {
            hackathons = data as typeof hackathons;
        }
    }

    // Fallback: fetch from internal hackathons API
    if (hackathons.length === 0) {
        try {
            const vercelUrl = process.env.VERCEL_URL;
            const base = vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000";
            const res = await fetch(`${base}/api/hackathons?limit=50`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) hackathons = data;
            }
        } catch { /* ignore */ }
    }

    if (hackathons.length === 0) {
        return NextResponse.json({ error: "Sin datos disponibles" }, { status: 503 });
    }

    // Filter by days window
    const filtered = hackathons.filter(h => getDaysUntilDeadline(h.deadline) <= daysWindow);
    const pool = filtered.length > 0 ? filtered : hackathons;

    // Calculate priorities
    const prioritized = pool
        .map(h => {
            const { urgency, value, total, days, reasoning } = calcPriority(h);
            return {
                id: h.id,
                title: h.title,
                prize_pool: h.prize_pool,
                tags: Array.isArray(h.tags) ? h.tags : [],
                deadline: h.deadline,
                match_score: h.match_score,
                days_until_deadline: days,
                urgency_score: Math.round(urgency),
                value_score: Math.round(value),
                total_priority: Math.round(total),
                reasoning,
            };
        })
        .sort((a, b) => b.total_priority - a.total_priority);

    // Tag analysis
    const tagMap = new Map<string, { count: number; total_match: number }>();
    pool.forEach(h => {
        (Array.isArray(h.tags) ? h.tags : []).forEach(tag => {
            const entry = tagMap.get(tag) ?? { count: 0, total_match: 0 };
            tagMap.set(tag, { count: entry.count + 1, total_match: entry.total_match + h.match_score });
        });
    });
    const top_tags = Array.from(tagMap.entries())
        .map(([tag, { count, total_match }]) => ({
            tag,
            count,
            percentage: Math.round((count / pool.length) * 100),
            avg_match_score: Math.round(total_match / count),
            trend: count >= 3 ? "rising" : "stable" as "rising" | "stable" | "falling",
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const avg_prize_pool = Math.round(pool.reduce((s, h) => s + h.prize_pool, 0) / pool.length);
    const avg_match_score = Math.round(pool.reduce((s, h) => s + h.match_score, 0) / pool.length);
    const urgent = prioritized.filter(h => h.days_until_deadline <= 7).length;
    const high_value = prioritized.filter(h => h.prize_pool >= 50000).length;

    const recommended_actions: string[] = [];
    if (urgent > 0) recommended_actions.push(`Hay ${urgent} hackathon(s) con cierre esta semana — revísalos hoy`);
    if (avg_match_score >= 75) recommended_actions.push("Tu perfil tiene buen match — enfócate en los top 3 prioritarios");
    if (high_value > 0) recommended_actions.push(`${high_value} hackathon(s) con premios > $50k disponibles`);
    recommended_actions.push("Completa tu perfil de skills para mejorar los match scores");
    recommended_actions.push("Aplica a al menos 2 hackatones por sprint para maximizar oportunidades");

    return NextResponse.json({
        insights: {
            total_hackathons: pool.length,
            avg_prize_pool,
            avg_match_score,
            top_tags,
            urgent_hackathons: urgent,
            high_value_hackathons: high_value,
            recommended_actions,
            prioritized_hackathons: prioritized,
        },
        generated_at: new Date().toISOString(),
    });
}
