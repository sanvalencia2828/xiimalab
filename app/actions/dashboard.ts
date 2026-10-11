"use server";

import { buildDashboard } from "@/lib/dashboard/build";
import type { DashboardData } from "@/lib/dashboard/types";
import { parseFirstHackathonState, submission } from "@/lib/first-hackathon/plan";
import { parseHackathonAction } from "@/lib/hackathons/actions";
import { sanitizeLearningState } from "@/lib/learning/progress";
import { parseCertifications } from "@/lib/profile/certifications";

/**
 * Dashboard del Estudiante calculado en el servidor.
 * El avance de los tracks, la primera acción sobre una hackatón con match alto,
 * las certificaciones y el plan de la primera hackatón viven en el navegador, así que el cliente los envía
 * aquí; se validan antes de usarlos (el avance, contra los hitos de
 * lib/learning/tracks.ts).
 */
export async function getDashboardAction(
    rawState: unknown,
    rawMatchAction: unknown = null,
    rawCertifications: unknown = null,
    rawFirstHackathon: unknown = null,
): Promise<DashboardData> {
    return buildDashboard(
        sanitizeLearningState(rawState),
        parseHackathonAction(rawMatchAction),
        parseCertifications(rawCertifications),
        submission(parseFirstHackathonState(rawFirstHackathon)),
    );
}
