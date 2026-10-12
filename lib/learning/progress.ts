/**
 * lib/learning/progress.ts
 * Avance de los tracks: cálculo puro a partir de los hitos marcados.
 *
 * El estado se guarda en el navegador (ver hooks/useLearningProgress.ts) como
 * un mapa hito → fecha en que se marcó. El estado de una fase se deriva de sus
 * hitos: pendiente (ninguno), en curso (alguno) o hecho (todos).
 *
 * Las fases opcionales no cuentan para el avance del track ni para su fase
 * actual. Cuando un hito se mueve o se fusiona, MILESTONE_MIGRATIONS lleva su
 * estado guardado al hito nuevo.
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

/**
 * Hitos que cambiaron de id: `to` queda hecho si lo estaban todos los de
 * `from` (un hito fusionado pide lo que pedían todos sus orígenes), con la
 * fecha del último. Los ids de `from` ya no existen en tracks.ts.
 */
export const MILESTONE_MIGRATIONS: { to: string; from: string[] }[] = [
    // El workflow de CI pasó de «Docker y despliegue» a «Calidad y repo presentable»
    { to: "full-stack:calidad:5", from: ["full-stack:docker-despliegue:3"] },
    // «Primer contrato inteligente» y «Seguridad y salida a mainnet» se fusionaron en «Contratos y seguridad»
    { to: "blockchain:contratos-seguridad:1", from: ["blockchain:primer-contrato:1", "blockchain:primer-contrato:3"] },
    { to: "blockchain:contratos-seguridad:2", from: ["blockchain:primer-contrato:2"] },
    { to: "blockchain:contratos-seguridad:3", from: ["blockchain:primer-contrato:4", "blockchain:primer-contrato:5"] },
    { to: "blockchain:contratos-seguridad:4", from: ["blockchain:seguridad-mainnet:1", "blockchain:seguridad-mainnet:2"] },
    { to: "blockchain:contratos-seguridad:5", from: ["blockchain:seguridad-mainnet:3"] },
    { to: "blockchain:contratos-seguridad:6", from: ["blockchain:seguridad-mainnet:4", "blockchain:seguridad-mainnet:5"] },
];

/**
 * Lleva a los ids actuales un mapa hito → valor guardado con ids antiguos.
 * `merge` decide el valor del hito nuevo a partir de los de sus orígenes.
 */
export function migrateMilestoneKeys(map: Record<string, string>, merge: (values: string[]) => string): Record<string, string> {
    const retired = new Set(MILESTONE_MIGRATIONS.flatMap((m) => m.from));
    if (!Object.keys(map).some((id) => retired.has(id))) return map;
    const next = Object.fromEntries(Object.entries(map).filter(([id]) => !retired.has(id)));
    for (const { to, from } of MILESTONE_MIGRATIONS) {
        if (next[to] || !from.every((id) => map[id])) continue;
        next[to] = merge(from.map((id) => map[id]));
    }
    return next;
}

const latest = (dates: string[]): string => [...dates].sort()[dates.length - 1];

/** Fases que cuentan para el avance del track. */
function required(track: Track): Phase[] {
    return track.phases.filter((phase) => !phase.optional);
}

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

/** Avance del track = hitos hechos / total de hitos, sin las fases opcionales. */
export function trackProgress(track: Track, done: DoneMap): Progress {
    const all = required(track).flatMap((p) => p.milestones);
    return ratio(all.filter((m) => done[m.id]).length, all.length);
}

/** Un track está activo si se eligió o tiene algún hito hecho (también en una fase opcional). */
export function isTrackActive(track: Track, state: LearningState): boolean {
    return Boolean(state.started[track.id]) || track.phases.some((p) => phaseProgress(p, state.done).done > 0);
}

/** Primera fase no opcional con hitos pendientes; null si el track está completo. */
export function currentPhase(track: Track, done: DoneMap): Phase | null {
    return required(track).find((p) => phaseStatus(p, done) !== "hecho") ?? null;
}

/** Primer hito pendiente del track, con su fase. */
export function nextMilestone(track: Track, done: DoneMap): { phase: Phase; milestone: Milestone } | null {
    for (const phase of required(track)) {
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

/** Lee el estado guardado, descartando lo que no tenga la forma esperada y migrando los hitos que cambiaron de id. */
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
        return { done: migrateMilestoneKeys(pick(obj.done), latest), started: pick(obj.started) };
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
