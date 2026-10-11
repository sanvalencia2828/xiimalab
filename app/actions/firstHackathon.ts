"use server";

import { buildFirstHackathon, type FirstHackathonData } from "@/lib/first-hackathon/build";
import { parseFirstHackathonState } from "@/lib/first-hackathon/plan";
import { sanitizeLearningState } from "@/lib/learning/progress";
import { parseCertifications } from "@/lib/profile/certifications";

/**
 * Datos del "Modo primera hackatón" calculados en el servidor. El plan, el
 * avance de los tracks y las certificaciones viven en el navegador, así que
 * el cliente los envía aquí y se validan antes de usarlos.
 */
export async function getFirstHackathonAction(
    rawPlan: unknown,
    rawLearning: unknown = null,
    rawCertifications: unknown = null,
): Promise<FirstHackathonData> {
    return buildFirstHackathon(
        parseFirstHackathonState(rawPlan),
        sanitizeLearningState(rawLearning),
        parseCertifications(rawCertifications),
    );
}
