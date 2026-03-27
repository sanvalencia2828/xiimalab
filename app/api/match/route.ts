/**
 * POST /api/match
 * Proxy to FastAPI /api/v1/match/evaluate — falls back to heuristic scoring
 * when FastAPI is unavailable (Vercel production without Docker).
 */
import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const apiBase = getApiBase();

    // ── Try FastAPI first ──────────────────────────────────
    if (apiBase) {
        try {
            const res = await fetch(`${apiBase}/api/v1/match/evaluate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(12000),
            });
            if (res.ok) return NextResponse.json(await res.json());
        } catch { /* fall through to heuristic */ }
    }

    // ── Heuristic fallback (no FastAPI) ───────────────────
    const profile  = body.user_profile  ?? {};
    const hackathon = body.hackathon_data ?? {};

    const userSkills  = (profile.skills  ?? []).map((s: string) => s.toLowerCase());
    const hackTags    = (hackathon.tags   ?? []).map((t: string) => t.toLowerCase());

    const overlap     = hackTags.filter((t: string) => userSkills.includes(t));
    const missing     = hackTags.filter((t: string) => !userSkills.includes(t));
    const baseScore   = Math.min(95, 40 + overlap.length * 15 + (hackathon.prize_pool > 20000 ? 10 : 0));

    return NextResponse.json({
        match_score:     baseScore,
        matching_skills: overlap,
        missing_skills:  missing.slice(0, 4),
        recommendation:  overlap.length > 0
            ? `Destaca tu experiencia en ${overlap.slice(0, 2).join(" y ")} al aplicar.`
            : "Revisa los requisitos del hackatón y prepara un proyecto demo.",
        model_used: "heuristic-fallback",
    });
}
