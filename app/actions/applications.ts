"use server";

import { applicationsForProject, applicationsForTrack, type PhaseApplication } from "@/lib/learning/applications";
import { type ApplicationExample, getApplicationExample } from "@/lib/learning/examples";
import { TRACKS, getTrack } from "@/lib/learning/tracks";
import { PROJECTS } from "@/lib/projects/data";

/** Una fase que aplica a un proyecto, con su ejemplo práctico. */
export interface AppliedPhase extends PhaseApplication {
    example: ApplicationExample;
}

async function withExamples(applications: PhaseApplication[]): Promise<AppliedPhase[]> {
    const applied = await Promise.all(
        applications.map(async (application) => {
            const project = PROJECTS.find((p) => p.title === application.projectTitle);
            const track = getTrack(application.trackId);
            const phase = track?.phases.find((p) => p.id === application.phaseId);
            if (!project || !track || !phase) return null;
            return { ...application, example: await getApplicationExample(project, track, phase) };
        }),
    );
    return applied.filter((a): a is AppliedPhase => a !== null);
}

/**
 * Fases aplicables a un proyecto, con el ejemplo práctico de cada una.
 * Recibe solo el título: el proyecto se resuelve desde PROJECTS y las fases
 * salen de lib/learning/applications.ts, así un cliente no puede pedir a la
 * IA combinaciones arbitrarias ni pasarle texto propio.
 */
export async function getProjectApplicationsAction(projectTitle: unknown): Promise<AppliedPhase[]> {
    const project = PROJECTS.find((p) => p.title === projectTitle);
    return project ? withExamples(applicationsForProject(project, TRACKS)) : [];
}

/** Proyectos a los que aplica cada fase de un track, con el ejemplo práctico de cada uno. */
export async function getTrackApplicationsAction(trackId: unknown): Promise<AppliedPhase[]> {
    const track = typeof trackId === "string" ? getTrack(trackId) : undefined;
    return track ? withExamples(applicationsForTrack(track, PROJECTS, TRACKS)) : [];
}
