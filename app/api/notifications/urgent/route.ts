import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function sourceLabel(source: string | null): string {
    if (!source) return "";
    if (source === "dorahacks") return "DoraHacks";
    if (source === "devfolio") return "Devfolio";
    if (source === "devpost") return "Devpost";
    return source;
}

function sourceBadge(source: string | null): string {
    const label = sourceLabel(source);
    if (!label) return "";
    return ` · ${label}`;
}


function daysUntil(deadline: string): number {
    return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

export async function GET() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ notifications: [] });

    try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(url, key);
        const { data } = await supabase
            .from("hackathons")
            .select("id,title,deadline,prize_pool,source_url,match_score,source")
            .order("deadline", { ascending: true });

        const now = Date.now();
        const notifications: object[] = [];
        let n = 1;

        for (const h of data ?? []) {
            const days = daysUntil(h.deadline);
            if (days < 0) continue;

            if (days <= 1) {
                notifications.push({ id: n++, type: "urgency", hackathon_id: h.id, source: h.source,
                    message: `🚨 ¡${h.title} cierra ${days === 0 ? "HOY" : "mañana"}! No lo pierdas.${sourceBadge(h.source)}`,
                    source_url: h.source_url, created_at: new Date().toISOString(), is_read: false });
            } else if (days <= 3) {
                notifications.push({ id: n++, type: "urgency", hackathon_id: h.id, source: h.source,
                    message: `⚡ ${h.title} — quedan solo ${days} días.${sourceBadge(h.source)}`,
                    source_url: h.source_url, created_at: new Date().toISOString(), is_read: false });
            } else if (days <= 7) {
                notifications.push({ id: n++, type: "deadline", hackathon_id: h.id, source: h.source,
                    message: `⏰ ${h.title} cierra en ${days} días${h.prize_pool > 0 ? ` · $${h.prize_pool.toLocaleString()} en premios` : ""}.${sourceBadge(h.source)}`,
                    source_url: h.source_url, created_at: new Date().toISOString(), is_read: false });
            } else if ((h.match_score ?? 0) >= 90) {
                notifications.push({ id: n++, type: "high_match", hackathon_id: h.id, source: h.source,
                    message: `🎯 Match alto (${h.match_score}%) con ${h.title}${h.prize_pool > 0 ? ` · $${h.prize_pool.toLocaleString()}` : ""}.${sourceBadge(h.source)}`,
                    source_url: h.source_url, created_at: new Date(now - days * 86400000 / 2).toISOString(), is_read: false });
            }
        }

        return NextResponse.json({ notifications, count: notifications.length });
    } catch (e) {
        return NextResponse.json({ notifications: [], error: String(e) });
    }
}
