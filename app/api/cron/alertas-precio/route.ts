import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/alerts/cmc";
import { WATCHED_ASSETS } from "@/lib/alerts/config";
import { emptyStore, runAlerts, supabaseStore } from "@/lib/alerts/run";
import { notify } from "@/lib/alerts/telegram";

export const dynamic = "force-dynamic";

/** Comparación en tiempo constante; el hash iguala las longitudes. */
function validSecret(header: string | null, secret: string): boolean {
    const sha = (v: string) => createHash("sha256").update(v).digest();
    return timingSafeEqual(sha(header ?? ""), sha(`Bearer ${secret}`));
}

/**
 * GET /api/cron/alertas-precio[?dry_run=1]
 *
 * Una pasada de alertas de precio. La llama el workflow de GitHub Actions
 * (.github/workflows/alertas-precio.yml) cada 5 minutos con
 * `Authorization: Bearer $CRON_SECRET`; cualquier otra llamada se rechaza.
 *
 * dry_run=1 consulta CoinMarketCap y calcula las alertas, pero no envía
 * mensajes ni escribe en Supabase.
 */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret || !validSecret(request.headers.get("authorization"), secret)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const dryRun = new URL(request.url).searchParams.get("dry_run") === "1";
    const apiKey = process.env.CMC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "CMC_API_KEY no configurada" }, { status: 500 });

    // Sin dónde guardar el estado se avisaría en cada ejecución: solo se permite en dry-run
    const store = supabaseStore() ?? (dryRun ? emptyStore : null);
    if (!store) {
        return NextResponse.json({ error: "Supabase no configurado (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
    }

    try {
        const quotes = await fetchQuotes(
            WATCHED_ASSETS.map((a) => a.id),
            apiKey,
        );
        const summary = await runAlerts({ quotes, store, send: (text) => notify(text), dryRun });
        return NextResponse.json(summary, { status: summary.errors.length > 0 ? 502 : 200 });
    } catch (err) {
        console.error("[alertas-precio]", err instanceof Error ? err.message : err);
        return NextResponse.json({ error: err instanceof Error ? err.message : "Error inesperado" }, { status: 502 });
    }
}
