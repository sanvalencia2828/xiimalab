/**
 * lib/first-hackathon/build.ts — SERVER ONLY
 * Datos del "Modo primera hackatón": las candidatas del día 1 (agregador en
 * vivo) y, para la hackatón elegida, el proyecto que mejor encaja, las skills
 * por reforzar y los hitos que sugerir al terminar. Reutiliza los cálculos
 * del dashboard (lib/dashboard/build.ts).
 *
 * Si el agregador falla no hay candidatas; nunca se rellenan con ejemplos.
 */
import { bestProjectFor, loadHackathons, loadProjects, reinforcePath } from "@/lib/dashboard/build";
import type { SkillChip, SkillRow } from "@/lib/dashboard/types";
import { isTrackActive, type LearningState } from "@/lib/learning/progress";
import { findSkills, SKILLS, skillLabel } from "@/lib/learning/skills";
import { TRACKS } from "@/lib/learning/tracks";
import { certificationFor, type Certification } from "@/lib/profile/certifications";
import { type Candidate, type FirstHackathonState, pickCandidates } from "./plan";

const MAX_MILESTONES = 3;

export interface ReinforceSkill extends SkillChip, Pick<SkillRow, "track" | "milestone" | "resource"> {}

export interface MilestoneSuggestion {
    id: string;
    text: string;
    trackId: string;
    trackTitle: string;
    href: string;
}

export interface PlanInsights {
    /** Skills reconocidas en las etiquetas de la hackatón elegida */
    skills: SkillChip[];
    /** Proyecto del portafolio que mejor encaja, con las skills que comparte */
    project: { name: string; url: string | null; shared: string[] } | null;
    /** Skills que pide y no tienen ni proyecto ni certificación */
    reinforce: ReinforceSkill[];
    /** Hitos pendientes de las fases que cubren sus skills */
    milestones: MilestoneSuggestion[];
}

export interface FirstHackathonData {
    /** false si el agregador de hackatones no respondió */
    hackathonsAvailable: boolean;
    candidates: Candidate[];
    /** null hasta que se elige una hackatón */
    plan: PlanInsights | null;
}

async function insights(tags: string[], learning: LearningState, certifications: Certification[]): Promise<PlanInsights> {
    const projects = await loadProjects();
    const asked = findSkills(SKILLS, tags);
    const activeIds = new Set(TRACKS.filter((track) => isTrackActive(track, learning)).map((t) => t.id));
    const paths = asked.map((skill) => ({ key: skill, label: skillLabel(skill), ...reinforcePath(skill, learning, activeIds) }));
    const best = bestProjectFor(asked, projects);

    const milestones = new Map<string, MilestoneSuggestion>();
    for (const { track, milestone } of paths) {
        if (!track || !milestone || milestones.size >= MAX_MILESTONES) continue;
        milestones.set(milestone.id, { ...milestone, trackId: track.id, trackTitle: track.title });
    }

    return {
        skills: paths.map(({ key, label }) => ({ key, label })),
        project: best
            ? { name: best.name, url: best.url, shared: asked.filter((skill) => best.skills.includes(skill)).map(skillLabel) }
            : null,
        reinforce: paths.filter(
            ({ key }) => !projects.some((p) => p.skills.includes(key)) && !certificationFor(key, certifications),
        ),
        milestones: Array.from(milestones.values()),
    };
}

export async function buildFirstHackathon(
    plan: FirstHackathonState,
    learning: LearningState,
    certifications: Certification[] = [],
    now: Date = new Date(),
): Promise<FirstHackathonData> {
    const [live, planInsights] = await Promise.all([
        loadHackathons(),
        plan.hackathon ? insights(plan.hackathon.tags, learning, certifications) : null,
    ]);
    return {
        hackathonsAvailable: live !== null,
        candidates: live ? pickCandidates(live.hackathons, now) : [],
        plan: planInsights,
    };
}
