"use server";

import { IDEAS } from "@/lib/ideas/data";
import { skillsFromStack } from "@/lib/learning/skills";
import { countOpenHackathonsFor } from "@/lib/skills/insights";

/**
 * Para cada idea de lib/ideas/data.ts, cuántas hackatones abiertas piden alguna
 * de sus skills. Devuelve null si el agregador de hackatones no respondió.
 */
export async function getIdeasFitAction(): Promise<Record<string, number> | null> {
    return countOpenHackathonsFor(Object.fromEntries(IDEAS.map((idea) => [idea.id, skillsFromStack(idea.skills)])));
}
