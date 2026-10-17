/**
 * lib/markets/lend.ts — SERVER ONLY
 * Mercados de préstamo de Backpack Lend (API pública, sin login), con caché de 5 min:
 *
 *   GET https://api.backpack.exchange/api/v1/borrowLend/markets
 *
 * Las tasas llegan como strings decimales anuales (0.01 = 1 %). Se excluyen las
 * acciones tokenizadas (símbolos "*.US"): solo interesan las criptos.
 */
import { unstable_cache } from "next/cache";

const LEND_URL = "https://api.backpack.exchange/api/v1/borrowLend/markets";
const TIMEOUT_MS = 12_000;
const CACHE_TTL_S = 300;

export type LendState = "Open" | "RepayOnly";

export interface LendMarket {
    symbol: string;
    state: LendState;
    /** Tasas anuales en fracción: 0.01 = 1 % */
    lendApr: number;
    borrowApr: number;
    /** 0–1 */
    utilization: number;
    lentQuantity: number;
    borrowedQuantity: number;
    markPrice: number;
    lentUsd: number;
    borrowedUsd: number;
    timestamp: string | null;
}

export interface LendResult {
    markets: LendMarket[];
    ok: boolean;
    error: string | null;
    fetched_at: string;
}

// ── Parser (puro, testeable) ────────────────────────────────────────────────
type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** "0.0123" o 0.0123 → número; null si no es un número finito. */
function dec(v: unknown): number | null {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
}

/** Acciones tokenizadas de Backpack (SPCX.US, MU.US…). */
export function isTokenizedStock(symbol: string): boolean {
    return /\.US$/i.test(symbol);
}

export function parseLendMarkets(raw: unknown): LendMarket[] {
    if (!Array.isArray(raw)) return [];
    const out: LendMarket[] = [];
    for (const r of raw) {
        if (!isObj(r)) continue;
        const symbol = typeof r.symbol === "string" ? r.symbol.trim() : "";
        if (!symbol || isTokenizedStock(symbol)) continue;
        const state: LendState = r.state === "RepayOnly" ? "RepayOnly" : "Open";
        const lendApr = dec(r.lendInterestRate);
        const borrowApr = dec(r.borrowInterestRate);
        const utilization = dec(r.utilization);
        const lentQuantity = dec(r.lentQuantity) ?? 0;
        const borrowedQuantity = dec(r.borrowedQuantity) ?? 0;
        const markPrice = dec(r.assetMarkPrice) ?? 0;
        if (lendApr === null || borrowApr === null || utilization === null) continue;
        out.push({
            symbol,
            state,
            lendApr,
            borrowApr,
            utilization,
            lentQuantity,
            borrowedQuantity,
            markPrice,
            lentUsd: lentQuantity * markPrice,
            borrowedUsd: borrowedQuantity * markPrice,
            timestamp: typeof r.timestamp === "string" ? r.timestamp : null,
        });
    }
    return out;
}

// ── Red ─────────────────────────────────────────────────────────────────────
async function load(): Promise<LendResult> {
    const res = await fetch(LEND_URL, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`Backpack borrowLend/markets HTTP ${res.status}`);
    const markets = parseLendMarkets(await res.json());
    // Una respuesta vacía no se cachea: lanzar hace que el siguiente intento vuelva a consultar
    if (markets.length === 0) throw new Error("Backpack borrowLend/markets sin mercados");
    return { markets, ok: true, error: null, fetched_at: new Date().toISOString() };
}

const cachedLoad = unstable_cache(load, ["backpack-lend-markets-v1"], { revalidate: CACHE_TTL_S, tags: ["backpack-lend"] });

/** Mercados de Backpack Lend; si Backpack no responde, lista vacía con ok=false. */
export async function getLendMarkets(): Promise<LendResult> {
    try {
        return await cachedLoad();
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.warn("[lend] Backpack Lend no disponible:", error);
        return { markets: [], ok: false, error, fetched_at: new Date().toISOString() };
    }
}
