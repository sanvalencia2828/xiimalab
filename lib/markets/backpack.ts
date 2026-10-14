/**
 * lib/markets/backpack.ts — SERVER ONLY
 * Estado de las acciones de la watchlist con las APIs públicas de Backpack
 * Exchange (las mismas que usa backpack.exchange/stocks/calendar, sin login):
 *
 *   GET https://api.backpack.exchange/wapi/v1/stocks/tickers            nombre, precio, market cap
 *   GET https://api.backpack.exchange/wapi/v1/stocks/snapshots          variación 1d/1w/1m/6m/1y/YTD
 *   GET https://api.backpack.exchange/wapi/v1/stocks/earningsCalendar   próximos resultados (from/to)
 *   GET https://api.backpack.exchange/api/v1/markets                    acciones operables en Backpack
 *
 * Las respuestas de tickers y snapshots pesan ~2–3 MB (todas las acciones de
 * EE. UU.), así que no pasan por la caché de fetch; se cachea solo el
 * resultado reducido a la watchlist.
 */
import { unstable_cache } from "next/cache";
import { WATCHLIST, type ThemeKey } from "@/lib/markets/watchlist";

const API = "https://api.backpack.exchange";
const TIMEOUT_MS = 12_000;
const CACHE_TTL_S = 300;
const EARNINGS_DAYS_AHEAD = 120;
const EARNINGS_WINDOW_DAYS = 30;

export interface AssetChanges {
    d1: number | null;
    w1: number | null;
    m1: number | null;
    m6: number | null;
    y1: number | null;
    ytd: number | null;
}

export interface NextEarnings {
    date: string;               // YYYY-MM-DD
    epsEstimated: number | null;
    revenueEstimated: number | null;
}

export interface MarketAsset {
    ticker: string;
    name: string;
    theme: ThemeKey;
    weight: number;
    why: string;
    price: number | null;
    marketCap: number | null;
    changes: AssetChanges;
    earnings: NextEarnings | null;
    backpack: { spot: boolean; perp: boolean; url: string };
}

export interface MarketAssetsResult {
    assets: MarketAsset[];
    ok: boolean;
    errors: string[];
    fetched_at: string;
}

