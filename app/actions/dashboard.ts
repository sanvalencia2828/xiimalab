"use server";

import { buildDashboard } from "@/lib/dashboard/build";
import type { DashboardData } from "@/lib/dashboard/types";
import { parseLearningState, type LearningState } from "@/lib/learning/progress";
import { TRACKS } from "@/lib/learning/tracks";

const TRACK_IDS = new Set(TRACKS.map((track) => track.id));
const MILESTONE_IDS = new Set(TRACKS.flatMap((track) => track.phases.flatMap((phase) => phase.milestones.map((m) => m.id))));

/** Conserva solo ids conocidos con una fecha válida. */
function known(map: Record<string, string>, ids: Set<string>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(map).filter(([id, date]) => ids.has(id) && !Number.isNaN(new Date(date).getTime())),
    );
}

/**
 * Dashboard del Estudiante calculado en el servidor.
 * El avance de los tracks vive en el navegador, así que el cliente lo envía
 * aquí; se valida contra los hitos de lib/learning/tracks.ts antes de usarlo.
 */
export async function getDashboardAction(rawState: unknown): Promise<DashboardData> {
    const parsed = parseLearningState(JSON.stringify(rawState ?? null) ?? null);
    const state: LearningState = {
        done: known(parsed.done, MILESTONE_IDS),
        started: known(parsed.started, TRACK_IDS),
    };
    return buildDashboard(state);
}
