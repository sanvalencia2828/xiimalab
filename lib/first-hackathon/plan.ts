/**
 * lib/first-hackathon/plan.ts
 * "Modo primera hackatón": un plan de 7 días para elegir, construir y enviar
 * una hackatón. Cálculo puro; el estado se guarda en el navegador (ver
 * hooks/useFirstHackathon.ts), igual que el avance de los tracks.
 *
 * Los 7 días se cuentan hacia atrás desde el cierre de la hackatón elegida:
 * el día 7 es el día de cierre y el día 1, seis días antes.
 */
import { formatPrize } from "@/lib/hackathons/format";
import { tagKey } from "@/lib/hackathons/tags";
import type { AggregatedHackathon } from "@/lib/types";

export const PLAN_DAYS = 7;
/** Una hackatón es candidata si cierra dentro de este margen, en días. */
export const MIN_DAYS_TO_CLOSE = 7;
export const MAX_DAYS_TO_CLOSE = 14;
export const SUBMIT_MARGIN_HOURS = 12;
export const MVP_FEATURES = 3;

const DAY_MS = 86_400_000;
const MAX_TEXT = 300;
const MAX_TAGS = 20;

// ── Pasos ───────────────────────────────────────────────────────────────────
export type StepId = "elegir" | "idea" | "reforzar" | "construir" | "presentar" | "enviar";

export interface PlanStep {
    id: StepId;
    title: string;
    /** Días del plan que ocupa (1–7) */
    days: number[];
    summary: string;
}

export const STEPS: PlanStep[] = [
    { id: "elegir", title: "Elegir", days: [1], summary: "Elige una hackatón pensada para empezar." },
    { id: "idea", title: "Idea", days: [2], summary: "Define la idea en una frase y las 3 funciones del MVP." },
    { id: "reforzar", title: "Reforzar", days: [3], summary: "Repasa las skills que pide y aún no has demostrado." },
    { id: "construir", title: "Construir", days: [4, 5], summary: "Repo, primer despliegue y las 3 funciones." },
    { id: "presentar", title: "Presentar", days: [6], summary: "README, vídeo y demo." },
    { id: "enviar", title: "Enviar", days: [7], summary: `Envía ${SUBMIT_MARGIN_HOURS} h antes del cierre.` },
];

export interface CheckItem {
    id: string;
    label: string;
}

export const REINFORCE_CHECK = "reforzar";

export function buildChecks(features: string[]): CheckItem[] {
    return [
        { id: "repo", label: "Repositorio creado" },
        { id: "deploy", label: "Primer despliegue publicado" },
        ...Array.from({ length: MVP_FEATURES }, (_, i) => ({
            id: `feature-${i + 1}`,
            label: features[i]?.trim() ? `Función ${i + 1}: ${features[i].trim()}` : `Función ${i + 1} del MVP`,
        })),
    ];
}

export const PRESENT_CHECKS: CheckItem[] = [
    { id: "readme", label: "README con qué hace, cómo probarlo y capturas" },
    { id: "video", label: "Vídeo de 2–3 min" },
    { id: "demo", label: "Demo accesible por URL" },
];

// ── Estado ──────────────────────────────────────────────────────────────────
export interface ChosenHackathon {
    id: string;
    title: string;
    url: string | null;
    /** "YYYY-MM-DD" */
    deadline: string;
    tags: string[];
    matchScore: number;
    source: string;
}

export interface FirstHackathonState {
    hackathon: ChosenHackathon | null;
    idea: string;
    /** Las 3 funciones del MVP */
    features: string[];
    /** id del punto de un checklist → fecha ISO en que se marcó */
    checks: Record<string, string>;
    /** Fecha ISO en que se marcó como enviada */
    submittedAt: string | null;
}

export const EMPTY_FIRST_HACKATHON: FirstHackathonState = {
    hackathon: null,
    idea: "",
    features: Array.from({ length: MVP_FEATURES }, () => ""),
    checks: {},
    submittedAt: null,
};

const text = (value: unknown): string => (typeof value === "string" ? value.slice(0, MAX_TEXT) : "");
const isoDate = (value: unknown): string | null =>
    typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : null;

function parseChosen(raw: unknown): ChosenHackathon | null {
    if (!raw || typeof raw !== "object") return null;
    const { id, title, url, deadline, tags, matchScore, source } = raw as Record<string, unknown>;
    if (typeof id !== "string" || typeof title !== "string" || !title.trim()) return null;
    if (typeof deadline !== "string" || !parseDay(deadline)) return null;
    return {
        id: text(id),
        title: text(title).trim(),
        url: typeof url === "string" && /^https?:\/\//.test(url) ? url : null,
        deadline: deadline.slice(0, 10),
        tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string").slice(0, MAX_TAGS).map(text) : [],
        matchScore: typeof matchScore === "number" && Number.isFinite(matchScore) ? Math.round(matchScore) : 0,
        source: text(source),
    };
}

