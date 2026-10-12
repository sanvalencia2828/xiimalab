/**
 * lib/learning/practices.ts
 * Proyectos prácticos de una fase: uno por cada proyecto del portafolio que la
 * toca. Cálculo puro.
 *
 *   • Manual  → escrita a mano en lib/learning/practices-data.ts.
 *   • IA      → generada por lib/learning/examples.ts (la añade el servidor).
 *   • General → el texto de la fase adaptado al proyecto, mientras no haya
 *               una manual ni una de la IA.
 *
 * Un proyecto "toca" una fase si tiene una práctica manual en ella o si la
 * fase le aplica (lib/learning/applications.ts).
 */
import { phaseApplication, type PhaseApplication, type ProjectLike, projectName } from "./applications";
import type { Effort, Phase, Practice, PracticeType, Track } from "./tracks";

const GENERAL_STEPS = 3;
const TYPE_ORDER: PracticeType[] = ["Mejora", "Nueva función"];
const EFFORT_ORDER: (Effort | null)[] = ["S", "M", "L", null];

/** "Mejora" si el proyecto ya usa alguna skill de la fase; si no, es una función nueva para él. */
export function practiceType(application: Pick<PhaseApplication, "affinity">): PracticeType {
    return application.affinity.length > 0 ? "Mejora" : "Nueva función";
}

/** Primero las mejoras y después las funciones nuevas; dentro, de menos a más esfuerzo. */
export function sortPractices(practices: Practice[]): Practice[] {
    return [...practices].sort(
        (a, b) =>
            TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
            EFFORT_ORDER.indexOf(a.effort) - EFFORT_ORDER.indexOf(b.effort) ||
            a.project.localeCompare(b.project),
    );
}

export function manualPractice(phase: Phase, project: ProjectLike): Practice | null {
    const name = projectName(project.title);
    return phase.practicas.find((practice) => practice.project === name) ?? null;
}

/** El texto de la fase adaptado al proyecto: sirve mientras no haya una práctica manual ni de la IA. */
export function generalPractice(project: ProjectLike, phase: Phase, application: PhaseApplication | null): Practice {
    const name = projectName(project.title);
    const own = phase.practicaGeneral.portfolioTitle === project.title;
    return {
        project: name,
        title: own ? phase.practicaGeneral.idea : `Aplicar «${phase.title}» en ${name}`,
        type: application ? practiceType(application) : "Nueva función",
        what: own
            ? phase.objective
            : `${phase.objective} En ${name}${application?.reason ? `: ${application.reason.charAt(0).toLowerCase()}${application.reason.slice(1)}` : ""}.`,
        steps: phase.milestones.slice(0, GENERAL_STEPS).map((milestone) => milestone.text),
        milestones: [],
        effort: null,
        origin: "General",
    };
}

/** La práctica del proyecto en la fase: la manual si existe; si no, la general. null si la fase no lo toca. */
export function practiceFor(project: ProjectLike, track: Track, phase: Phase): Practice | null {
    const manual = manualPractice(phase, project);
    if (manual) return manual;
    const application = phaseApplication(project, track, phase);
    return application ? generalPractice(project, phase, application) : null;
}

/** Una práctica por cada proyecto que toca la fase, ya ordenadas. */
export function phasePractices(track: Track, phase: Phase, projects: ProjectLike[]): Practice[] {
    return sortPractices(
        projects.map((project) => practiceFor(project, track, phase)).filter((practice): practice is Practice => practice !== null),
    );
}

/** Hitos de la fase que el usuario registró como demostrados en el proyecto (y siguen marcados). */
export function demonstratedIn(phase: Phase, project: string, evidence: Record<string, string>, done: Record<string, string>): number {
    return phase.milestones.filter((milestone) => done[milestone.id] && evidence[milestone.id] === project).length;
}
