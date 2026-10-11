/**
 * lib/learning/demand.ts
 * Ranking de los tracks según la demanda actual: convocatorias abiertas cuyas
 * etiquetas coinciden con las skills del track, sus premios en USD y cuántas
 * cierran pronto. Cálculo puro: recibe las convocatorias ya obtenidas.
 */
import { isUsdPrize } from "@/lib/hackathons/format";
import { matchSkills } from "./connect";
import type { Track } from "./tracks";

/** Convocatoria abierta: hoy hackatones del agregador; los bounties encajan en la misma forma. */
export interface Opportunity {
    tags?: string[] | null;
    prize_pool?: number | null;
    prize_currency?: string | null;
    deadline: string; // "YYYY-MM-DD"
}

/** Peso de cada señal en la puntuación del track. Deben sumar 1. */
export const RANKING_WEIGHTS = { demand: 0.5, prizes: 0.3, urgency: 0.2 };
/** Una convocatoria es urgente si cierra dentro de estos días. */
export const URGENCY_WINDOW_DAYS = 30;

export interface TrackDemand {
    trackId: string;
    title: string;
    /** Posición en el ranking, desde 1 */
    rank: number;
    /** Convocatorias abiertas que coinciden con las skills del track */
    opportunities: number;
    /** Suma de premios en USD de esas convocatorias (las de otra moneda no suman) */
    prizeUsd: number;
    /** Cuántas cierran en los próximos URGENCY_WINDOW_DAYS días */
    closingSoon: number;
    /** Puntuación 0–100 */
    score: number;
    /** Puntuación relativa al primero, 0–100 (ancho de la barra) */
    relative: number;
}

export function trackSkills(track: Track): string[] {
    return Array.from(new Set(track.phases.flatMap((phase) => phase.skills)));
}

function daysUntil(deadline: string, now: Date): number | null {
    const m = deadline.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const end = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((end - today) / 86_400_000);
}

/** Tracks ordenados de más a menos demandado. Sin convocatorias devuelve [] (no hay ranking que mostrar). */
export function rankTracks(tracks: Track[], opportunities: Opportunity[], now: Date = new Date()): TrackDemand[] {
    if (opportunities.length === 0) return [];

    const raw = tracks.map((track) => {
        const skills = trackSkills(track);
        const matching = opportunities.filter((o) => matchSkills(skills, o.tags ?? []).length > 0);
        return {
            trackId: track.id,
            title: track.title,
            opportunities: matching.length,
            prizeUsd: matching.reduce(
                (sum, o) => (isUsdPrize(o.prize_pool, o.prize_currency) ? sum + (o.prize_pool ?? 0) : sum),
                0,
            ),
            closingSoon: matching.filter((o) => {
                const days = daysUntil(o.deadline, now);
                return days !== null && days >= 0 && days <= URGENCY_WINDOW_DAYS;
            }).length,
        };
    });

    const max = (pick: (r: (typeof raw)[number]) => number) => Math.max(1, ...raw.map(pick));
    const maxDemand = max((r) => r.opportunities);
    const maxPrizes = max((r) => r.prizeUsd);
    const maxUrgency = max((r) => r.closingSoon);

    const scored = raw
        .map((r, index) => ({
            ...r,
            index,
            score:
                100 *
                (RANKING_WEIGHTS.demand * (r.opportunities / maxDemand) +
                    RANKING_WEIGHTS.prizes * (r.prizeUsd / maxPrizes) +
                    RANKING_WEIGHTS.urgency * (r.closingSoon / maxUrgency)),
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);

    const top = scored[0]?.score || 1;
    return scored.map(({ index: _index, ...r }, position) => ({
        ...r,
        rank: position + 1,
        score: Math.round(r.score),
        relative: Math.round((r.score / top) * 100),
    }));
}
