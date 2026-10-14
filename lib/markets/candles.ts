/**
 * lib/markets/candles.ts
 * Plan de horas según las velas de la capitalización total del mercado cripto
 * (CRYPTOCAP:TOTAL de TradingView) en diario, semanal y mensual.
 *
 * Regla del usuario: cada vela vale 3 horas.
 *   · vela cerrada en positivo → esas horas son para ESTUDIAR
 *   · vela cerrada en negativo → esas horas son para CREAR UN PROYECTO
 * La vela diaria decide las horas de hoy, la semanal las de esta semana y la
 * mensual las de este mes. La vela en curso se muestra como adelanto.
 *
 * Fuente: escáner de TradingView (POST https://scanner.tradingview.com/global/scan),
 * el mismo que alimenta tradingview.com/symbols/CRYPTOCAP-TOTAL. No es una API
 * pública documentada: si deja de responder, la tarjeta muestra "sin datos".
 */

export const HOURS_PER_CANDLE = 3;
export const TOTAL_SYMBOL = "CRYPTOCAP:TOTAL";

export type Timeframe = "D" | "W" | "M";
export type Decision = "estudiar" | "proyecto" | "neutral";

export interface Candle {
    open: number;
    close: number;
    changePct: number;
}

export interface TimeframeCandles {
    timeframe: Timeframe;
    /** Última vela cerrada: decide las horas del periodo actual */
    closed: Candle | null;
    /** Vela en curso: adelanto de lo que decidiría si cerrara ahora */
    current: Candle | null;
}

export interface HoursPlanItem extends TimeframeCandles {
    decision: Decision;
    preview: Decision;
    hours: number;
}

export interface HoursPlan {
    items: HoursPlanItem[];
    study: number;
    project: number;
    marketCap: number | null;
}

// Columnas pedidas al escáner, en este orden
export const SCANNER_COLUMNS = [
    "close",
    "open", "open[1]", "close[1]",
    "open|1W", "open[1]|1W", "close[1]|1W",
    "open|1M", "open[1]|1M", "close[1]|1M",
] as const;

function candle(open: unknown, close: unknown): Candle | null {
    if (typeof open !== "number" || typeof close !== "number" || !Number.isFinite(open) || !Number.isFinite(close) || open <= 0) {
        return null;
    }
    return { open, close, changePct: ((close - open) / open) * 100 };
}

/** Respuesta del escáner → velas D/W/M (en curso y última cerrada). */
export function parseScanner(raw: unknown): { marketCap: number | null; frames: TimeframeCandles[] } | null {
    if (typeof raw !== "object" || raw === null) return null;
    const data = (raw as { data?: unknown }).data;
    if (!Array.isArray(data) || data.length === 0) return null;
    const d = (data[0] as { d?: unknown }).d;
    if (!Array.isArray(d) || d.length < SCANNER_COLUMNS.length) return null;
    const v = Object.fromEntries(SCANNER_COLUMNS.map((c, i) => [c, d[i]])) as Record<(typeof SCANNER_COLUMNS)[number], unknown>;
    const close = v.close;
    return {
        marketCap: typeof close === "number" ? close : null,
        frames: [
            { timeframe: "D", closed: candle(v["open[1]"], v["close[1]"]), current: candle(v.open, close) },
            { timeframe: "W", closed: candle(v["open[1]|1W"], v["close[1]|1W"]), current: candle(v["open|1W"], close) },
            { timeframe: "M", closed: candle(v["open[1]|1M"], v["close[1]|1M"]), current: candle(v["open|1M"], close) },
        ],
    };
}

export function decide(c: Candle | null): Decision {
    if (!c || c.close === c.open) return "neutral";
    return c.close > c.open ? "estudiar" : "proyecto";
}

export function buildHoursPlan(frames: TimeframeCandles[], marketCap: number | null = null): HoursPlan {
    const items = frames.map((f) => {
        const decision = decide(f.closed);
        return { ...f, decision, preview: decide(f.current), hours: decision === "neutral" ? 0 : HOURS_PER_CANDLE };
    });
    return {
        items,
        study: items.filter((i) => i.decision === "estudiar").reduce((s, i) => s + i.hours, 0),
        project: items.filter((i) => i.decision === "proyecto").reduce((s, i) => s + i.hours, 0),
        marketCap,
    };
}
