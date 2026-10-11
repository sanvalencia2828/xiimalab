import { NextRequest, NextResponse } from "next/server";
import { getSuperteamBounties } from "@/lib/bounties/superteam";

export const dynamic = "force-dynamic";

/**
 * GET /api/bounties?limit=100
 *
 * Devuelve un array plano de bounties abiertos de Superteam Earn
 * (lib/bounties/superteam.ts), o [] si la fuente no responde.
 *
 * Añade ?debug=1 para ver el estado y el tiempo de respuesta (ms) de la fuente.
 * En desarrollo, o con &token=DEBUG_TOKEN, debug además salta la caché.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "100") || 100, 1), 500);
    const debug = searchParams.get("debug") === "1";

    const debugToken = process.env.DEBUG_TOKEN;
    const canBypassCache =
        process.env.NODE_ENV === "development" || (Boolean(debugToken) && searchParams.get("token") === debugToken);

    const result = await getSuperteamBounties({ force: debug && canBypassCache });
    const list = result.bounties.slice(0, limit);

    if (debug) {
        return NextResponse.json({
            sources: result.sources,
            devKnown: result.devKnown,
            fetched_at: result.fetched_at,
            count: list.length,
            bounties: list,
        });
    }
    if (list.length > 0) {
        return NextResponse.json(list, {
            headers: {
                "X-Bounty-Source": "superteam",
                "Cache-Control": "s-maxage=600, stale-while-revalidate=1800",
            },
        });
    }
    return NextResponse.json([], { headers: { "X-Bounty-Source": "none" } });
}
