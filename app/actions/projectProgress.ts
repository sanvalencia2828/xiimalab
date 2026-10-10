"use server";

import { getRepoProgress, repoFromUrl, type ProjectProgress } from "@/lib/projects/progress";
import { PROJECTS } from "@/lib/projects/data";

/**
 * Calcula el avance de varios proyectos a la vez (en paralelo).
 * Recibe solo títulos: las URLs de GitHub y de la demo se resuelven desde
 * PROJECTS en el servidor, así un cliente no puede hacer que el servidor
 * consulte URLs o repos arbitrarios.
 * Devuelve un mapa título → progreso. Los títulos desconocidos y los
 * proyectos sin repo de GitHub no aparecen.
 */
export async function getProjectsProgressAction(
    titles: string[],
): Promise<Record<string, ProjectProgress>> {
    const wanted = new Set(Array.isArray(titles) ? titles.filter((t): t is string => typeof t === "string") : []);
    const entries = await Promise.all(
        PROJECTS.filter((p) => wanted.has(p.title)).map(async (p) => {
            const repo = repoFromUrl(p.githubUrl);
            if (!repo) return null;
            return [p.title, await getRepoProgress(repo, p.liveUrl ?? null)] as const;
        }),
    );
    return Object.fromEntries(entries.filter((e): e is readonly [string, ProjectProgress] => e !== null));
}
