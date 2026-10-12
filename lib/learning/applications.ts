/**
 * lib/learning/applications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Qué fases de los tracks aplican a cada proyecto del portafolio. Cálculo
 * puro, sin IA ni red: solo usa el stack y la descripción del proyecto y las
 * skills de cada fase.
 *
 *   • Afinidad: skills de la fase que ya están en el stack del proyecto.
 *   • Mejora: skills de la fase que el proyecto no tiene pero encajan con su
 *     tipo (un proyecto con API → tool use; con ETL → MLOps…). Ver FITS.
 *
 *   • Necesidad real: la fase declara en `resuelve` que atiende algo que el
 *     proyecto tiene pendiente (fijado a mano en tracks.ts). Basta para que
 *     aplique, aunque el stack no coincida.
 *
 * Sin necesidad real, una fase solo aplica si hay de dónde partir (afinidad, o una
 * práctica escrita para ese proyecto) y además algo que ganar o una coincidencia
 * amplia (al menos 2 skills y la mitad de las de la fase). Se muestran como mucho MAX_PHASES por proyecto y MAX_PER_TRACK por
 * track; si encajan menos, salen menos: no se rellenan con tracks que no encajan.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { canonicalSkills, skillLabel, skillsFromStack } from "./skills";
import type { Phase, Track } from "./tracks";

export const MAX_PHASES = 5;
const MAX_PER_TRACK = 2;
/** Sin mejora ni práctica propia, una fase solo aplica si el proyecto ya usa al menos 2 de sus skills y la mitad de ellas. */
const BROAD_AFFINITY = 2;
const BROAD_COVERAGE = 0.5;
const IMPROVEMENT_WEIGHT = 1.5;
const PRACTICE_BONUS = 2;
const NEED_BONUS = 3;

export interface ProjectLike {
    title: string;
    description: string;
    stack: string[];
}

// ── Tipo de proyecto ────────────────────────────────────────────────────────
export type ProjectKind = "api" | "etl" | "datos" | "llm" | "modelo" | "web" | "cadena";

const KIND_LABELS: Record<ProjectKind, string> = {
    api: "expone una API",
    etl: "tiene un proceso de datos (ETL)",
    datos: "guarda datos propios",
    llm: "usa un modelo de lenguaje",
    modelo: "puntúa o predice con un modelo",
    web: "tiene interfaz web",
    cadena: "trabaja con una blockchain",
};

// Señales en el stack o en la descripción (en minúsculas) de cada tipo
const KIND_SIGNALS: Record<ProjectKind, RegExp> = {
    api: /\b(fastapi|flask|express|apis?)\b/,
    etl: /\b(etl|pipeline|scraper|scraping)\b/,
    datos: /\b(postgis|postgresql|postgres|supabase|datos|heatmap)\b/,
    llm: /\b(openai|anthropic|llm|chat)\b/,
    modelo: /\b(ai\/ml|opencv|ml|recommendations|puntúa|clustering)\b|\bcon ia\b/,
    web: /\b(next\.js|react|html5)\b/,
    cadena: /\b(solana|stellar|blockchain|staking|memecoins?|tokens?|web3)\b/,
};

/** Tipos de un proyecto, deducidos de su stack y su descripción. */
export function projectKinds(project: ProjectLike): ProjectKind[] {
    const text = `${project.stack.join(" | ")} | ${project.description}`.toLowerCase();
    return (Object.keys(KIND_SIGNALS) as ProjectKind[]).filter((kind) => KIND_SIGNALS[kind].test(text));
}

// Skill que un proyecto puede ganar → tipos de proyecto con los que encaja
const FITS: Record<string, ProjectKind[]> = {
    agent: ["api"],
    "tool use": ["api"],
    mcp: ["api"],
    orchestration: ["etl"],
    memory: ["llm"],
    "multi-agent": ["llm"],
    rag: ["datos"],
    embeddings: ["datos"],
    evaluation: ["llm", "modelo"],
    "fine-tuning": ["modelo"],
    ml: ["etl", "datos"],
    analytics: ["etl", "api"],
    devops: ["etl", "api"],
    docker: ["etl", "api"],
    "smart contract": ["cadena"],
    defi: ["cadena"],
    nft: ["cadena"],
    web3: ["cadena"],
};

