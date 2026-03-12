import { NextResponse } from "next/server";

// Forzar renderizado dinámico — nunca pre-renderizar en build (no hay FastAPI en Vercel)
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
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

        // Fallback to hardcoded stub so the UI never breaks
        return NextResponse.json(FALLBACK_HACKATHONS, {
            headers: { "X-Data-Source": "fallback" },
        });
    }
}

// Mirrors the hardcoded data in page.tsx — used when the API is down
const FALLBACK_HACKATHONS = [
    { id: "h1", title: "Stellar Build Challenge 2025", prizePool: 50000, tags: ["Stellar", "DeFi", "Cross-chain"], deadline: "2025-04-15", matchScore: 88 },
    { id: "h2", title: "Avalanche Summit Hackathon", prizePool: 75000, tags: ["Avalanche", "NFT", "Smart Contracts"], deadline: "2025-05-02", matchScore: 74 },
    { id: "h3", title: "AI x Web3 Global Sprint", prizePool: 30000, tags: ["AI", "Web3", "Python", "Blockchain"], deadline: "2025-04-28", matchScore: 95 },
    { id: "h4", title: "DoraHacks Open Track Q2", prizePool: 100000, tags: ["Open Track", "Innovation", "AI"], deadline: "2025-06-10", matchScore: 81 },
];
