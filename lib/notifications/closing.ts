/**
 * lib/notifications/closing.ts — SERVER ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 * Convocatorias que cierran pronto y encajan con tus skills, para la campana.
 *
 * Origen:
 *   1. Supabase (hackathon_snapshots y bounty_snapshots), si está configurado
 *      y el último snapshot es reciente.
 *   2. Agregador en vivo y Superteam, como respaldo (igual que /hackathons).
 *
 * El match es el mismo de las tarjetas: computeMatchScore sobre título y etiquetas.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { getSuperteamBounties } from "@/lib/bounties/superteam";
import { getLiveHackathons } from "@/lib/hackathons/live";
import { computeMatchScore } from "@/lib/hackathons/match";
import { supabase } from "@/lib/supabase";

/** Se avisa de lo que cierra dentro de estas horas. */
export const CLOSING_WINDOW_HOURS = 72;
/** El match debe superar este valor. */
export const MIN_MATCH_SCORE = 50;
// El job corre cada 6 h: con más de dos ejecuciones perdidas el snapshot se considera caducado
const SNAPSHOT_MAX_AGE_MS = 13 * 3_600_000;
// Una convocatoria que el último job ya no vio (cerrada o retirada) no se notifica
const LAST_RUN_TOLERANCE_MS = 3_600_000;

export type ClosingKind = "hackathon" | "bounty";

export interface ClosingNotification {
    /** `<tipo>:<id>`, estable entre cargas: se usa para recordar las leídas */
    id: string;
    kind: ClosingKind;
    title: string;
    /** "YYYY-MM-DD" (hackatones) o ISO 8601 con hora (bounties) */
    deadline: string;
    matchScore: number;
    url: string | null;
    source: string;
}

export interface ClosingResult {
    notifications: ClosingNotification[];
    /** De dónde salieron los datos; "none" si ninguna fuente respondió */
    origin: "supabase" | "live" | "none";
}

interface Candidate {
    kind: ClosingKind;
    id: string;
    title: string;
    deadline: string | null;
    tags: string[];
    url: string | null;
    source: string;
}

/** Milisegundos hasta el cierre. Una fecha sin hora cierra al final de ese día (UTC). */
function msUntil(deadline: string, now: Date): number {
    const end = /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? `${deadline}T23:59:59Z` : deadline;
    return new Date(end).getTime() - now.getTime();
}

function select(candidates: Candidate[], now: Date): ClosingNotification[] {
    const windowMs = CLOSING_WINDOW_HOURS * 3_600_000;
    return candidates
        .flatMap((c) => {
            if (!c.deadline) return [];
            const remaining = msUntil(c.deadline, now);
            if (Number.isNaN(remaining) || remaining < 0 || remaining > windowMs) return [];
            const matchScore = computeMatchScore(c.title, c.tags);
            if (matchScore <= MIN_MATCH_SCORE) return [];
            return [{ id: `${c.kind}:${c.id}`, kind: c.kind, title: c.title, deadline: c.deadline, matchScore, url: c.url, source: c.source }];
        })
        .sort((a, b) => msUntil(a.deadline, now) - msUntil(b.deadline, now) || b.matchScore - a.matchScore);
}

interface SnapshotRecord {
    id: string;
    source: string;
    title: string;
    deadline: string | null;
    tags: string[] | null;
    url: string | null;
}

/** Filas de un snapshot vistas en su última ejecución; null si la tabla falla, está vacía o caducó. */
async function freshSnapshot(table: string, kind: ClosingKind, now: Date): Promise<Candidate[] | null> {
    if (!supabase) return null;
    const { data: latest, error: latestError } = await supabase
        .from(table)
        .select("last_seen_at")
        .order("last_seen_at", { ascending: false })
        .limit(1);
    const lastRun = latest?.[0]?.last_seen_at ? new Date(String(latest[0].last_seen_at)).getTime() : NaN;
    if (latestError || Number.isNaN(lastRun) || now.getTime() - lastRun > SNAPSHOT_MAX_AGE_MS) return null;

    // Margen de un día: el filtro exacto de las 72 h se aplica después, en select()
    const limit = new Date(now.getTime() + (CLOSING_WINDOW_HOURS + 24) * 3_600_000).toISOString();
    // hackathon_snapshots.deadline es una fecha; bounty_snapshots.deadline lleva hora
    const until = kind === "hackathon" ? limit.slice(0, 10) : limit;
    const { data, error } = await supabase
        .from(table)
        .select("id, source, title, deadline, tags, url")
        .gte("last_seen_at", new Date(lastRun - LAST_RUN_TOLERANCE_MS).toISOString())
        .lte("deadline", until)
        .order("deadline", { ascending: true })
        .limit(500);
    if (error) return null;
    return ((data ?? []) as SnapshotRecord[]).map((row) => ({
        kind,
        id: row.id,
        title: row.title,
        deadline: row.deadline,
        tags: row.tags ?? [],
        url: row.url,
        source: row.source,
    }));
}

async function fromSupabase(now: Date): Promise<Candidate[] | null> {
    try {
        const [hackathons, bounties] = await Promise.all([
            freshSnapshot("hackathon_snapshots", "hackathon", now),
            freshSnapshot("bounty_snapshots", "bounty", now),
        ]);
        // Sin snapshot reciente de hackatones se usa el respaldo en vivo para todo
        return hackathons ? [...hackathons, ...(bounties ?? [])] : null;
    } catch (err) {
        console.warn("[notifications] Supabase no disponible:", err instanceof Error ? err.message : err);
        return null;
    }
}

async function fromLive(): Promise<Candidate[] | null> {
    const [live, superteam] = await Promise.allSettled([getLiveHackathons(), getSuperteamBounties()]);
    const hackathons: Candidate[] =
        live.status === "fulfilled"
            ? live.value.hackathons.map((h) => ({
                  kind: "hackathon", id: h.id, title: h.title, deadline: h.deadline || null,
                  tags: h.tags ?? [], url: h.source_url ?? null, source: h.source,
              }))
            : [];
    const bounties: Candidate[] =
        superteam.status === "fulfilled"
            ? superteam.value.bounties.map((b) => ({
                  kind: "bounty", id: b.id, title: b.title, deadline: b.deadline,
                  tags: [b.type], url: b.url, source: b.source,
              }))
            : [];
    return hackathons.length + bounties.length > 0 ? [...hackathons, ...bounties] : null;
}

export async function getClosingNotifications(now: Date = new Date()): Promise<ClosingResult> {
    const stored = await fromSupabase(now);
    if (stored) return { notifications: select(stored, now), origin: "supabase" };

    const live = await fromLive();
    if (live) return { notifications: select(live, now), origin: "live" };

    return { notifications: [], origin: "none" };
}