// ── Parsers (puros, testeables) ─────────────────────────────────────────────
type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function num(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string {
    return typeof v === "string" ? v.trim() : "";
}

export interface TickerRow { ticker: string; name: string; price: number | null; marketCap: number | null }
export interface SnapshotRow { ticker: string; price: number | null; changes: AssetChanges }

export function parseTickers(raw: unknown, wanted: Set<string>): Map<string, TickerRow> {
    const out = new Map<string, TickerRow>();
    if (!Array.isArray(raw)) return out;
    for (const r of raw) {
        if (!isObj(r)) continue;
        const ticker = str(r.ticker);
        if (!wanted.has(ticker)) continue;
        out.set(ticker, { ticker, name: str(r.name) || ticker, price: num(r.price), marketCap: num(r.marketCap) });
    }
    return out;
}

export function parseSnapshots(raw: unknown, wanted: Set<string>): Map<string, SnapshotRow> {
    const out = new Map<string, SnapshotRow>();
    if (!Array.isArray(raw)) return out;
    for (const r of raw) {
        if (!isObj(r)) continue;
        const ticker = str(r.ticker);
        if (!wanted.has(ticker)) continue;
        const ch = isObj(r.intervalChanges) ? r.intervalChanges : {};
        const last = isObj(r.lastTrade) ? num(r.lastTrade.price) : null;
        const close = isObj(r.day) ? num(r.day.close) : null;
        out.set(ticker, {
            ticker,
            price: last ?? close,
            changes: { d1: num(ch["1d"]), w1: num(ch["1w"]), m1: num(ch["1m"]), m6: num(ch["6m"]), y1: num(ch["1y"]), ytd: num(ch.YTD) },
        });
    }
    return out;
}

/** Próximo resultado (fecha ≥ hoy) de cada ticker. */
export function parseEarnings(raw: unknown, wanted: Set<string>, today: string): Map<string, NextEarnings> {
    const out = new Map<string, NextEarnings>();
    if (!Array.isArray(raw)) return out;
    for (const r of raw) {
        if (!isObj(r)) continue;
        const ticker = str(r.symbol);
        const date = str(r.date).slice(0, 10);
        if (!wanted.has(ticker) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) continue;
        const prev = out.get(ticker);
        if (!prev || date < prev.date) {
            out.set(ticker, { date, epsEstimated: num(r.epsEstimated), revenueEstimated: num(r.revenueEstimated) });
        }
    }
    return out;
}

/** Tickers con mercado spot o perp en Backpack (baseSymbol "NVDA.US"). */
export function parseBackpackMarkets(raw: unknown): Map<string, { spot: boolean; perp: boolean }> {
    const out = new Map<string, { spot: boolean; perp: boolean }>();
    if (!Array.isArray(raw)) return out;
    for (const r of raw) {
        if (!isObj(r)) continue;
        const base = str(r.baseSymbol);
        if (!base.endsWith(".US")) continue;
        const ticker = base.slice(0, -3);
        const cur = out.get(ticker) ?? { spot: false, perp: false };
        if (r.marketType === "SPOT") cur.spot = true;
        if (r.marketType === "PERP") cur.perp = true;
        out.set(ticker, cur);
    }
    return out;
}

// ── Red ─────────────────────────────────────────────────────────────────────
async function getJson(path: string): Promise<unknown> {
    const res = await fetch(`${API}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`Backpack ${path.split("?")[0]} HTTP ${res.status}`);
    return res.json();
}

function addDays(iso: string, days: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

async function fetchEarnings(today: string): Promise<unknown[]> {
    const windows: [string, string][] = [];
    for (let start = 0; start < EARNINGS_DAYS_AHEAD; start += EARNINGS_WINDOW_DAYS) {
        windows.push([addDays(today, start), addDays(today, start + EARNINGS_WINDOW_DAYS - 1)]);
    }
    const parts = await Promise.all(
        windows.map(([from, to]) => getJson(`/wapi/v1/stocks/earningsCalendar?from=${from}&to=${to}`)),
    );
    return parts.flatMap((p) => (Array.isArray(p) ? p : []));
}

async function load(): Promise<MarketAssetsResult> {
    const wanted = new Set(WATCHLIST.map((s) => s.ticker));
    const today = new Date().toISOString().slice(0, 10);
    const errors: string[] = [];
    const settle = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
        try { return await p; } catch (e) { errors.push(e instanceof Error ? e.message : String(e)); return fallback; }
    };

    const [tickersRaw, snapshotsRaw, earningsRaw, marketsRaw] = await Promise.all([
        settle(getJson("/wapi/v1/stocks/tickers"), [] as unknown),
        settle(getJson("/wapi/v1/stocks/snapshots"), [] as unknown),
        settle(fetchEarnings(today), [] as unknown[]),
        settle(getJson("/api/v1/markets?marketType=SPOT&marketType=PERP"), [] as unknown),
    ]);

    const tickers = parseTickers(tickersRaw, wanted);
    const snaps = parseSnapshots(snapshotsRaw, wanted);
    const earnings = parseEarnings(earningsRaw, wanted, today);
    const markets = parseBackpackMarkets(marketsRaw);

    const assets: MarketAsset[] = WATCHLIST.map((w) => {
        const t = tickers.get(w.ticker);
        const s = snaps.get(w.ticker);
        const m = markets.get(w.ticker) ?? { spot: false, perp: false };
        const tradeSymbol = m.perp ? `${w.ticker}.US_USDC_PERP` : `${w.ticker}.US_USDC`;
        return {
            ticker: w.ticker,
            name: t?.name ?? w.ticker,
            theme: w.theme,
            weight: w.weight,
            why: w.why,
            price: s?.price ?? t?.price ?? null,
            marketCap: t?.marketCap ?? null,
            changes: s?.changes ?? { d1: null, w1: null, m1: null, m6: null, y1: null, ytd: null },
            earnings: earnings.get(w.ticker) ?? null,
            backpack: {
                ...m,
                url: m.spot || m.perp
                    ? `https://backpack.exchange/trade/${tradeSymbol}`
                    : `https://backpack.exchange/stocks/${w.ticker}`,
            },
        };
    });

    return {
        assets,
        ok: assets.some((a) => a.price !== null),
        errors,
        fetched_at: new Date().toISOString(),
    };
}

const cachedLoad = unstable_cache(load, ["backpack-market-assets-v1"], {
    revalidate: CACHE_TTL_S,
    tags: ["market-assets"],
});

export async function getMarketAssets(options: { force?: boolean } = {}): Promise<MarketAssetsResult> {
    if (options.force) return load();
    try {
        const r = await cachedLoad();
        // No dejar cacheado un resultado vacío
        return r.ok ? r : await load();
    } catch {
        return load();
    }
}
