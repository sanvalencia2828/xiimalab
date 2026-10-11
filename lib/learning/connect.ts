/**
 * lib/learning/connect.ts
 * Cruce de una fase con las hackatones abiertas y con los proyectos del
 * portafolio, por coincidencia entre sus skills y las etiquetas o el stack.
 */
import type { Phase } from "./tracks";

export interface PhaseHackathon {
    id: string;
    title: string;
    deadline: string;      // "YYYY-MM-DD"
    url: string | null;
    source: string;
    matchedSkills: string[];
}

export interface PhaseProject {
    title: string;
    url: string | null;
    matchedSkills: string[];
}

interface HackathonLike {
    id: string;
    title: string;
    tags: string[];
    deadline: string;
    source: string;
    source_url: string | null;
}

interface ProjectLike {
    title: string;
    stack: string[];
    liveUrl?: string;
    githubUrl?: string;
}

const MAX_HACKATHONS = 3;

/** Las skills cortas (ai, ml, nft, llm…) solo cuentan como palabra completa. */
function hasSkill(text: string, skill: string): boolean {
    if (skill.length <= 3) return new RegExp(`(^|[^a-z0-9])${skill}([^a-z0-9]|$)`).test(text);
    return text.includes(skill);
}

function matched(skills: string[], labels: string[]): string[] {
    const text = labels.join(" | ").toLowerCase();
    return skills.filter((skill) => hasSkill(text, skill));
}

/** Hackatones abiertas cuyas etiquetas coinciden con las skills de la fase (máximo 3). */
export function hackathonsForPhase(phase: Phase, hackathons: HackathonLike[]): PhaseHackathon[] {
    return hackathons
        .map((h) => ({ h, skills: matched(phase.skills, h.tags ?? []) }))
        .filter(({ skills }) => skills.length > 0)
        .sort((a, b) => b.skills.length - a.skills.length || a.h.deadline.localeCompare(b.h.deadline))
        .slice(0, MAX_HACKATHONS)
        .map(({ h, skills }) => ({
            id: h.id,
            title: h.title,
            deadline: h.deadline,
            url: h.source_url,
            source: h.source,
            matchedSkills: skills,
        }));
}

/** Proyectos del portafolio cuyo stack toca alguna skill de la fase. */
export function projectsForPhase(phase: Phase, projects: ProjectLike[]): PhaseProject[] {
    return projects
        .map((p) => ({ p, skills: matched(phase.skills, p.stack ?? []) }))
        .filter(({ skills }) => skills.length > 0)
        .sort((a, b) => b.skills.length - a.skills.length)
        .map(({ p, skills }) => ({ title: p.title, url: p.liveUrl ?? p.githubUrl ?? null, matchedSkills: skills }));
}

/** "Cierra hoy" · "Cierra mañana" · "Cierra en 5 días", a partir de "YYYY-MM-DD". */
export function closesIn(deadline: string, now: Date = new Date()): { label: string; urgent: boolean } {
    const m = deadline.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return { label: "Sin fecha de cierre", urgent: false };
    const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const days = Math.round((end - today) / 86_400_000);
    if (days < 0) return { label: "Cerrada", urgent: false };
    const label = days === 0 ? "Cierra hoy" : days === 1 ? "Cierra mañana" : `Cierra en ${days} días`;
    return { label, urgent: days < 3 };
}
