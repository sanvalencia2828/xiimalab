/**
 * lib/dashboard/types.ts
 * Forma de los datos del Dashboard del Estudiante. Todo llega calculado desde
 * el servidor (lib/dashboard/build.ts); el cliente solo los pinta.
 */
import type { TrackDemand } from "@/lib/learning/demand";
import type { SkillResourceLink } from "@/lib/skills/types";

export interface DashboardSummary {
    /** Hitos hechos / total, solo de los tracks activos */
    done: number;
    total: number;
    percent: number;
    activeTracks: number;
    /** Hitos marcados en los últimos 7 días */
    milestonesThisWeek: number;
    /** Skills con evidencia: un proyecto que las usa (por su stack o por un hito aplicado en él) o una certificación */
    demonstratedSkills: number;
}

export interface TrackRow {
    id: string;
    title: string;
    done: number;
    total: number;
    percent: number;
    /** Título de la fase actual; null si el track está completo */
    phase: string | null;
    /** Fecha ISO del último hito marcado, o null */
    lastMilestoneAt: string | null;
}

export interface NextMilestoneRow {
    id: string;
    text: string;
    trackId: string;
    trackTitle: string;
    phaseTitle: string;
    /** Proyectos cuyo stack cubre las skills de la fase del hito */
    evidence: string[];
}

export interface SkillChip {
    key: string;
    label: string;
}

export interface ProjectRow {
    title: string;
    name: string;
    url: string | null;
    /** Avance medido desde GitHub (el mismo de /projects); null si no se pudo medir */
    percent: number | null;
    skills: SkillChip[];
    roadmap: "none" | "pending" | "complete";
    roadmapDone: number;
    roadmapTotal: number;
    /** Primera tarea pendiente del ROADMAP.md */
    nextTask: string | null;
    error: string | null;
}

export interface SkillRow {
    key: string;
    label: string;
    /** Proyectos que la usan o en los que se aplicó un hito que la cubre */
    projects: string[];
    /** Certificación que la acredita: evidencia más fuerte que un proyecto */
    certification: { provider: string; url: string } | null;
    /** Hackatones abiertas cuyas etiquetas la mencionan */
    demand: number;
    track: { id: string; title: string; active: boolean } | null;
    /** Primer hito pendiente de la fase que la cubre */
    milestone: { id: string; text: string; href: string } | null;
    /** Recurso reconocido para reforzarla, si existe */
    resource: SkillResourceLink | null;
}

export interface PracticeRow {
    id: string;
    title: string;
    url: string | null;
    deadline: string;
    source: string;
    matchedSkills: string[];
    /** Proyecto del portafolio que mejor encaja, o null */
    project: string | null;
}

export interface AchievementRow {
    id: string;
    title: string;
    unlocked: boolean;
    /** Hecho que lo desbloqueó, o cómo desbloquearlo */
    detail: string;
    date: string | null;
}

export interface RankingRow extends TrackDemand {
    active: boolean;
    percent: number;
}

export interface RankingData {
    rows: RankingRow[];
    /** Convocatorias abiertas analizadas */
    total: number;
    /** Fuentes que respondieron, con su nombre visible */
    sources: string[];
    fetchedAt: string | null;
}

export interface DashboardData {
    summary: DashboardSummary;
    tracks: TrackRow[];
    nextMilestones: NextMilestoneRow[];
    projects: ProjectRow[];
    skills: { strong: SkillRow[]; toReinforce: SkillRow[] };
    /** Fases actuales de los tracks activos, de las que salen las hackatones para practicar */
    practicePhases: string[];
    practice: PracticeRow[];
    achievements: AchievementRow[];
    ranking: RankingData;
    /** false si el agregador de hackatones no respondió */
    hackathonsAvailable: boolean;
}
