import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FALLBACK = [
    { role_name: "AI/ML",         demand_score: 90, growth_percentage: "+12%" },
    { role_name: "Agents",        demand_score: 85, growth_percentage: "+18%" },
    { role_name: "Blockchain",    demand_score: 75, growth_percentage: "+8%"  },
    { role_name: "Data Analytics",demand_score: 82, growth_percentage: "+14%" },
    { role_name: "Web3 / DeFi",   demand_score: 70, growth_percentage: "+6%"  },
    { role_name: "Docker",        demand_score: 78, growth_percentage: "+5%"  },
];

export async function GET() {
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ success: true, trends: FALLBACK });
    }

    try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: hackathons } = await supabase
            .from("hackathons")
            .select("tags, match_score, prize_pool");

        if (!hackathons?.length) throw new Error("no data");

        const tagStats: Record<string, { count: number; totalPrize: number }> = {};
        for (const h of hackathons) {
            for (const tag of (h.tags ?? [])) {
                if (!tagStats[tag]) tagStats[tag] = { count: 0, totalPrize: 0 };
                tagStats[tag].count++;
                tagStats[tag].totalPrize += h.prize_pool ?? 0;
            }
        }

        const total = hackathons.length;
        const trends = Object.entries(tagStats)
            .map(([tag, s]) => ({
                role_name: tag,
                demand_score: Math.min(99, Math.round((s.count / total) * 100) + 40),
                growth_percentage: `+${Math.round(s.count * 3)}%`,
                avg_prize: Math.round(s.totalPrize / s.count),
            }))
            .sort((a, b) => b.demand_score - a.demand_score)
            .slice(0, 8);

        return NextResponse.json({ success: true, trends });
    } catch {
        return NextResponse.json({ success: true, trends: FALLBACK });
    }
}
