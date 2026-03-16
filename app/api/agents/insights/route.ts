/**
 * /api/agents/insights
 * Proxy al FastAPI /agents/insights — con fallback a datos de demostración.
 * force-dynamic para evitar ECONNREFUSED en Vercel build.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status     = searchParams.get("status")     ?? "new";
  const project_id = searchParams.get("project_id") ?? "";
  const limit      = searchParams.get("limit")      ?? "20";

  try {
    const params = new URLSearchParams({ status, limit });
    if (project_id) params.set("project_id", project_id);

    const res = await fetch(`${API}/agents/insights?${params}`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // FastAPI no disponible — devolvemos demo data
  }

  // Demo insights cuando el backend no está disponible
  return NextResponse.json(DEMO_INSIGHTS);
}

export async function POST(req: NextRequest) {
  // Trigger manual del crew
  try {
    const res = await fetch(`${API}/agents/run`, {
      method: "POST",
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) return NextResponse.json(await res.json());
  } catch { /* fallback */ }
  return NextResponse.json({ status: "queued", message: "Backend no disponible" }, { status: 202 });
}

// ── Demo insights (se muestran cuando FastAPI no está corriendo) ──
const DEMO_INSIGHTS = [
  {
    id: 1,
    agent_name: "MatchOracle",
    insight_type: "opportunity",
    project_id: "aura-v1",
    hackathon_id: "devfolio-ai-2026",
    project_title: "AURA",
    hackathon_title: "AI x Computer Vision Global Sprint 2026",
    hackathon_source: "devfolio",
    title: "💡 AURA encaja con «AI x Computer Vision Global Sprint 2026»",
    summary: "AURA (active) tiene un 91% de afinidad con esta hackatón. Tu motor de IA para imágenes es exactamente lo que buscan.",
    reasoning: "Tecnologías compartidas: Python, OpenCV, AI. Premio: $100,000. Afinidad muy alta — el stack del proyecto cubre la mayoría de requisitos.",
    action_url: "https://devfolio.co/hackathons",
    relevance_score: 91,
    match_pct: 91,
    status: "new",
    created_at: new Date().toISOString(),
    agent_metadata: { prize_pool: 100000, source: "devfolio", hack_tags: ["AI", "Python", "Computer Vision"] },
  },
  {
    id: 2,
    agent_name: "MatchOracle",
    insight_type: "opportunity",
    project_id: "xiimalab-platform",
    hackathon_id: "devfolio-stellar",
    project_title: "Xiimalab",
    hackathon_title: "Stellar Build Challenge 2026",
    hackathon_source: "devfolio",
    title: "💡 Xiimalab encaja con «Stellar Build Challenge 2026»",
    summary: "Xiimalab (in-development) tiene un 88% de afinidad. Tu integración con Stellar Testnet es el core de esta hackatón.",
    reasoning: "Tecnologías compartidas: Stellar, Blockchain, TypeScript. Premio: $50,000. Tiempo disponible: 21 días.",
    action_url: "https://devfolio.co/hackathons",
    relevance_score: 88,
    match_pct: 88,
    status: "new",
    created_at: new Date().toISOString(),
    agent_metadata: { prize_pool: 50000, source: "devfolio", hack_tags: ["Stellar", "DeFi", "Blockchain"] },
  },
  {
    id: 3,
    agent_name: "MatchOracle",
    insight_type: "opportunity",
    project_id: "redimension-ai",
    hackathon_id: "devpost-web3",
    project_title: "RedimensionAI",
    hackathon_title: "Web3 + AI Hackathon — Devpost",
    hackathon_source: "devpost",
    title: "🎯 Oportunidad para RedimensionAI: «Web3 + AI Hackathon»",
    summary: "RedimensionAI (completed) tiene un 74% de afinidad. Podrías presentar el optimizador como caso de uso real de AI en producción.",
    reasoning: "Tecnologías compartidas: Python, Docker, AI. Premio: $30,000.",
    action_url: "https://devpost.com/hackathons",
    relevance_score: 74,
    match_pct: 74,
    status: "new",
    created_at: new Date().toISOString(),
    agent_metadata: { prize_pool: 30000, source: "devpost", hack_tags: ["AI", "Python", "Web3"] },
  },
];
