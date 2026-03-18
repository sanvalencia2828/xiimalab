import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Forzar renderizado dinámico — nunca pre-renderizar en build (no hay FastAPI en Vercel)
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

<<<<<<< HEAD
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") ?? "all";

    try {
        const upstreamUrl = `${API_URL}/hackathons/?source=${source}&limit=30`;
        const res = await fetch(upstreamUrl, {
            cache: "no-store", // always fresh for filtered queries
=======
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") ?? "all";
    const limit = searchParams.get("limit") ?? "30";

    const params = new URLSearchParams({ limit });
    if (source !== "all") params.set("source", source);

    try {
        const res = await fetch(`${API_URL}/hackathons/?${params}`, {
            next: { revalidate: 300 },
>>>>>>> 818308f5dd3f39122c8e46bc57ee372d2f05d9ba
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

// Mirrors the hardcoded data — used when the API is down
const FALLBACK_HACKATHONS = [
    { id: "h1", title: "Stellar Build Challenge 2026", prizePool: 50000, tags: ["Stellar", "DeFi", "Cross-chain"], deadline: "2026-06-15", matchScore: 88, source: "dorahacks", url: "https://dorahacks.io/hackathon" },
    { id: "h2", title: "Avalanche Summit Hackathon", prizePool: 75000, tags: ["Avalanche", "NFT", "Smart Contracts"], deadline: "2026-07-02", matchScore: 74, source: "dorahacks", url: "https://dorahacks.io/hackathon" },
    { id: "h3", title: "AI x Web3 Global Sprint", prizePool: 30000, tags: ["AI", "Web3", "Python", "Blockchain"], deadline: "2026-05-28", matchScore: 95, source: "devfolio", url: "https://devfolio.co" },
    { id: "h4", title: "DoraHacks Open Track Q2", prizePool: 100000, tags: ["Open Track", "Innovation", "AI"], deadline: "2026-08-10", matchScore: 81, source: "dorahacks", url: "https://dorahacks.io/hackathon" },
    { id: "h5", title: "ETHIndia 2026", prizePool: 60000, tags: ["Blockchain", "Web3", "AI"], deadline: "2026-09-01", matchScore: 79, source: "devfolio", url: "https://devfolio.co" },
    { id: "h6", title: "Devfolio Hackathon Series", prizePool: 25000, tags: ["Innovation", "Open Track"], deadline: "2026-06-20", matchScore: 72, source: "devfolio", url: "https://devfolio.co" },
];
