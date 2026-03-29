import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export interface DevfolioHackathon {
    id: string;
    title: string;
    prizePool: number;
    tags: string[];
    deadline: string;
    url: string;
}

const FALLBACK: DevfolioHackathon[] = [
    { id: "df1", title: "AI & ML Global Hackathon", prizePool: 50000, tags: ["Python", "AI", "ML", "FastAPI"], deadline: "2026-07-01", url: "https://devfolio.co" },
    { id: "df2", title: "Web3 Innovation Sprint", prizePool: 75000, tags: ["Blockchain", "Solidity", "Stellar", "Avalanche"], deadline: "2026-06-20", url: "https://devfolio.co" },
    { id: "df3", title: "Cloud Native DevOps Challenge", prizePool: 30000, tags: ["Docker", "Kubernetes", "CI/CD"], deadline: "2026-08-10", url: "https://devfolio.co" },
    { id: "df4", title: "Data Analytics Buildathon", prizePool: 25000, tags: ["Python", "Pandas", "SQL", "Tableau"], deadline: "2026-07-15", url: "https://devfolio.co" },
];

export async function GET() {
    // Read from Supabase — no Docker/FastAPI needed
    if (!supabase) {
        return NextResponse.json(FALLBACK);
    }

    try {
        const { data, error } = await supabase
            .from("hackathons")
            .select("id, title, prize_pool, tags, deadline, source_url")
            .eq("source", "devfolio")
            .order("deadline", { ascending: true })
            .limit(50);

        if (error || !data || data.length === 0) {
            return NextResponse.json(FALLBACK);
        }

        const hackathons: DevfolioHackathon[] = data.map((h) => ({
            id: h.id,
            title: h.title,
            prizePool: h.prize_pool ?? 0,
            tags: Array.isArray(h.tags) ? h.tags : [],
            deadline: h.deadline ?? "",
            url: h.source_url ?? "https://devfolio.co",
        }));

        return NextResponse.json(hackathons);
    } catch {
        return NextResponse.json(FALLBACK);
    }
}

