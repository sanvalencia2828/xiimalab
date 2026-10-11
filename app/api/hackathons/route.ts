import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/api";
import { getLiveHackathons } from "@/lib/hackathons/live";
import type { AggregatedHackathon } from "@/lib/types";

// Forzar renderizado dinámico — nunca pre-renderizar en build
export const dynamic = "force-dynamic";

/**
 * GET /api/hackathons?source=all|dorahacks|devpost|devfolio&limit=30
 *
 * Devuelve SIEMPRE un array plano de hackatones (los consumidores —
 * ProjectHackathonPanel, insights, market — esperan un array).
 *
 * Orden de fuentes:
 *   1. FastAPI (si NEXT_PUBLIC_API_URL / INTERNAL_API_URL está configurado)
 *   2. Agregador en vivo: DoraHacks + Devpost + Devfolio (lib/hackathons/live.ts)
 *   3. Lista vacía si ninguna fuente responde
 *
 * ?count=1 devuelve solo { count } con el total de abiertas.
 * Añade ?debug=1 para ver el estado y el tiempo de respuesta (ms) de cada fuente.
 * En desarrollo, o con &token=DEBUG_TOKEN, debug además salta la caché.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") ?? "all";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "30") || 30, 1), 500);
    const debug = searchParams.get("debug") === "1";

    // ?count=1 → total de hackatones abiertas (mismo número que la página /hackathons y el menú)
    if (searchParams.get("count") === "1") {
        const live = await getLiveHackathons();
        return NextResponse.json(
            { count: live.hackathons.length },
            { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1800" } },
        );
    }

    const bySource = (list: AggregatedHackathon[]) =>
        source === "all"
            ? list
            : list.filter((h) => h.source === source || h.source_metadata?.sources?.includes(source));

    // 1. FastAPI
    const apiBase = getApiBase();
    if (apiBase) {
        try {
            const params = new URLSearchParams({ limit: String(limit) });
            if (source !== "all") params.set("source", source);
            const res = await fetch(`${apiBase}/hackathons/?${params}`, {
                signal: AbortSignal.timeout(5000),
                next: { revalidate: 300 },
            });
            if (res.ok) {
                const data: unknown = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    return NextResponse.json(data, { headers: { "X-Hackathon-Source": "fastapi" } });
                }
            }
        } catch (err) {
            console.warn("[/api/hackathons] FastAPI no disponible:", err instanceof Error ? err.message : err);
        }
    }

    // 2. Agregador en vivo
    // debug salta la caché (ms reales de esta petición) solo en desarrollo o con ?token=DEBUG_TOKEN
    const debugToken = process.env.DEBUG_TOKEN;
    const canBypassCache =
        process.env.NODE_ENV === "development" || (Boolean(debugToken) && searchParams.get("token") === debugToken);
    const live = await getLiveHackathons({ force: debug && canBypassCache });
    const list = bySource(live.hackathons).slice(0, limit);

    if (debug) {
        return NextResponse.json({ sources: live.sources, fetched_at: live.fetched_at, count: list.length, hackathons: list });
    }
    if (list.length > 0) {
        return NextResponse.json(list, {
            headers: {
                "X-Hackathon-Source": "live",
                "Cache-Control": "s-maxage=600, stale-while-revalidate=1800",
            },
        });
    }

    // 3. Sin datos reales: lista vacía (la UI muestra su estado vacío en vez de hackatones inventadas)
    return NextResponse.json([], { headers: { "X-Hackathon-Source": "none" } });
}
