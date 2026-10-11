/**
 * lib/learning/skills.ts
 * Vocabulario de skills compartido por tracks, proyectos y hackatones: las
 * etiquetas de lib/hackathons/match.ts, sin las que describen un formato de
 * convocatoria ("open track") en vez de una skill.
 */
import { SKILL_WEIGHTS } from "@/lib/hackathons/match";
import { matchSkills } from "./connect";

const NOT_SKILLS = new Set(["open track", "open ended"]);

// Etiquetas de match.ts que nombran la misma skill: cuentan como una sola
const SYNONYMS: Record<string, string[]> = { ml: ["machine learning"] };
const CANONICAL: Record<string, string> = Object.fromEntries(
    Object.entries(SYNONYMS).flatMap(([skill, others]) => others.map((other) => [other, skill])),
);

/** Skills reconocidas (sin sinónimos repetidos), de mayor a menor peso en el match. */
export const SKILLS: string[] = Object.keys(SKILL_WEIGHTS)
    .filter((skill) => !NOT_SKILLS.has(skill) && !CANONICAL[skill])
    .sort((a, b) => SKILL_WEIGHTS[b] - SKILL_WEIGHTS[a]);

const LABELS: Record<string, string> = {
    ai: "AI",
    ml: "Machine Learning",
    llm: "LLM",
    agent: "Agentes",
    data: "Datos",
    analytics: "Analítica",
    devops: "DevOps",
    defi: "DeFi",
    nft: "NFT",
    web3: "Web3",
    "smart contract": "Smart contracts",
    fastapi: "FastAPI",
    typescript: "TypeScript",
    "next.js": "Next.js",
};

export function skillLabel(skill: string): string {
    return LABELS[skill] ?? skill.charAt(0).toUpperCase() + skill.slice(1);
}

// Tecnologías del stack que implican una skill sin nombrarla
const STACK_ALIASES: Record<string, string[]> = {
    openai: ["ai", "llm"],
    postgis: ["data"],
    postgresql: ["data"],
    supabase: ["data"],
};

/** Une los sinónimos: ["ml", "machine learning", "python"] → ["ml", "python"]. */
export function canonicalSkills(skills: string[]): string[] {
    return Array.from(new Set(skills.map((skill) => CANONICAL[skill] ?? skill)));
}

/** Skills que aparecen en unas etiquetas, contando los sinónimos como la misma skill. */
export function findSkills(skills: string[], labels: string[]): string[] {
    return canonicalSkills(skills).filter(
        (skill) => matchSkills([skill, ...(SYNONYMS[skill] ?? [])], labels).length > 0,
    );
}

/** Skills de un proyecto derivadas de su stack, de mayor a menor peso. */
export function skillsFromStack(stack: string[]): string[] {
    const found = new Set(findSkills(SKILLS, stack));
    for (const item of stack) {
        for (const skill of STACK_ALIASES[item.trim().toLowerCase()] ?? []) found.add(skill);
    }
    return SKILLS.filter((skill) => found.has(skill));
}
