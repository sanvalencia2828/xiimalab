/**
 * lib/markets/tradingview.ts — SERVER ONLY
 * Velas de CRYPTOCAP:TOTAL desde el escáner de TradingView, con caché de 10 min.
 */
import { unstable_cache } from "next/cache";
import { SCANNER_COLUMNS, TOTAL_SYMBOL, buildHoursPlan, parseScanner, type HoursPlan } from "@/lib/markets/candles";

const SCANNER_URL = "https://scanner.tradingview.com/global/scan";

async function load(): Promise<HoursPlan | null> {
    const res = await fetch(SCANNER_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Origin: "https://www.tradingview.com",
            Referer: "https://www.tradingview.com/",
            "User-Agent": "Mozilla/5.0 (compatible; Xiimalab/1.0)",
        },
        body: JSON.stringify({ symbols: { tickers: [TOTAL_SYMBOL] }, columns: SCANNER_COLUMNS }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`TradingView scanner HTTP ${res.status}`);
    const parsed = parseScanner(await res.json());
    if (!parsed || parsed.frames.every((f) => !f.closed)) return null;
    return buildHoursPlan(parsed.frames, parsed.marketCap);
}

const cached = unstable_cache(load, ["tv-total-hours-plan-v1"], { revalidate: 600, tags: ["total-candles"] });

/** Plan de horas según las velas D/W/M de TOTAL; null si TradingView no responde. */
export async function getTotalHoursPlan(): Promise<HoursPlan | null> {
    try {
        return (await cached()) ?? (await load());
    } catch (err) {
        console.warn("[tradingview] TOTAL no disponible:", err instanceof Error ? err.message : err);
        return null;
    }
}
