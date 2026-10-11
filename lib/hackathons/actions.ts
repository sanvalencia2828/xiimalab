/**
 * lib/hackathons/actions.ts
 * Primera vez que el usuario actúa sobre una hackatón con match alto: analizar
 * su match o abrir "Ir a la hackatón". Se guarda en el navegador y el dashboard
 * lo usa para el logro "Hackatón con match > 70 %".
 */

/** El match debe superar este valor para que la acción cuente. */
export const MATCH_ACHIEVEMENT_SCORE = 70;

export type HackathonActionKind = "analyze" | "apply";

export interface HackathonAction {
    hackathonId: string;
    title: string;
    matchScore: number;
    kind: HackathonActionKind;
    /** Fecha ISO de la acción */
    at: string;
}

const STORAGE_KEY = "xiimalab_hackathon_action";
const MAX_TEXT = 300;

/** Valida una acción guardada o recibida del cliente; null si no tiene la forma esperada o el match no llega. */
export function parseHackathonAction(raw: unknown): HackathonAction | null {
    if (!raw || typeof raw !== "object") return null;
    const { hackathonId, title, matchScore, kind, at } = raw as Record<string, unknown>;
    if (typeof hackathonId !== "string" || typeof title !== "string" || typeof at !== "string") return null;
    if (typeof matchScore !== "number" || !(matchScore > MATCH_ACHIEVEMENT_SCORE) || matchScore > 100) return null;
    if (kind !== "analyze" && kind !== "apply") return null;
    if (!title.trim() || Number.isNaN(new Date(at).getTime())) return null;
    return { hackathonId: hackathonId.slice(0, MAX_TEXT), title: title.trim().slice(0, MAX_TEXT), matchScore: Math.round(matchScore), kind, at };
}

export function readHackathonAction(): HackathonAction | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? parseHackathonAction(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

/** Guarda la acción si el match supera el umbral y aún no hay ninguna guardada (cuenta la primera). */
export function recordHackathonAction(
    hackathon: { id: string; title: string; matchScore: number },
    kind: HackathonActionKind,
): void {
    if (!(hackathon.matchScore > MATCH_ACHIEVEMENT_SCORE) || readHackathonAction()) return;
    const action: HackathonAction = {
        hackathonId: hackathon.id,
        title: hackathon.title,
        matchScore: Math.round(hackathon.matchScore),
        kind,
        at: new Date().toISOString(),
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(action));
    } catch { /* almacenamiento lleno o bloqueado: el logro no se registra */ }
}
