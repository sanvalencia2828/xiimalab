"use server";

import { sanitizeLearningState } from "@/lib/learning/progress";
import { getSkillInsights, parseSkillEvidence } from "@/lib/skills/insights";
import type { SkillEvidenceInput, SkillInsights } from "@/lib/skills/types";

/**
 * Skills frente al mercado (pestaña "Mercado" de /skills), calculado en el
 * servidor. El avance de los tracks, las certificaciones y la lista de skills
 * declaradas viven en el navegador: el cliente los envía y aquí se validan
 * antes de usarlos.
 */
export async function getSkillInsightsAction(rawState: unknown, rawEvidence?: SkillEvidenceInput): Promise<SkillInsights> {
    return getSkillInsights(sanitizeLearningState(rawState), parseSkillEvidence(rawEvidence));
}
