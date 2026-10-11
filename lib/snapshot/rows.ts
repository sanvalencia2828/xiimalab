/**
 * lib/snapshot/rows.ts
 * Filas de hackathon_snapshots y bounty_snapshots (supabase/migrations) a
 * partir de lo que devuelven el agregador y Superteam. Transformación pura.
 *
 * first_seen_at no aparece: lo pone la base de datos al insertar y el upsert
 * no lo toca.
 */
import type { Bounty } from "@/lib/bounties/parse";
import { isUsdPrize } from "@/lib/hackathons/format";
import type { AggregatedHackathon } from "@/lib/types";

export interface SnapshotRow {
    id: string;
    source: string;
    title: string;
    /** Hackatones: "YYYY-MM-DD". Bounties: ISO 8601 con hora. */
    deadline: string | null;
    prize_usd: number | null;
    prize_amount: number | null;
    prize_currency: string | null;
    tags: string[];
    url: string | null;
    last_seen_at: string;
}

// Tokens que valen un dólar: su importe cuenta como USD
const USD_STABLECOINS = new Set(["USDC", "USDG", "USDT"]);

export function hackathonRow(h: AggregatedHackathon, seenAt: string): SnapshotRow {
    const amount = h.prize_pool > 0 ? h.prize_pool : null;
    return {
        id: h.id,
        source: h.source,
        title: h.title,
        deadline: h.deadline || null,
        prize_usd: isUsdPrize(h.prize_pool, h.prize_currency, h.prize_unverified) ? h.prize_pool : null,
        prize_amount: amount,
        prize_currency: amount ? h.prize_currency ?? null : null,
        tags: h.tags ?? [],
        url: h.source_url ?? null,
        last_seen_at: seenAt,
    };
}

export function bountyRow(b: Bounty, seenAt: string): SnapshotRow {
    // Recompensa fija, o el tope del rango; "variable" no tiene importe
    const amount = b.rewardAmount ?? b.rewardMax ?? null;
    return {
        id: b.id,
        source: b.source,
        title: b.title,
        deadline: b.deadline,
        prize_usd: amount !== null && b.token !== null && USD_STABLECOINS.has(b.token) ? amount : null,
        prize_amount: amount,
        prize_currency: amount !== null ? b.token : null,
        tags: [b.type, ...(b.isDev ? ["development"] : [])],
        url: b.url,
        last_seen_at: seenAt,
    };
}

/** Una fila por id (Postgres rechaza un upsert con el mismo id dos veces). */
export function uniqueById(rows: SnapshotRow[]): SnapshotRow[] {
    return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}
