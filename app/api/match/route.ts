/**
 * POST /api/match
 * Análisis de match perfil × hackatón, directo contra la API de Anthropic
 * (lib/match/ai.ts). Ya no pasa por FastAPI.
 *
 *   • Sin ANTHROPIC_API_KEY → JSON con la estimación por etiquetas (model_used: "heuristic-fallback").
 *   • Análisis en caché (24 h por hackatón + skills) → JSON con el resultado; no cuenta para el límite.
 *   • Si no → stream de eventos SSE (text/event-stream), ver lib/match/sse.ts:
 *       meta    { cached: false, model }
 *       partial campos del análisis a medida que el modelo los escribe
 *       done    resultado completo y validado; solo entonces se guarda en caché
 *       error   { message } legible; nunca un resultado inventado
 *   • 10 llamadas al modelo por IP y hora: el límite se consume antes de abrir el stream (429 en JSON).
 *   • Si el cliente cierra la conexión, la llamada al modelo se aborta.
 */
import { NextRequest, NextResponse } from "next/server";
import {
    MATCH_MODEL,
    MatchAborted,
    MatchAnalysisError,
    MatchRequestSchema,
    heuristicMatch,
    isAiMatchConfigured,
    normalizeMatchInput,
    readCachedMatch,
    storeMatch,
    streamAiMatch,
} from "@/lib/match/ai";
import { consume } from "@/lib/match/rateLimit";
import { encodeSseEvent, type MatchStreamEvent } from "@/lib/match/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La llamada al modelo tiene 20 s de timeout y no se reintenta (lib/match/ai.ts)
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

    try {
        const cached = await readCachedMatch(input);
        if (cached) return NextResponse.json(cached);
    } catch (err) {
        console.error("[/api/match] No se pudo leer la caché:", err);
    }

    // El límite solo se consume cuando hay que llamar al modelo: las respuestas en caché no cuentan
    const limit = consume(`match:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.allowed) {
        const minutes = Math.max(1, Math.ceil(limit.retryAfterS / 60));
        return NextResponse.json(
            { error: `Has llegado al límite de ${RATE_LIMIT} análisis por hora. Vuelve a intentarlo en ${minutes} min.` },
            { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } },
        );
    }

    // Se aborta la llamada al modelo si el cliente cierra la conexión (request.signal) o cancela el body
    const abort = new AbortController();
    if (req.signal.aborted) abort.abort();
    else req.signal.addEventListener("abort", () => abort.abort(), { once: true });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: MatchStreamEvent) => {
                if (abort.signal.aborted) return;
                try {
                    controller.enqueue(encoder.encode(encodeSseEvent(event)));
                } catch { /* el cliente ya cerró el stream */ }
            };

            send({ event: "meta", data: { cached: false, model: MATCH_MODEL } });
            try {
                const analysis = await streamAiMatch(input, {
                    signal: abort.signal,
                    onPartial: (partial) => send({ event: "partial", data: partial }),
                });
                await storeMatch(input, analysis);
                send({ event: "done", data: { ...analysis, model_used: MATCH_MODEL } });
            } catch (err) {
                if (!(err instanceof MatchAborted)) {
                    if (!(err instanceof MatchAnalysisError)) console.error("[/api/match] Error inesperado:", err);
                    send({
                        event: "error",
                        data: { message: err instanceof MatchAnalysisError ? err.message : "No se pudo completar el análisis." },
                    });
                }
            } finally {
                try {
                    controller.close();
                } catch { /* ya cerrado */ }
            }
        },
        cancel() {
            abort.abort();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            // Sin buffering en proxies: cada evento debe llegar en cuanto se escribe
            "X-Accel-Buffering": "no",
        },
    });
}
