/**
 * lib/skills/types.ts
 * Forma de los datos de la pestaña "Mercado" de /skills. Los calcula
 * lib/skills/insights.ts en el servidor; el cliente solo los pinta.
 */

/**
 * Nivel de una skill según su evidencia más fuerte:
 *   certified    → una certificación verificable la acredita
 *   demonstrated → al menos un proyecto del portafolio la usa
 *   learning     → hay hitos marcados en una fase que la cubre
 *   declared     → está en tu lista de /skills, sin evidencia todavía
 *   none         → ni declarada ni con evidencia
 */
export type EvidenceLevel = "certified" | "demonstrated" | "learning" | "declared" | "none";

/** De más a menos fuerte. */
export const EVIDENCE_LEVELS: EvidenceLevel[] = ["certified", "demonstrated", "learning", "declared", "none"];

export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
    certified: "Certificada",
    demonstrated: "Demostrada",
    learning: "En aprendizaje",
    declared: "Declarada",
    none: "Sin evidencia",
};

export const EVIDENCE_LEVEL_HELP: Record<EvidenceLevel, string> = {
    certified: "Una certificación con URL de verificación la acredita.",
    demonstrated: "Al menos un proyecto de tu portafolio la usa.",
    learning: "Has marcado hitos en una fase de un track que la cubre.",
    declared: "La añadiste a tu lista, pero todavía no hay evidencia.",
    none: "Ni está en tu lista ni hay evidencia.",
};

/** Certificación que acredita una skill (lo necesario para el chip y su enlace). */
export interface SkillCertification {
    provider: string;
    name: string;
    url: string;
}

/** Enlace a un recurso reconocido que enseña la skill ("Refuerza Blockchain: ruta gratuita en Cyfrin Updraft"). */
export interface SkillResourceLink {
    text: string;
    url: string;
}

/** Lo que el cliente aporta al cálculo, además del avance de los tracks. */
export interface SkillEvidenceInput {
    certifications: unknown;
    /** Nombres de las skills de la lista de /skills, tal como los escribió el usuario */
    declared: unknown;
}

export interface SkillInsight {
    key: string;
    label: string;
    level: EvidenceLevel;
    /** Certificación más reciente que la acredita */
    certification: SkillCertification | null;
    /** Está en la lista de skills del usuario */
    declared: boolean;
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
    /** Recurso reconocido para reforzarla, si existe */
    resource: SkillResourceLink | null;
}

export interface SkillRecommendation {
    text: string;
    href: string;
    linkLabel: string;
    /** Recurso reconocido para la skill recomendada, si existe */
    resource: SkillResourceLink | null;
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