// ── Relevancia ──────────────────────────────────────────────────────────────
export interface PhaseApplication {
    projectTitle: string;
    /** "Rastreador · Londrina Radar Comercial" → "Rastreador" */
    projectName: string;
    trackId: string;
    trackTitle: string;
    phaseId: string;
    phaseTitle: string;
    /** Skills de la fase que el proyecto ya usa */
    affinity: string[];
    /** Skills de la fase que el proyecto ganaría y encajan con su tipo */
    improvement: string[];
    /** La fase tiene una práctica escrita para este proyecto, o su texto general se apoya en él */
    practice: boolean;
    /** Necesidades reales del proyecto que la fase atiende */
    needs: string[];
    /** Por qué aplica, en una línea */
    reason: string;
    score: number;
}

export function projectName(title: string): string {
    return title.split(" · ")[0];
}

function list(skills: string[]): string {
    return skills.map(skillLabel).join(", ");
}

/** Relevancia de una fase para un proyecto; null si no aplica. */
export function phaseApplication(project: ProjectLike, track: Track, phase: Phase): PhaseApplication | null {
    const owned = new Set(skillsFromStack(project.stack));
    const kinds = projectKinds(project);
    const skills = canonicalSkills(phase.skills);

    const affinity = skills.filter((skill) => owned.has(skill));
    const gains = skills
        .filter((skill) => !owned.has(skill))
        .map((skill) => ({ skill, kind: FITS[skill]?.find((k) => kinds.includes(k)) }))
        .filter((gain): gain is { skill: string; kind: ProjectKind } => gain.kind !== undefined);
    const improvement = gains.map((gain) => gain.skill);
    const name = projectName(project.title);
    const practice =
        phase.practicaGeneral.portfolioTitle === project.title || phase.practicas.some((p) => p.project === name);

    const needs = (phase.resuelve ?? []).filter((need) => need.projects.includes(name)).map((need) => need.need);

    const grounded = affinity.length > 0 || practice || needs.length > 0;
    const broad = affinity.length >= BROAD_AFFINITY && affinity.length / skills.length >= BROAD_COVERAGE;
    const worthwhile = improvement.length > 0 || practice || broad || needs.length > 0;
    if (!grounded || !worthwhile) return null;

    const reasons: string[] = [];
    if (needs.length > 0) reasons.push(`Lo tiene pendiente: ${needs.join(" y ").toLowerCase()}`);
    if (affinity.length > 0) reasons.push(`${needs.length > 0 ? "ya" : "Ya"} usa ${list(affinity)}`);
    if (gains.length > 0) reasons.push(`${KIND_LABELS[gains[0].kind]}, así que puede ganar ${list(improvement)}`);
    if (practice) reasons.push("la fase tiene una práctica escrita para él");

    return {
        projectTitle: project.title,
        projectName: name,
        trackId: track.id,
        trackTitle: track.title,
        phaseId: phase.id,
        phaseTitle: phase.title,
        affinity,
        improvement,
        practice,
        needs,
        reason: reasons.join("; "),
        score:
            affinity.length +
            improvement.length * IMPROVEMENT_WEIGHT +
            (practice ? PRACTICE_BONUS : 0) +
            needs.length * NEED_BONUS,
    };
}

/** Las fases más relevantes para un proyecto, de más a menos: como mucho 5 y 2 por track. */
export function applicationsForProject(project: ProjectLike, tracks: Track[]): PhaseApplication[] {
    const ranked = tracks
        .flatMap((track) => track.phases.map((phase) => phaseApplication(project, track, phase)))
        .filter((application): application is PhaseApplication => application !== null)
        .sort((a, b) => b.score - a.score || b.improvement.length - a.improvement.length);

    const perTrack = new Map<string, number>();
    const picked: PhaseApplication[] = [];
    for (const application of ranked) {
        const used = perTrack.get(application.trackId) ?? 0;
        if (used >= MAX_PER_TRACK || picked.length >= MAX_PHASES) continue;
        perTrack.set(application.trackId, used + 1);
        picked.push(application);
    }
    return picked;
}

/** Línea Markdown para el ROADMAP.md del proyecto. */
export function asRoadmapTask(title: string, application: Pick<PhaseApplication, "trackTitle" | "phaseTitle">): string {
    return `- [ ] ${title.trim()} (${application.trackTitle} · ${application.phaseTitle})`;
}
