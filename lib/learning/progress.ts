/**
 * lib/learning/progress.ts
 * Avance de los tracks: cálculo puro a partir de los hitos marcados.
 *
 * El estado se guarda en el navegador (ver hooks/useLearningProgress.ts) como
 * un mapa hito → fecha en que se marcó. El estado de una fase se deriva de sus
 * hitos: pendiente (ninguno), en curso (alguno) o hecho (todos).
 */
import { TRACKS, type Milestone, type Phase, type Track } from "./tracks";

/** id del hito → fecha ISO en que se marcó como hecho */
export type DoneMap = Record<string, string>;

export interface LearningState {
    done: DoneMap;
    /** id del track → fecha ISO en que se eligió */
    started: Record<string, string>;
}

export const EMPTY_LEARNING_STATE: LearningState = { done: {}, started: {} };

export type PhaseStatus = "pendiente" | "en curso" | "hecho";

export interface Progress {
    done: number;
    total: number;
    percent: number;
}

function ratio(done: number, total: number): Progress {
    return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function phaseProgress(phase: Phase, done: DoneMap): Progress {
    return ratio(phase.milestones.filter((m) => done[m.id]).length, phase.milestones.length);
}

export function phaseStatus(phase: Phase, done: DoneMap): PhaseStatus {
    const p = phaseProgress(phase, done);
    return p.done === 0 ? "pendiente" : p.done === p.total ? "hecho" : "en curso";
}

/** Avance del track = hitos hechos / total de hitos. */
export function trackProgress(track: Track, done: DoneMap): Progress {
    const all = track.phases.flatMap((p) => p.milestones);
    return ratio(all.filter((m) => done[m.id]).length, all.length);
}

/** Un track está activo si se eligió o tiene algún hito hecho. */
export function isTrackActive(track: Track, state: LearningState): boolean {
    return Boolean(state.started[track.id]) || trackProgress(track, state.done).done > 0;
}

/** Primera fase con hitos pendientes; null si el track está completo. */
export function currentPhase(track: Track, done: DoneMap): Phase | null {
    return track.phases.find((p) => phaseStatus(p, done) !== "hecho") ?? null;
}

/** Primer hito pendiente del track, con su fase. */
export function nextMilestone(track: Track, done: DoneMap): { phase: Phase; milestone: Milestone } | null {
    for (const phase of track.phases) {
        const milestone = phase.milestones.find((m) => !done[m.id]);
        if (milestone) return { phase, milestone };
    }
    return null;
}

/** Fecha ISO del último hito completado del track, o null. */
export function lastCompletedAt(track: Track, done: DoneMap): string | null {
    const dates = track.phases.flatMap((p) => p.milestones).map((m) => done[m.id]).filter(Boolean);
    return dates.length > 0 ? dates.sort()[dates.length - 1] : null;
}

/** Lee el estado guardado, descartando lo que no tenga la forma esperada. */
export function parseLearningState(raw: string | null): LearningState {
    if (!raw) return EMPTY_LEARNING_STATE;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return EMPTY_LEARNING_STATE;
        const pick = (value: unknown): Record<string, string> => {
            if (!value || typeof value !== "object") return {};
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>).filter(
                    (entry): entry is [string, string] => typeof entry[1] === "string",
                ),
            );
        };
        const obj = parsed as Record<string, unknown>;
        return { done: pick(obj.done), started: pick(obj.started) };
    } catch {
        return EMPTY_LEARNING_STATE;
    }
}

/**
 * Estado recibido del cliente: conserva solo hitos y tracks que existen en
 * lib/learning/tracks.ts, con una fecha válida.
 */
export function sanitizeLearningState(raw: unknown): LearningState {
    const parsed = parseLearningState(JSON.stringify(raw ?? null) ?? null);
    const known = (map: Record<string, string>, ids: Set<string>): Record<string, string> =>
        Object.fromEntries(
            Object.entries(map).filter(([id, date]) => ids.has(id) && !Number.isNaN(new Date(date).getTime())),
        );
    return {
        done: known(parsed.done, new Set(TRACKS.flatMap((t) => t.phases.flatMap((p) => p.milestones.map((m) => m.id))))),
        started: known(parsed.started, new Set(TRACKS.map((t) => t.id))),
    };
}
