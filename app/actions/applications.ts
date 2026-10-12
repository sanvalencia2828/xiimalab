"use server";

import { applicationsForProject, phaseApplication, type PhaseApplication } from "@/lib/learning/applications";
import { getApplicationExample } from "@/lib/learning/examples";
import { generalPractice, manualPractice, practiceType, sortPractices } from "@/lib/learning/practices";
import { TRACKS, getTrack, type Phase, type Practice, type Track } from "@/lib/learning/tracks";
import { PROJECTS } from "@/lib/projects/data";

type Project = (typeof PROJECTS)[number];

/** Una fase que aplica a un proyecto, con su práctica. */
export interface AppliedPractice extends PhaseApplication {
    practica: Practice;
}

/**
 * La práctica del proyecto en la fase: la escrita a mano si existe; si no, la
 * de la IA (7 días de caché) y, sin IA, la general.
 */
async function resolvePractice(project: Project, track: Track, phase: Phase, application: PhaseApplication): Promise<Practice> {
    const manual = manualPractice(phase, project);
    if (manual) return manual;
    const example = await getApplicationExample(project, track, phase);
    if (example.general) return generalPractice(project, phase, application);
    return {
        project: application.projectName,
        title: example.title,
        type: practiceType(application),
        what: example.what,
        steps: example.steps,
        milestones: example.milestones,
        effort: example.effort,
        origin: "IA",
    };
}

/**
 * Fases aplicables a un proyecto, con la práctica de cada una.
 * Recibe solo el título: el proyecto se resuelve desde PROJECTS y las fases
 * salen de lib/learning/applications.ts, así un cliente no puede pedir a la
 * IA combinaciones arbitrarias ni pasarle texto propio.
 */
export async function getProjectPracticesAction(projectTitle: unknown): Promise<AppliedPractice[]> {
    const project = PROJECTS.find((p) => p.title === projectTitle);
    if (!project) return [];
    const applied = await Promise.all(
        applicationsForProject(project, TRACKS).map(async (application) => {
            const track = getTrack(application.trackId);
            const phase = track?.phases.find((p) => p.id === application.phaseId);
            if (!track || !phase) return null;
            return { ...application, practica: await resolvePractice(project, track, phase, application) };
        }),
    );
    return applied.filter((a): a is AppliedPractice => a !== null);
}

/** Proyectos prácticos de cada fase de un track: uno por cada proyecto que la toca, por id de fase. */
export async function getTrackPracticesAction(trackId: unknown): Promise<Record<string, Practice[]>> {
    const track = typeof trackId === "string" ? getTrack(trackId) : undefined;
    if (!track) return {};
    const entries = await Promise.all(
        track.phases.map(async (phase) => {
            const practices = await Promise.all(
                PROJECTS.map((project) => {
                    const application = phaseApplication(project, track, phase);
                    return application ? resolvePractice(project, track, phase, application) : null;
                }),
            );
            return [phase.id, sortPractices(practices.filter((p): p is Practice => p !== null))] as const;
        }),
    );
    return Object.fromEntries(entries);
}
