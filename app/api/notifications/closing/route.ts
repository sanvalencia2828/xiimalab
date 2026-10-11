import { NextResponse } from "next/server";
import { getClosingNotifications } from "@/lib/notifications/closing";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications/closing
 * Hackatones y bounties que cierran en las próximas 72 h con match > 50 %.
 * Lee los snapshots de Supabase; sin Supabase o con el snapshot caducado usa
 * las fuentes en vivo. Responde { notifications, origin }.
 */
export async function GET() {
    try {
        return NextResponse.json(await getClosingNotifications(), {
            headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
        });
    } catch (err) {
        console.error("[/api/notifications/closing]", err instanceof Error ? err.message : err);
        return NextResponse.json({ notifications: [], origin: "none" });
    }
}
