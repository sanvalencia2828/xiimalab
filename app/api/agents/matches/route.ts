/**
 * /api/agents/matches
 * Devuelve project_hackathon_matches para el dashboard.
 * Fallback a demo data si FastAPI no está disponible.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Demo data — visible sin backend ──────────────────────────────
const DEMO_MATCHES = [
    {
        project_id:      "aura-v1",
        project_title:   "AURA",
        project_status:  "active",
        hackathon_id:    "demo-cv-sprint",
        hackathon_title: "AI x Computer Vision Global Sprint 2026",
        match_pct:       92,
        shared_tags:     ["Python", "Computer Vision", "AI"],
        reasoning:       "Esta hackatón premia el procesamiento de imágenes, tu fuerte. Stack compartido: Python, OpenCV, AI.",
        prize_pool:      100000,
        source:          "devfolio",
        source_url:      "https://devfolio.co/hackathons",
        match_status:    "new",
        rank:            1,
    },
    {
        project_id:      "xiimalab-platform",
        project_title:   "Xiimalab",
        project_status:  "in-development",
        hackathon_id:    "demo-stellar",
        hackathon_title: "Stellar Build Challenge 2026",
        match_pct:       88,
        shared_tags:     ["Stellar", "Blockchain", "TypeScript"],
        reasoning:       "Tu integración con Stellar Testnet y el Payout Oracle son exactamente lo que buscan. Premio: $50,000.",
        prize_pool:      50000,
        source:          "devfolio",
        source_url:      "https://devfolio.co/hackathons",
        match_status:    "new",
        rank:            1,
    },
    {
        project_id:      "redimension-ai",
        project_title:   "RedimensionAI",
        project_status:  "completed",
        hackathon_id:    "demo-ai-web3",
        hackathon_title: "Amazon Nova AI Hackathon",
        match_pct:       74,
        shared_tags:     ["Python", "AI", "Docker"],
        reasoning:       "Tu optimizador de imágenes es un caso de uso real de AI en producción. Perfecto para demostrar impacto.",
        prize_pool:      30000,
        source:          "devpost",
        source_url:      "https://amazon-nova.devpost.com/",
        match_status:    "new",
        rank:            1,
    },
];

export async function GET(req: NextRequest) {
    const project_id = req.nextUrl.searchParams.get("project_id");

    try {
        const params = new URLSearchParams({ limit: "10" });
        if (project_id) params.set("project_id", project_id);

        const res = await fetch(`${API}/agents/matches?${params}`, {
            signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length) return NextResponse.json(data);
        }
    } catch { /* FastAPI no disponible */ }

    // Filtrar demo data si se pidió un proyecto específico
    const demo = project_id
        ? DEMO_MATCHES.filter(m => m.project_id === project_id)
        : DEMO_MATCHES;

    return NextResponse.json(demo);
}
