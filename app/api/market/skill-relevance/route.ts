import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLiveHackathons } from "@/lib/hackathons/live";
import { calculateRelevance } from "@/lib/market/relevance";

export const dynamic = "force-dynamic";

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
