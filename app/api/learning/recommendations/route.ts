import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FALLBACK_MATCHING: Record<string, string> = {
    "python": "Tu experiencia en Python te permite implementar rápidamente los algoritmos requeridos.",
    "react": "Tu dominio de React te da ventaja en el desarrollo del frontend.",
    "blockchain": "Tu conocimiento en Blockchain es clave para la arquitectura que pide este reto.",
    "ai": "Tu background en AI/ML te posiciona perfectamente para el análisis de datos.",
    "web3": "Tu experiencia en Web3.js es esencial para el puente de tokens.",
    "solidity": "Tu skill en Solidity te permite desplegar contratos seguros.",
    "default": "Tu combinación de skills técnicos te da ventaja competitiva.",
};

function getReasoningPhrase(skill: string): string {
    const skillLower = skill.toLowerCase();
    for (const [key, phrase] of Object.entries(FALLBACK_MATCHING)) {
        if (skillLower.includes(key)) {
            return phrase;
        }
    }
    return FALLBACK_MATCHING["default"];
}

function calculateMatch(userSkills: string[], hackTags: string[]): { skill: string; score: number; reasoning: string } | null {
    const userSet = new Set(userSkills.map(s => s.toLowerCase()));
    
    for (const tag of hackTags) {
        const tagLower = tag.toLowerCase();
        for (const skill of userSkills) {
            const skillLower = skill.toLowerCase();
            if (tagLower.includes(skillLower) || skillLower.includes(tagLower)) {
                const score = Math.min(95, 40 + Math.round(Math.random() * 40));
                return {
                    skill: skill,
                    score,
                    reasoning: getReasoningPhrase(skill),
                };
            }
        }
    }
    
    return null;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const skills = searchParams.get("skills") || "";
    const hackathonsJson = searchParams.get("hackathons") || "[]";

    const userSkills = skills.split(",").map(s => s.trim()).filter(Boolean);
    
    let hackathons: Array<{
        id: string;
        title: string;
        tags?: string[];
        match_score?: number;
    }> = [];
    
    try {
        hackathons = JSON.parse(hackathonsJson);
    } catch {
        hackathons = [];
    }

    const recommendations: Array<{
        hackathon_id: string;
        hackathon_title: string;
        matching_skill: string;
        reasoning_phrase: string;
        potential_growth_score: number;
        match_score: number;
    }> = [];

    for (const hack of hackathons) {
        const match = calculateMatch(userSkills, hack.tags || []);
        if (match) {
            const growthScore = Math.min(100, 30 + Math.round(Math.random() * 50));
            recommendations.push({
                hackathon_id: hack.id,
                hackathon_title: hack.title,
                matching_skill: match.skill,
                reasoning_phrase: match.reasoning,
                potential_growth_score: growthScore,
                match_score: hack.match_score || match.score,
            });
        }
    }

    recommendations.sort((a, b) => b.match_score - a.match_score);
    const top3 = recommendations.slice(0, 3);

    return NextResponse.json({
        recommendations: top3,
        generated_at: new Date().toISOString(),
        source: "statistical",
    });
}
