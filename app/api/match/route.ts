/**
 * POST /api/match
 * Análisis de match perfil × hackatón, directo contra la API de Anthropic
 * (lib/match/ai.ts). Ya no pasa por FastAPI.
 *
 *   • Sin ANTHROPIC_API_KEY → estimación por etiquetas (model_used: "heuristic-fallback").
 *   • Con API key → análisis con IA, 10 por IP y hora, caché de 24 h por hackatón + skills.
 *   • Si la IA falla o su respuesta no valida → error JSON { error }, nunca un resultado inventado.
 */
import { NextRequest, NextResponse } from "next/server";
import {
    MatchAnalysisError,
    MatchRequestSchema,
    getAiMatch,
    heuristicMatch,
    isAiMatchConfigured,
    normalizeMatchInput,
} from "@/lib/match/ai";
import { consume } from "@/lib/match/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function clientIp(req: NextRequest): string {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "El cuerpo de la petición no es JSON válido." }, { status: 400 });
    }

    const parsed = MatchRequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Faltan datos para el análisis: se necesitan tus skills y el título de la hackatón." },
            { status: 400 },
        );
    }
    const input = normalizeMatchInput(parsed.data);

    if (!isAiMatchConfigured()) {
        return NextResponse.json(heuristicMatch(input));
    }

    const limit = consume(`match:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.allowed) {
        const minutes = Math.max(1, Math.ceil(limit.retryAfterS / 60));
        return NextResponse.json(
            { error: `Has llegado al límite de ${RATE_LIMIT} análisis por hora. Vuelve a intentarlo en ${minutes} min.` },
            { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } },
        );
    }

    try {
        return NextResponse.json(await getAiMatch(input));
    } catch (err) {
        if (err instanceof MatchAnalysisError) {
            return NextResponse.json({ error: err.message }, { status: err.status });
        }
        console.error("[/api/match] Error inesperado:", err);
        return NextResponse.json({ error: "No se pudo completar el análisis." }, { status: 500 });
    }
}
