"use server";

import { buildDashboard } from "@/lib/dashboard/build";
import type { DashboardData } from "@/lib/dashboard/types";
import { parseHackathonAction } from "@/lib/hackathons/actions";
import { parseMilestoneEvidence } from "@/lib/learning/evidence";
import { sanitizeLearningState } from "@/lib/learning/progress";
import { parseCertifications } from "@/lib/profile/certifications";
import { PROJECTS } from "@/lib/projects/data";

/**
 * Dashboard del Estudiante calculado en el servidor.
 * El avance de los tracks, la primera acción sobre una hackatón con match alto,
 * las certificaciones y la evidencia hito → proyecto viven en el navegador, así que el cliente los envía
 * aquí; se validan antes de usarlos (el avance, contra los hitos de
 * lib/learning/tracks.ts).
 */
export async function getDashboardAction(
    rawState: unknown,
    rawMatchAction: unknown = null,
    rawCertifications: unknown = null,
    rawEvidence: unknown = null,
): Promise<DashboardData> {
    return buildDashboard(
        sanitizeLearningState(rawState),
        parseHackathonAction(rawMatchAction),
        parseCertifications(rawCertifications),
        parseMilestoneEvidence(rawEvidence, PROJECTS.map((p) => p.title)),
    );
}
