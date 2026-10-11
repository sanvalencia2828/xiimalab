/**
 * lib/skills/types.ts
 * Forma de los datos de la pestaña "Mercado" de /skills. Los calcula
 * lib/skills/insights.ts en el servidor; el cliente solo los pinta.
 */

/** Nivel según la evidencia disponible, de menos a más. */
export type EvidenceLevel = "none" | "learning" | "demonstrated" | "consolidated";

export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
    none: "Sin evidencia",
    learning: "En aprendizaje",
    demonstrated: "Demostrada",
    consolidated: "Consolidada",
};

export interface SkillInsight {
    key: string;
    label: string;
    level: EvidenceLevel;
    /** Proyectos que la usan */
    projects: string[];
    /** Hitos marcados en fases que la cubren */
    milestonesDone: number;
    /** Hackatones abiertas que la piden */
    demand: number;
    /** Premios en USD verificados de esas hackatones */
    prizeUsd: number;
    highDemand: boolean;
    /** Etiquetas más repetidas en las convocatorias que la piden */
    keywords: string[];
    track: { id: string; title: string } | null;
    /** Primer hito pendiente de la fase que la cubre */
    milestone: { text: string; href: string } | null;
}

export interface SkillRecommendation {
    text: string;
    href: string;
    linkLabel: string;
}

export interface SkillInsights {
    /** Skills con demanda o con evidencia, de más a menos demandada */
    skills: SkillInsight[];
    /** Las más demandadas ahora */
    rising: SkillInsight[];
    recommendation: SkillRecommendation | null;
    /** Convocatorias abiertas analizadas */
    total: number;
    sources: string[];
    fetchedAt: string | null;
    /** false si el agregador de hackatones no respondió */
    hackathonsAvailable: boolean;
}
