/**
 * lib/match/sse.ts
 * Eventos del stream de /api/match (text/event-stream), compartidos por la
 * ruta, que los escribe, y el modal, que los lee con fetch + ReadableStream
 * (EventSource no sirve: la petición es un POST).
 */

/** Campos del análisis que ya llegaron; se van completando con cada evento "partial". */
export interface MatchPartial {
    match_score?: number;
    matching_skills?: string[];
    missing_skills?: string[];
    recommendation?: string;
}

export interface MatchStreamResult {
    match_score: number;
    matching_skills: string[];
    missing_skills: string[];
    recommendation: string;
    model_used: string;
}

export type MatchStreamEvent =
    | { event: "meta"; data: { cached: false; model: string } }
    | { event: "partial"; data: MatchPartial }
    | { event: "done"; data: MatchStreamResult }
    | { event: "error"; data: { message: string } };

export function encodeSseEvent({ event, data }: MatchStreamEvent): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Deja solo los campos del análisis con el tipo esperado. */
export function toMatchPartial(value: unknown): MatchPartial {
    if (!value || typeof value !== "object") return {};
    const obj = value as Record<string, unknown>;
    const strings = (v: unknown): string[] | undefined =>
        Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "") : undefined;
    const partial: MatchPartial = {};
    if (typeof obj.match_score === "number" && Number.isFinite(obj.match_score)) {
        partial.match_score = Math.min(100, Math.max(0, Math.round(obj.match_score)));
    }
    const matching = strings(obj.matching_skills);
    if (matching) partial.matching_skills = matching;
    const missing = strings(obj.missing_skills);
    if (missing) partial.missing_skills = missing;
    if (typeof obj.recommendation === "string" && obj.recommendation) partial.recommendation = obj.recommendation;
    return partial;
}

/**
 * Lector incremental: recibe el texto tal como llega del body (los trozos
 * pueden cortar un evento por cualquier sitio) y entrega cada evento completo.
 * Los eventos desconocidos o con datos ilegibles se ignoran.
 */
export function createSseReader(onEvent: (event: MatchStreamEvent) => void): (chunk: string) => void {
    let buffer = "";
    return (chunk) => {
        buffer += chunk.replace(/\r\n/g, "\n");
        let end: number;
        while ((end = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            let name = "";
            const data: string[] = [];
            for (const line of block.split("\n")) {
                if (line.startsWith("event:")) name = line.slice(6).trim();
                else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
            }
            if (!["meta", "partial", "done", "error"].includes(name) || data.length === 0) continue;
            try {
                onEvent({ event: name, data: JSON.parse(data.join("\n")) } as MatchStreamEvent);
            } catch { /* datos ilegibles: se ignora el evento */ }
        }
    };
}
