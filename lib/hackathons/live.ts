/**
 * lib/hackathons/live.ts — SERVER ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 * Agregador en vivo de hackatones, sin FastAPI ni Supabase.
 * Llama directamente a las APIs públicas (JSON) de cada plataforma desde el
 * servidor de Next.js (Vercel), normaliza al tipo AggregatedHackathon,
 * elimina duplicados y calcula el match_score.
 *
 *   • DoraHacks → https://dorahacks.io/api/v1/hub/hackathons
 *   • Devpost   → https://devpost.com/api/hackathons?status[]=open
 *   • Devfolio  → https://api.devfolio.co/api/hackathons?is_open=true&limit=50
 *
 * Cada fuente falla de forma aislada: si una no responde, las otras siguen.
 * Las tres fuentes se piden en paralelo, cada una con SOURCE_BUDGET_MS.
 * Caché: una sola capa — unstable_cache sobre el resultado agregado
 * (CACHE_TTL_S); los fetch van con no-store. Nada en memoria del proceso,
 * así que se comparte entre instancias serverless.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { unstable_cache } from "next/cache";
import type { AggregatedHackathon } from "@/lib/types";
import { computeMatchScore } from "@/lib/hackathons/match";

export type LiveSource = "dorahacks" | "devpost" | "devfolio";

export interface SourceStatus {
    ok: boolean;
    count: number;
    /** Tiempo de respuesta de la fuente (todas sus páginas), en ms */
    ms: number;
    error?: string;
}

export interface LiveResult {
    hackathons: AggregatedHackathon[];
    sources: Record<LiveSource, SourceStatus>;
    fetched_at: string;
}

const CACHE_TTL_S = 600;             // 10 min del resultado agregado (unstable_cache)
const TIMEOUT_MS = 9000;            // por petición
const SOURCE_BUDGET_MS = 12000;      // total por fuente (todas sus páginas)

const HEADERS: Record<string, string> = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
};

// ── Utilidades ──────────────────────────────────────────────────────────────
type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string {
    return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}
function num(v: unknown): number {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const n = Number(v.replace(/[^0-9.]/g, ""));
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
}
function toIsoDate(d: Date | null): string {
    return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
}
function isUpcoming(isoDate: string): boolean {
    if (!isoDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    return isoDate >= today;
}
function uniq(list: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of list) {
        const k = t.toLowerCase();
        if (t && !seen.has(k)) {
            seen.add(k);
            out.push(t);
        }
    }
    return out;
}
function splitList(v: unknown): string[] {
    if (Array.isArray(v)) return v.map((x) => (isObj(x) ? str(x.name) : str(x))).filter(Boolean);
    if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
}