/** Valida el plan guardado o recibido del cliente, descartando lo que no tenga la forma esperada. */
export function parseFirstHackathonState(raw: unknown): FirstHackathonState {
    if (!raw || typeof raw !== "object") return EMPTY_FIRST_HACKATHON;
    const obj = raw as Record<string, unknown>;
    const features = Array.isArray(obj.features) ? obj.features : [];
    const checks = obj.checks && typeof obj.checks === "object" ? (obj.checks as Record<string, unknown>) : {};
    return {
        hackathon: parseChosen(obj.hackathon),
        idea: text(obj.idea),
        features: Array.from({ length: MVP_FEATURES }, (_, i) => text(features[i])),
        checks: Object.fromEntries(
            Object.entries(checks).filter((entry): entry is [string, string] => isoDate(entry[1]) !== null),
        ),
        submittedAt: isoDate(obj.submittedAt),
    };
}

// ── Fechas ──────────────────────────────────────────────────────────────────
/** "YYYY-MM-DD" → medianoche local de ese día, o null. */
export function parseDay(day: string): Date | null {
    const m = day.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Días naturales que faltan para el cierre (0 = cierra hoy); null sin fecha válida. */
export function daysUntil(deadline: string, now: Date = new Date()): number | null {
    const end = parseDay(deadline);
    if (!end) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((end.getTime() - today.getTime()) / DAY_MS);
}

/** Fecha del día `day` (1–7) del plan, contando hacia atrás desde el cierre. */
export function planDate(deadline: string, day: number): Date | null {
    const end = parseDay(deadline);
    if (!end) return null;
    return new Date(end.getFullYear(), end.getMonth(), end.getDate() - (PLAN_DAYS - day));
}

/** Último instante del día de cierre: las fuentes solo publican el día, no la hora. */
export function closingTime(deadline: string): Date | null {
    const end = parseDay(deadline);
    return end ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59) : null;
}

// ── Avance ──────────────────────────────────────────────────────────────────
export function stepDone(step: StepId, state: FirstHackathonState): boolean {
    switch (step) {
        case "elegir":
            return state.hackathon !== null;
        case "idea":
            return Boolean(state.idea.trim()) && state.features.every((f) => f.trim());
        case "reforzar":
            return Boolean(state.checks[REINFORCE_CHECK]);
        case "construir":
            return buildChecks(state.features).every((c) => state.checks[c.id]);
        case "presentar":
            return PRESENT_CHECKS.every((c) => state.checks[c.id]);
        case "enviar":
            return state.submittedAt !== null;
    }
}

/** Primer paso sin terminar; null si el plan está completo. */
export function currentStep(state: FirstHackathonState): PlanStep | null {
    return STEPS.find((step) => !stepDone(step.id, state)) ?? null;
}

export type StepStatus = "hecho" | "hoy" | "atrasado" | "pendiente";

export function stepStatus(step: PlanStep, state: FirstHackathonState, now: Date = new Date()): StepStatus {
    if (stepDone(step.id, state)) return "hecho";
    if (!state.hackathon) return "pendiente";
    const left = daysUntil(state.hackathon.deadline, now);
    if (left === null) return "pendiente";
    // Día del plan en el que cae hoy: 7 el día de cierre, 1 seis días antes
    const today = PLAN_DAYS - left;
    if (today > step.days[step.days.length - 1]) return "atrasado";
    return today >= step.days[0] ? "hoy" : "pendiente";
}

/** Lo que desbloquea el logro "Primera hackatón enviada". */
export interface FirstHackathonSubmission {
    title: string;
    at: string;
}

export function submission(state: FirstHackathonState): FirstHackathonSubmission | null {
    return state.hackathon && state.submittedAt ? { title: state.hackathon.title, at: state.submittedAt } : null;
}

// ── Candidatas del día 1 ────────────────────────────────────────────────────
export type BeginnerReason = "Beginner Friendly" | "Tema abierto";

export interface Candidate extends ChosenHackathon {
    reason: BeginnerReason;
    prize: string;
    organizer: string | null;
}

const OPEN_THEME = new Set(["open ended", "open-ended", "open track", "open theme", "open innovation", "open", "no restrictions"]);

/** Por qué sirve para empezar: etiqueta Beginner Friendly o tema abierto; null si ninguna. */
export function beginnerReason(h: Pick<AggregatedHackathon, "tags" | "difficulty">): BeginnerReason | null {
    const keys = (h.tags ?? []).map(tagKey);
    if (h.difficulty?.toLowerCase() === "beginner" || keys.some((key) => key.includes("beginner"))) return "Beginner Friendly";
    return keys.some((key) => OPEN_THEME.has(key)) ? "Tema abierto" : null;
}

/** Hackatones para empezar: Beginner Friendly o de tema abierto, virtuales y con cierre en 7–14 días; por match. */
export function pickCandidates(hackathons: AggregatedHackathon[], now: Date = new Date()): Candidate[] {
    return hackathons
        .flatMap((h) => {
            const reason = beginnerReason(h);
            const left = daysUntil(h.deadline, now);
            if (!reason || h.event_type !== "virtual" || left === null) return [];
            if (left < MIN_DAYS_TO_CLOSE || left > MAX_DAYS_TO_CLOSE) return [];
            return [{
                id: h.id,
                title: h.title,
                url: h.source_url || null,
                deadline: h.deadline,
                tags: (h.tags ?? []).slice(0, MAX_TAGS),
                matchScore: Math.round(h.match_score),
                source: h.source,
                reason,
                prize: formatPrize(h.prize_pool, h.prize_currency, h.prize_unverified),
                organizer: h.organizer ?? null,
            }];
        })
        .sort((a, b) => b.matchScore - a.matchScore || a.deadline.localeCompare(b.deadline));
}
