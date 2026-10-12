/**
 * lib/learning/impact.ts
 * Impacto de una fase: cuántos proyectos del portafolio tienen una necesidad
 * real que la fase enseña a resolver (`resuelve`, fijado a mano en tracks.ts).
 * La relevancia por stack (lib/learning/applications.ts) solo desempata.
 */
import { phaseApplication, type ProjectLike } from "./applications";
import type { Phase, Track } from "./tracks";

/** Proyectos con una necesidad real que la fase atiende, sin repetir. */
export function resolvedProjects(phase: Phase): string[] {
    return Array.from(new Set((phase.resuelve ?? []).flatMap((need) => need.projects)));
}

export function phaseImpact(phase: Phase): number {
    return resolvedProjects(phase).length;
}

/** Proyectos a los que la fase aplica por su stack y su tipo. */
export function phaseRelevance(track: Track, phase: Phase, projects: ProjectLike[]): number {
    return projects.filter((project) => phaseApplication(project, track, phase) !== null).length;
}

/** Orden de más a menos impacto; a igualdad, por relevancia. */
export function compareImpact(
    a: { track: Track; phase: Phase },
    b: { track: Track; phase: Phase },
    projects: ProjectLike[],
): number {
    return (
        phaseImpact(b.phase) - phaseImpact(a.phase) ||
        phaseRelevance(b.track, b.phase, projects) - phaseRelevance(a.track, a.phase, projects)
    );
}