async function getJson(url: string, timeoutMs = TIMEOUT_MS): Promise<unknown> {
    const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store", // la única capa de caché es unstable_cache sobre el agregado
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

interface PageResult {
    items: AggregatedHackathon[];
    more: boolean;
}

/**
 * Recorre páginas en serie dentro de SOURCE_BUDGET_MS. Si se agota el tiempo o
 * falla una página posterior a la primera, devuelve lo acumulado; solo lanza
 * cuando no se obtuvo nada.
 */
async function collectPages(
    maxPages: number,
    fetchPage: (page: number, timeoutMs: number) => Promise<PageResult>,
): Promise<AggregatedHackathon[]> {
    const out: AggregatedHackathon[] = [];
    const startedAt = Date.now();
    for (let page = 1; page <= maxPages; page++) {
        const remaining = SOURCE_BUDGET_MS - (Date.now() - startedAt);
        if (remaining < 500) break;
        try {
            const { items, more } = await fetchPage(page, Math.min(TIMEOUT_MS, remaining));
            out.push(...items);
            if (!more) break;
        } catch (err) {
            if (out.length === 0) throw err;
            console.warn(`[live-hackathons] página ${page} falló, se devuelve lo acumulado:`, err instanceof Error ? err.message : err);
            break;
        }
    }
    return out;
}

function parseAll(list: unknown[], parse: (raw: unknown) => AggregatedHackathon | null): AggregatedHackathon[] {
    return list.map(parse).filter((h): h is AggregatedHackathon => h !== null);
}

function base(
    partial: Pick<AggregatedHackathon, "id" | "title" | "prize_pool" | "tags" | "deadline" | "source_url" | "source"> &
        Partial<AggregatedHackathon>,
    extraText = "",
): AggregatedHackathon {
    return {
        missing_skills: [],
        project_highlight: "",
        scraped_at: new Date().toISOString(),
        match_score: computeMatchScore(partial.title, partial.tags, extraText),
        source_metadata: {
            sources: [partial.source],
            primary_source: partial.source,
            source_urls: partial.source_url ? { [partial.source]: partial.source_url } : {},
            is_multi_source: false,
            source_confidence: 0.85,
        },
        ...partial,
    };
}

// ── DoraHacks ───────────────────────────────────────────────────────────────
// Campos verificados en services/api/services/dorahacks.py (commit 0bcc0c1)
export function parseDoraHacks(raw: unknown): AggregatedHackathon | null {
    if (!isObj(raw)) return null;
    const title = str(raw.title) || str(raw.name);
    if (!title) return null;
    const uname = str(raw.uname);
    const id = uname || str(raw.id);

    const endRaw = raw.timeline_end ?? raw.timeline_pre_register ?? raw.deadline ?? raw.end_time;
    let deadline = "";
    if (typeof endRaw === "number" || /^\d{9,13}$/.test(str(endRaw))) {
        let ts = Number(endRaw);
        if (ts < 1e12) ts *= 1000; // epoch en segundos
        deadline = toIsoDate(new Date(ts));
    } else if (str(endRaw)) {
        deadline = toIsoDate(new Date(str(endRaw)));
    }

    const tags = uniq([...splitList(raw.tags), ...splitList(raw.ecosystem)]).slice(0, 8);
    const owner = isObj(raw.owner) ? str(raw.owner.name) : "";
    const venue = str(raw.venue_form).toLowerCase();
    const prize_pool = Math.round(num(raw.bonus_price ?? raw.prize_pool ?? raw.prize));

    return base(
        {
            id: `dorahacks-${id || title.toLowerCase().replace(/\W+/g, "-")}`,
            title,
            prize_pool,
            prize_currency: prize_pool > 0 ? str(raw.bonus_token).toUpperCase() || null : null,
            tags,
            deadline,
            source_url: `https://dorahacks.io/hackathon/${uname || id}`,
            source: "dorahacks",
            organizer: owner || null,
            city: str(raw.venue_name) || null,
            event_type: venue.includes("online") || venue === "" ? "virtual" : venue,
            description: str(raw.brief || raw.description).slice(0, 500) || null,
        },
        str(raw.brief),
    );
}

async function fetchDoraHacks(): Promise<AggregatedHackathon[]> {
    return collectPages(3, async (page, timeoutMs) => {
        const data = await getJson(`https://dorahacks.io/api/v1/hub/hackathons?page=${page}&page_size=50`, timeoutMs);
        const results = isObj(data) && Array.isArray(data.results) ? data.results : [];
        return {
            items: parseAll(results, parseDoraHacks),
            more: isObj(data) && Boolean(data.next) && results.length > 0,
        };
    });
}

// ── Devpost ─────────────────────────────────────────────────────────────────
const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** "Aug 31 - Oct 23, 2026" · "Oct 01 - 23, 2026" · "Dec 15, 2026 - Jan 10, 2027" → "YYYY-MM-DD" */
export function parseDevpostEnd(period: string): string {
    if (!period) return "";
    const [startPart = "", endPart = ""] = period.split(/\s+-\s+/);
    const end = endPart || startPart;
    const yearM = end.match(/(\d{4})/) ?? period.match(/(\d{4})/);
    const year = yearM ? Number(yearM[1]) : new Date().getUTCFullYear();
    const monthM = end.match(/([A-Za-z]{3})[a-z]*/) ?? startPart.match(/([A-Za-z]{3})[a-z]*/);
    const dayM = end.replace(/\d{4}/, "").match(/(\d{1,2})/);
    if (!monthM || !dayM) return "";
    const month = MONTHS[monthM[1].toLowerCase()];
    if (month === undefined) return "";
    return toIsoDate(new Date(Date.UTC(year, month, Number(dayM[1]))));
}

// Símbolo o código que Devpost antepone al importe ("$", "₹ ", "€", "CA$"…). Los más largos primero.
const CURRENCY_PREFIXES: [string, string][] = [
    ["CA$", "CAD"], ["C$", "CAD"], ["A$", "AUD"], ["R$", "BRL"], ["MX$", "MXN"], ["S$", "SGD"],
    ["₹", "INR"], ["€", "EUR"], ["£", "GBP"], ["¥", "JPY"], ["$", "USD"],
];

/** "₹ 100,000" → "INR" · "$138,000" → "USD" · "CHF 5,000" → "CHF" · sin símbolo → null */
export function currencyFromPrizeText(text: string): string | null {
    const prefix = text.replace(/[0-9.,\s]/g, "").toUpperCase();
    if (!prefix) return null;
    const known = CURRENCY_PREFIXES.find(([symbol]) => prefix === symbol);
    if (known) return known[1];
    return /^[A-Z]{3}$/.test(prefix) ? prefix : null;
}

export function parseDevpost(raw: unknown): AggregatedHackathon | null {
    if (!isObj(raw)) return null;
    const title = str(raw.title);
    if (!title) return null;
    const prizeText = str(raw.prize_amount).replace(/<[^>]*>/g, "");
    const location = isObj(raw.displayed_location) ? str(raw.displayed_location.location) : "";
    const tags = splitList(raw.themes);
    const prize_pool = Math.round(num(prizeText));
    return base({
        id: `devpost-${str(raw.id) || title.toLowerCase().replace(/\W+/g, "-")}`,
        title,
        prize_pool,
        prize_currency: prize_pool > 0 ? currencyFromPrizeText(prizeText) : null,
        tags,
        deadline: parseDevpostEnd(str(raw.submission_period_dates)),
        source_url: str(raw.url) || "https://devpost.com/hackathons",
        source: "devpost",
        organizer: str(raw.organization_name) || null,
        city: location && location.toLowerCase() !== "online" ? location : null,
        event_type: location.toLowerCase() === "online" ? "virtual" : "in-person",
        participation_count_estimate: num(raw.registrations_count) || null,
    });
}

async function fetchDevpost(): Promise<AggregatedHackathon[]> {
    return collectPages(10, async (page, timeoutMs) => {
        const data = await getJson(`https://devpost.com/api/hackathons?status[]=open&page=${page}`, timeoutMs);
        const list = isObj(data) && Array.isArray(data.hackathons) ? data.hackathons : [];
        const meta = isObj(data) && isObj(data.meta) ? data.meta : {};
        const total = num(meta.total_count);
        const perPage = num(meta.per_page) || list.length;
        return {
            items: parseAll(list, parseDevpost),
            more: list.length > 0 && perPage > 0 && page * perPage < total,
        };
    });
}

// ── Devfolio ────────────────────────────────────────────────────────────────
const USD_LIKE = new Set(["USD", "USDC", "USDT", "$"]);
const DEVFOLIO_PAGE_SIZE = 50;

export function parseDevfolio(raw: unknown): AggregatedHackathon | null {
    if (!isObj(raw)) return null;
    const title = str(raw.name);
    if (!title) return null;
    const slug = str(raw.slug);
    const setting = isObj(raw.hackathon_setting) ? raw.hackathon_setting : {};
    const sub = str(setting.subdomain) || slug;

    const prizes = Array.isArray(raw.prizes) ? raw.prizes : [];
    const prize_pool = Math.round(
        prizes.reduce<number>((sum, p) => {
            if (!isObj(p) || p.hidden === true) return sum;
            if (!USD_LIKE.has(str(p.currency).toUpperCase())) return sum;
            return sum + num(p.amount) * Math.max(1, num(p.quantity));
        }, 0),
    );

    const tags = splitList(raw.themes).filter((t) => t.toLowerCase() !== "no restrictions");
    const endsAt = str(raw.ends_at);
    const city = [str(raw.city), str(raw.country)].filter(Boolean).join(", ");

    return base(
        {
            id: `devfolio-${str(raw.uuid) || slug}`,
            title,
            prize_pool,
            prize_currency: prize_pool > 0 ? "USD" : null, // solo se suman premios en USD/USDC/USDT
            tags,
            deadline: toIsoDate(endsAt ? new Date(endsAt) : null),
            source_url: sub ? `https://${sub}.devfolio.co/` : "https://devfolio.co/hackathons",
            source: "devfolio",
            city: city || null,
            event_type: raw.is_online === true ? "virtual" : setting.is_hybrid === true ? "hybrid" : "in-person",
            description: str(raw.tagline) || null,
            participation_count_estimate: num(raw.participants_count) || null,
        },
        str(raw.tagline),
    );
}

async function fetchDevfolio(): Promise<AggregatedHackathon[]> {
    // El tamaño de página es `limit`: la API ignora `per_page` y devuelve 1000 items (~7 MB, >10 s).
    // Viene ordenada por cierre descendente, así que una página sin eventos vigentes es la última útil.
    return collectPages(4, async (page, timeoutMs) => {
        const data = await getJson(
            `https://api.devfolio.co/api/hackathons?is_open=true&page=${page}&limit=${DEVFOLIO_PAGE_SIZE}`,
            timeoutMs,
        );
        const list = isObj(data) && Array.isArray(data.result) ? data.result : [];
        const items = parseAll(list, parseDevfolio);
        return {
            items,
            more: list.length >= DEVFOLIO_PAGE_SIZE && items.some((h) => isUpcoming(h.deadline)),
        };
    });
}

// ── Agregador ───────────────────────────────────────────────────────────────
const FETCHERS: Record<LiveSource, () => Promise<AggregatedHackathon[]>> = {
    dorahacks: fetchDoraHacks,
    devpost: fetchDevpost,
    devfolio: fetchDevfolio,
};

// RegExp por constructor: el tsconfig no fija target y los literales con \p{…}/u exigen ES2018
const NON_ALNUM = new RegExp("[^\\p{L}\\p{N}]", "gu");

/** Clave de comparación: Unicode normalizado, sin año ni símbolos (conserva letras de cualquier alfabeto). */
function titleKey(t: string): string {
    return t.normalize("NFKC").toLowerCase().replace(/20\d\d/g, "").replace(NON_ALNUM, "");
}

/** Une duplicados entre plataformas (mismo título) y marca las fuentes. */
function dedupe(list: AggregatedHackathon[]): AggregatedHackathon[] {
    const map = new Map<string, AggregatedHackathon>();
    for (const h of list) {
        // Respaldo: un título solo de símbolos/año deja la clave vacía → se usa el id
        const key = titleKey(h.title) || h.id;
        const prev = map.get(key);
        if (!prev) {
            map.set(key, h);
            continue;
        }
        const prevSources = prev.source_metadata?.sources ?? [prev.source];
        // Mismo título en la misma plataforma = eventos distintos (ediciones), no un duplicado
        if (prevSources.includes(h.source)) {
            map.set(`${key}|${h.id}`, h);
            continue;
        }
        const sources = uniq([...prevSources, h.source]);
        map.set(key, {
            ...prev,
            prize_pool: Math.max(prev.prize_pool, h.prize_pool),
            prize_currency: h.prize_pool > prev.prize_pool ? h.prize_currency : prev.prize_currency,
            tags: uniq([...prev.tags, ...h.tags]).slice(0, 10),
            match_score: Math.max(prev.match_score, h.match_score),
            source_metadata: {
                ...prev.source_metadata,
                sources,
                source_urls: { ...prev.source_metadata?.source_urls, ...h.source_metadata?.source_urls },
                is_multi_source: sources.length > 1,
                source_confidence: Math.min(1, 0.7 + sources.length * 0.15),
            },
        });
    }
    return Array.from(map.values());
}

/** Consulta las tres fuentes en paralelo (sin caché del resultado agregado). */
async function aggregate(): Promise<LiveResult> {
    const names = Object.keys(FETCHERS) as LiveSource[];
    const elapsed = {} as Record<LiveSource, number>;
    const settled = await Promise.allSettled(
        names.map(async (n) => {
            const startedAt = Date.now();
            try {
                return await FETCHERS[n]();
            } finally {
                elapsed[n] = Date.now() - startedAt;
            }
        }),
    );

    const sources = {} as Record<LiveSource, SourceStatus>;
    const all: AggregatedHackathon[] = [];
    settled.forEach((r, i) => {
        const name = names[i];
        if (r.status === "fulfilled") {
            const open = r.value.filter((h) => isUpcoming(h.deadline));
            sources[name] = { ok: true, count: open.length, ms: elapsed[name] };
            all.push(...open);
        } else {
            const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
            sources[name] = { ok: false, count: 0, ms: elapsed[name], error: msg };
            console.warn(`[live-hackathons] ${name} falló: ${msg}`);
        }
    });

    const hackathons = dedupe(all).sort(
        (a, b) => b.match_score - a.match_score || a.deadline.localeCompare(b.deadline),
    );
    return { hackathons, sources, fetched_at: new Date().toISOString() };
}

/** Un resultado vacío no se cachea: se lanza dentro de unstable_cache y se recupera fuera. */
class EmptyLiveResult extends Error {
    constructor(readonly value: LiveResult) {
        super("live hackathons: sin resultados");
    }
}

const cachedAggregate = unstable_cache(
    async (): Promise<LiveResult> => {
        const value = await aggregate();
        if (value.hackathons.length === 0) throw new EmptyLiveResult(value);
        return value;
    },
    ["live-hackathons"],
    { revalidate: CACHE_TTL_S, tags: ["live-hackathons"] },
);

/**
 * Hackatones abiertas de las tres fuentes. Con caché, `sources[*].ms` y
 * `fetched_at` son los de la última consulta real; `force` la salta.
 */
export async function getLiveHackathons(options: { force?: boolean } = {}): Promise<LiveResult> {
    if (options.force) return aggregate();
    try {
        return await cachedAggregate();
    } catch (err) {
        if (err instanceof EmptyLiveResult) return err.value;
        throw err;
    }
}
