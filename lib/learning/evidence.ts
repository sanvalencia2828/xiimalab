/**
 * lib/learning/evidence.ts
 * Evidencia hito → proyecto: el usuario confirma en el track que aplicó un
 * hito en un proyecto del portafolio (ver hooks/useMilestoneEvidence.ts).
 *
 * Un hito no tiene skills propias: la evidencia cuenta para las skills de su
 * fase, y solo mientras el hito siga marcado como hecho.
 */
import { projectName } from "./applications";
import { type LearningState, migrateMilestoneKeys } from "./progress";
import { canonicalSkills } from "./skills";
import { TRACKS } from "./tracks";

/** id del hito → nombre corto del proyecto ("Rastreador") */
export type MilestoneEvidence = Record<string, string>;

const PHASE_SKILLS = new Map<string, string[]>(
    TRACKS.flatMap((track) => track.phases).flatMap((phase) => {
        const skills = canonicalSkills(phase.skills);
        return phase.milestones.map((milestone): [string, string[]] => [milestone.id, skills]);
    }),
);

/** Evidencia guardada con ids antiguos → ids actuales; un hito fusionado conserva el proyecto del primero de sus orígenes. */
export function migrateEvidence(evidence: MilestoneEvidence): MilestoneEvidence {
    return migrateMilestoneKeys(evidence, (projects) => projects[0]);
}

/** Evidencia recibida del cliente: solo hitos que existen y proyectos del portafolio. */
export function parseMilestoneEvidence(raw: unknown, projectTitles: string[]): MilestoneEvidence {
    if (!raw || typeof raw !== "object") return {};
    const names = new Set(projectTitles.map(projectName));
    const strings = Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
    return Object.fromEntries(
        Object.entries(migrateEvidence(strings)).filter(([id, project]) => PHASE_SKILLS.has(id) && names.has(project)),
    );
}

/** Skills que cada proyecto demuestra por evidencia: las de la fase de cada hito hecho que se le atribuyó. */
export function evidenceSkills(evidence: MilestoneEvidence, state: LearningState): Map<string, string[]> {
    const byProject = new Map<string, Set<string>>();
    for (const [milestoneId, project] of Object.entries(evidence)) {
        if (!state.done[milestoneId]) continue;
        const skills = byProject.get(project) ?? new Set<string>();
        for (const skill of PHASE_SKILLS.get(milestoneId) ?? []) skills.add(skill);
        byProject.set(project, skills);
    }
    return new Map(Array.from(byProject, ([project, skills]) => [project, Array.from(skills)]));
}

/** Añade a cada proyecto las skills que demuestra por evidencia, además de las de su stack. */
export function withEvidence<T extends { name: string; skills: string[] }>(
    projects: T[],
    evidence: MilestoneEvidence,
    state: LearningState,
): T[] {
    const extra = evidenceSkills(evidence, state);
    if (extra.size === 0) return projects;
    return projects.map((project) => {
        const added = (extra.get(project.name) ?? []).filter((skill) => !project.skills.includes(skill));
        return added.length > 0 ? { ...project, skills: [...project.skills, ...added] } : project;
    });
}
