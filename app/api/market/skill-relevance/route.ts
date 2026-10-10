import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLiveHackathons } from "@/lib/hackathons/live";

export const dynamic = "force-dynamic";

const SKILL_COMPLEXITY: Record<string, number> = {
    "AI": 1.0, "ML": 1.0, "LLM": 1.0, "GPT": 1.0, "MACHINE LEARNING": 1.0,
    "BLOCKCHAIN": 0.9, "WEB3": 0.9, "DEFI": 0.9, "NFT": 0.8, "SOLANA": 0.85,
    "RUST": 0.95, "GO": 0.85, "TYPESCRIPT": 0.6, "JAVASCRIPT": 0.5, "PYTHON": 0.55,
    "REACT": 0.65, "NEXT.JS": 0.7, "NODE.JS": 0.65, "SVELTE": 0.6,
    "POSTGRESQL": 0.7, "MONGODB": 0.7, "DOCKER": 0.75, "KUBERNETES": 0.9,
    "AWS": 0.8, "GCP": 0.8, "AZURE": 0.8, "GRAPHQL": 0.7, "REST API": 0.55,
    "SECURITY": 0.85, "CRYPTOGRAPHY": 0.9, "ZKP": 0.95, "DATA SCIENCE": 0.85,
};

function getComplexity(skill: string): number {
    const upper = skill.toUpperCase();
    for (const [key, value] of Object.entries(SKILL_COMPLEXITY)) {
        if (upper.includes(key.toUpperCase()) || key.toUpperCase().includes(upper)) {
            return value;
        }
    }
    return 0.5;
}

function calculateRelevance(hackathons: Array<{ tags?: string[] }>): {
    relevance_report: Array<{ skill: string; score: number; trend: "up" | "stable" }>;
    total_skills_analyzed: number;
    total_hackathons: number;
    generated_at: string;
} {
    const tagCounts: Record<string, number> = {};
    let totalSkills = 0;

    hackathons.forEach(hack => {
        const tags = hack.tags || [];
        const seen = new Set<string>();
        tags.forEach(tag => {
            const clean = tag.trim();
            if (clean && !seen.has(clean.toLowerCase())) {
                tagCounts[clean] = (tagCounts[clean] || 0) + 1;
                seen.add(clean.toLowerCase());
                totalSkills++;
            }
        });
    });

    const maxFreq = Math.max(...Object.values(tagCounts), 1);
    const total = hackathons.length || 1;

    const scored = Object.entries(tagCounts)
        .map(([skill, freq]) => {
            const freqScore = (freq / maxFreq) * 100;
            const complexity = getComplexity(skill);
            const complexityScore = complexity * 100;
            const score = Math.min(100, Math.round(freqScore * 0.6 + complexityScore * 0.4));
            const trend: "up" | "stable" = freq >= 3 && freq >= total * 0.15 ? "up" : "stable";
            return { skill, score, trend };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    return {
        relevance_report: scored,
        total_skills_analyzed: Object.keys(tagCounts).length,
        total_hackathons: hackathons.length,
        generated_at: new Date().toISOString(),
    };
}

export async function GET() {
    let hackathons: Array<{ id: string; title: string; tags?: string[]; prize_pool: number; deadline: string }> = [];

    if (supabase) {
        const { data, error } = await supabase
            .from("hackathons")
            .select("id, title, tags, prize_pool, deadline")
            .order("deadline", { ascending: true });

        if (!error && data && data.length > 0) {
            hackathons = data;
        }
    }

    if (hackathons.length === 0) {
        try {
            const live = await getLiveHackathons();
            hackathons = live.hackathons.map(h => ({
                id: h.id, title: h.title, tags: h.tags, prize_pool: h.prize_pool, deadline: h.deadline,
            }));
        } catch { /* ignore */ }
    }

    const relevance = calculateRelevance(hackathons);
    return NextResponse.json(relevance);
}
