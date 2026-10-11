/**
 * lib/bounties/superteam.ts — SERVER ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 * Bounties abiertos de Superteam Earn.
 *
 *   GET https://superteam.fun/api/listings?category=All          → todos
 *   GET https://superteam.fun/api/listings?category=Development  → para marcar isDev
 *
 * Las dos peticiones van en paralelo. Si falla la de Development se devuelven
 * los bounties igualmente, con `devKnown: false`.
 * Caché: unstable_cache sobre el resultado (CACHE_TTL_S); un resultado vacío
 * no se cachea.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { unstable_cache } from "next/cache";
import { type Bounty, isOpenListing, parseSuperteamListing } from "@/lib/bounties/parse";

export type { Bounty } from "@/lib/bounties/parse";

export interface RequestStatus {
    ok: boolean;
    count: number;
    /** Tiempo de respuesta en ms */
    ms: number;
    error?: string;
}

export interface BountiesResult {
    bounties: Bounty[];
    /** false si no se pudo consultar la categoría Development (isDev no es fiable) */
    devKnown: boolean;
    sources: { superteam: RequestStatus & { requests: { all: RequestStatus; development: RequestStatus } } };
    fetched_at: string;
}

const LISTINGS_URL = "https://superteam.fun/api/listings";
const CACHE_TTL_S = 600;
const TIMEOUT_MS = 8000;

const HEADERS: Record<string, string> = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/json",
};

async function fetchListings(category: "All" | "Development"): Promise<{ status: RequestStatus; items: unknown[] }> {
    const startedAt = Date.now();
    try {
        const res = await fetch(`${LISTINGS_URL}?category=${category}`, {
            headers: HEADERS,
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: "no-store", // la única capa de caché es unstable_cache sobre el resultado
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: unknown = await res.json();
        if (!Array.isArray(data)) throw new Error("La respuesta no es una lista");
        return { status: { ok: true, count: data.length, ms: Date.now() - startedAt }, items: data };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.warn(`[superteam] category=${category} falló: ${error}`);
        return { status: { ok: false, count: 0, ms: Date.now() - startedAt, error }, items: [] };
    }
}

/** Consulta Superteam (sin caché del resultado). */
async function load(): Promise<BountiesResult> {
    const startedAt = Date.now();
    const [all, development] = await Promise.all([fetchListings("All"), fetchListings("Development")]);

    const devIds = new Set<string>();
    for (const raw of development.items) {
        const b = parseSuperteamListing(raw);
        if (b) devIds.add(b.id);
    }

    // Si "All" falla pero Development responde, al menos se muestran los de desarrollo
    const pool = all.status.ok ? all.items : development.items;
    const now = new Date();
    const seen = new Set<string>();
    const bounties: Bounty[] = [];
    for (const raw of pool) {
        if (!isOpenListing(raw, now)) continue;
        const b = parseSuperteamListing(raw);
        if (!b || seen.has(b.id)) continue;
        seen.add(b.id);
        bounties.push({ ...b, isDev: devIds.has(b.id) });
    }
    bounties.sort((a, b) => a.deadline.localeCompare(b.deadline));

    const ok = all.status.ok || development.status.ok;
    return {
        bounties,
        devKnown: development.status.ok,
        sources: {
            superteam: {
                ok,
                count: bounties.length,
                ms: Date.now() - startedAt,
                ...(ok ? {} : { error: all.status.error }),
                requests: { all: all.status, development: development.status },
            },
        },
        fetched_at: new Date().toISOString(),
    };
}

/** Un resultado vacío no se cachea: se lanza dentro de unstable_cache y se recupera fuera. */
class EmptyBountiesResult extends Error {
    constructor(readonly value: BountiesResult) {
        super("superteam bounties: sin resultados");
    }
}

const cachedLoad = unstable_cache(
    async (): Promise<BountiesResult> => {
        const value = await load();
        if (value.bounties.length === 0) throw new EmptyBountiesResult(value);
        return value;
    },
    ["superteam-bounties"],
    { revalidate: CACHE_TTL_S, tags: ["superteam-bounties"] },
);

/**
 * Bounties abiertos de Superteam Earn. Con caché, `sources` y `fetched_at`
 * son los de la última consulta real; `force` la salta.
 */
export async function getSuperteamBounties(options: { force?: boolean } = {}): Promise<BountiesResult> {
    if (options.force) return load();
    try {
        return await cachedLoad();
    } catch (err) {
        if (err instanceof EmptyBountiesResult) return err.value;
        throw err;
    }
}
