/**
 * lib/learning/skills.ts
 * Vocabulario de skills compartido por tracks, proyectos y hackatones: las
 * etiquetas de lib/hackathons/match.ts (las que pesan en el match y las propias
 * de los tracks), sin las que describen un formato de convocatoria ("open
 * track") en vez de una skill.
 */
import { LEARNING_SKILLS, SKILL_SYNONYMS, SKILL_WEIGHTS } from "@/lib/hackathons/match";
import { matchSkills } from "./connect";

const NOT_SKILLS = new Set(["open track", "open ended"]);

// Etiquetas con peso propio que son sinónimo de otra ("machine learning" → "ml"): cuentan como una sola skill
const CANONICAL: Record<string, string> = Object.fromEntries(
    Object.entries(SKILL_SYNONYMS).flatMap(([skill, others]) =>
        others.filter((other) => other in SKILL_WEIGHTS).map((other) => [other, skill]),
    ),
);

/** Skills reconocidas (sin sinónimos repetidos): primero las del match, de mayor a menor peso, y después las de los tracks. */
export const SKILLS: string[] = [
    ...Object.keys(SKILL_WEIGHTS)
        .filter((skill) => !NOT_SKILLS.has(skill) && !CANONICAL[skill])
        .sort((a, b) => SKILL_WEIGHTS[b] - SKILL_WEIGHTS[a]),
    ...LEARNING_SKILLS,
];

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
    rag: "RAG",
    evaluation: "Evaluación",
    "fine-tuning": "Fine-tuning",
    "tool use": "Tool use",
    mcp: "MCP",
    orchestration: "Orquestación",
    memory: "Memoria",
    "multi-agent": "Multi-agente",
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
    return matchSkills(canonicalSkills(skills), labels);
}

/** Skills de un proyecto derivadas de su stack, de mayor a menor peso. */
export function skillsFromStack(stack: string[]): string[] {
    const found = new Set(findSkills(SKILLS, stack));
    for (const item of stack) {
        for (const skill of STACK_ALIASES[item.trim().toLowerCase()] ?? []) found.add(skill);
    }
    return SKILLS.filter((skill) => found.has(skill));
}
