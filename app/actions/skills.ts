"use server";

import { sanitizeLearningState } from "@/lib/learning/progress";
import { getSkillInsights } from "@/lib/skills/insights";
import type { SkillInsights } from "@/lib/skills/types";

/**
 * Skills frente al mercado (pestaña "Mercado" de /skills), calculado en el
 * servidor. El avance de los tracks vive en el navegador: el cliente lo envía y
 * aquí se valida antes de usarlo.
 */
export async function getSkillInsightsAction(rawState: unknown): Promise<SkillInsights> {
    return getSkillInsights(sanitizeLearningState(rawState));
}
