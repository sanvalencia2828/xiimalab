"use server";

import { getRepoProgress, repoFromUrl, type ProjectProgress } from "@/lib/projects/progress";

export interface ProgressRequest {
    title: string;
    githubUrl?: string;
    liveUrl?: string;
}

/**
 * Calcula el avance de varios proyectos a la vez (en paralelo).
 * Devuelve un mapa título → progreso. Los proyectos sin repo de GitHub no aparecen.
 */
export async function getProjectsProgressAction(
    projects: ProgressRequest[],
): Promise<Record<string, ProjectProgress>> {
    const entries = await Promise.all(
        projects.slice(0, 30).map(async (p) => {
            const repo = repoFromUrl(p.githubUrl);
            if (!repo) return null;
            return [p.title, await getRepoProgress(repo, p.liveUrl ?? null)] as const;
        }),
    );
    return Object.fromEntries(entries.filter((e): e is readonly [string, ProjectProgress] => e !== null));
}
