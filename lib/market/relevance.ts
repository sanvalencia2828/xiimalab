/**
 * lib/market/relevance.ts
 * Demanda de skills en las hackatones: el informe de /api/market/skill-relevance
 * (etiquetas más frecuentes) y el conteo por skill que usa el dashboard.
 */
import { findSkills } from "@/lib/learning/skills";

const SKILL_COMPLEXITY: Record<string, number> = {
    "AI": 1.0, "ML": 1.0, "LLM": 1.0, "GPT": 1.0, "MACHINE LEARNING": 1.0,
    "BLOCKCHAIN": 0.9, "WEB3": 0.9, "DEFI": 0.9, "NFT": 0.8, "SOLANA": 0.85,
    "RUST": 0.95, "GO": 0.85, "TYPESCRIPT": 0.6, "JAVASCRIPT": 0.5, "PYTHON": 0.55,
    "REACT": 0.65, "NEXT.JS": 0.7, "NODE.JS": 0.65, "SVELTE": 0.6,
    "POSTGRESQL": 0.7, "MONGODB": 0.7, "DOCKER": 0.75, "KUBERNETES": 0.9,
    "AWS": 0.8, "GCP": 0.8, "AZURE": 0.8, "GRAPHQL": 0.7, "REST API": 0.55,
    "SECURITY": 0.85, "CRYPTOGRAPHY": 0.9, "ZKP": 0.95, "DATA SCIENCE": 0.85,
};

function getComplexity(skill: string): number {
    const upper = skill.toUpperCase();
    for (const [key, value] of Object.entries(SKILL_COMPLEXITY)) {
        if (upper.includes(key.toUpperCase()) || key.toUpperCase().includes(upper)) {
            return value;
        }
    }
    return 0.5;
}

export interface RelevanceReport {
    relevance_report: Array<{ skill: string; score: number; trend: "up" | "stable" }>;
    total_skills_analyzed: number;
    total_hackathons: number;
    generated_at: string;
}

export function calculateRelevance(hackathons: Array<{ tags?: string[] | null }>): RelevanceReport {
    const tagCounts: Record<string, number> = {};

    hackathons.forEach(hack => {
        const tags = hack.tags || [];
        const seen = new Set<string>();
        tags.forEach(tag => {
            const clean = tag.trim();
            if (clean && !seen.has(clean.toLowerCase())) {
                tagCounts[clean] = (tagCounts[clean] || 0) + 1;
                seen.add(clean.toLowerCase());
            }
        });
    });

    const maxFreq = Math.max(...Object.values(tagCounts), 1);
    const total = hackathons.length || 1;

    const scored = Object.entries(tagCounts)
        .map(([skill, freq]) => {
            const freqScore = (freq / maxFreq) * 100;
            const complexity = getComplexity(skill);
            const complexityScore = complexity * 100;
            const score = Math.min(100, Math.round(freqScore * 0.6 + complexityScore * 0.4));
            const trend: "up" | "stable" = freq >= 3 && freq >= total * 0.15 ? "up" : "stable";
            return { skill, score, trend };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    return {
        relevance_report: scored,
        total_skills_analyzed: Object.keys(tagCounts).length,
        total_hackathons: hackathons.length,
        generated_at: new Date().toISOString(),
    };
}

/** Nº de hackatones cuyas etiquetas mencionan cada skill. */
export function skillDemand(skills: string[], hackathons: Array<{ tags?: string[] | null }>): Record<string, number> {
    const counts: Record<string, number> = Object.fromEntries(skills.map((skill) => [skill, 0]));
    for (const h of hackathons) {
        for (const skill of findSkills(skills, h.tags ?? [])) counts[skill] = (counts[skill] ?? 0) + 1;
    }
    return counts;
}

// Una skill tiene demanda alta si aparece en al menos esta fracción de las
// convocatorias de la skill más pedida, y nunca con menos de HIGH_DEMAND_MIN.
export const HIGH_DEMAND_RATIO = 0.25;
export const HIGH_DEMAND_MIN = 3;

export function highDemandThreshold(demand: Record<string, number>): number {
    const top = Math.max(0, ...Object.values(demand));
    return Math.max(HIGH_DEMAND_MIN, Math.ceil(top * HIGH_DEMAND_RATIO));
}
