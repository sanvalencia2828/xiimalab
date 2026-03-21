import { NextRequest, NextResponse } from "next/server";

// Forzar renderizado dinámico — nunca pre-renderizar en build (no hay FastAPI en Vercel)
export const dynamic = "force-dynamic";

const API_URL = ""; // FastAPI not used in Vercel

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") ?? "all";
    const limit = searchParams.get("limit") ?? "30";

    const params = new URLSearchParams({ limit });
    if (source !== "all") params.set("source", source);

    try {
        const res = await fetch(`${API_URL}/hackathons/?${params}`, {
            next: { revalidate: 300 },
        });

        if (!res.ok) {
            throw new Error(`Upstream API error: ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error("[/api/hackathons] Failed to fetch from API:", err);

        // Filter the fallback by source so the UI behaves consistently
        const fallback =
            source === "all"
                ? FALLBACK_HACKATHONS
                : FALLBACK_HACKATHONS.filter((h) => h.source === source);

        return NextResponse.json(fallback, {
            headers: { "X-Data-Source": "fallback" },
        });
    }
}

// Fallback data — snake_case para coincidir con lib/types.ts Hackathon
const FALLBACK_HACKATHONS = [
    { id: "h1", title: "Stellar Build Challenge 2026",  prize_pool: 50000,  tags: ["Stellar", "DeFi", "Cross-chain"],         deadline: "2026-06-15", match_score: 88, source: "dorahacks", source_url: "https://dorahacks.io/hackathon", missing_skills: [], project_highlight: "" },
    { id: "h2", title: "Avalanche Summit Hackathon",    prize_pool: 75000,  tags: ["Avalanche", "NFT", "Smart Contracts"],    deadline: "2026-07-02", match_score: 74, source: "dorahacks", source_url: "https://dorahacks.io/hackathon", missing_skills: [], project_highlight: "" },
    { id: "h3", title: "AI x Web3 Global Sprint",       prize_pool: 30000,  tags: ["AI", "Web3", "Python", "Blockchain"],     deadline: "2026-05-28", match_score: 95, source: "devfolio",  source_url: "https://devfolio.co",             missing_skills: [], project_highlight: "" },
    { id: "h4", title: "DoraHacks Open Track Q2",       prize_pool: 100000, tags: ["Open Track", "Innovation", "AI"],         deadline: "2026-08-10", match_score: 81, source: "dorahacks", source_url: "https://dorahacks.io/hackathon", missing_skills: [], project_highlight: "" },
    { id: "h5", title: "ETHIndia 2026",                 prize_pool: 60000,  tags: ["Blockchain", "Web3", "AI"],               deadline: "2026-09-01", match_score: 79, source: "devfolio",  source_url: "https://devfolio.co",             missing_skills: [], project_highlight: "" },
    { id: "h6", title: "Devfolio Hackathon Series",     prize_pool: 25000,  tags: ["Innovation", "Open Track"],               deadline: "2026-06-20", match_score: 72, source: "devfolio",  source_url: "https://devfolio.co",             missing_skills: [], project_highlight: "" },
];
