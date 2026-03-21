"use server";
import { getApiBase, safeFetch } from "@/lib/api";
// _API resolved at call time via getApiBase()

export interface MLRecommendation {
    hackathon_id: string;
    title: string;
    score: number;
    reason: string;
    skill_gaps: string[];
    potential_reward: number;
    risk_level: string;
    team_fit: string;
    learning_potential: string;
}

export interface MLRecommendationsResponse {
    recommendations: MLRecommendation[];
    user_profile_summary: {
        wallet: string;
        skills_count: number;
        top_skills: string[];
        neuroplasticity: number;
        cognitive_strengths: string[];
        profile_complete: boolean;
    };
    market_opportunities: {
        active_hackathons: number;
        avg_prize_pool: number;
        top_tags: string[];
        urgent_count: number;
        high_value_count: number;
    };
    generated_at: string;
    model_used: string;
}

export async function getMLRecommendations(walletAddress: string, limit: number = 5): Promise<MLRecommendationsResponse> {
    try {
        const response = await fetch(`${getApiBase() ?? ""}/ml/recommendations/${walletAddress}?limit=${limit}`, {
            next: { revalidate: 300 },
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("[mlRecommendations] Error fetching recommendations:", error);
        return {
            recommendations: [],
            user_profile_summary: {
                wallet: walletAddress,
                skills_count: 0,
                top_skills: [],
                neuroplasticity: 0,
                cognitive_strengths: [],
                profile_complete: false,
            },
            market_opportunities: {
                active_hackathons: 0,
                avg_prize_pool: 0,
                top_tags: [],
                urgent_count: 0,
                high_value_count: 0,
            },
            generated_at: new Date().toISOString(),
            model_used: "fallback",
        };
    }
}

export async function getSkillGapsAnalysis(walletAddress: string) {
    try {
        const response = await fetch(`${getApiBase() ?? ""}/ml/skill-gaps/${walletAddress}`, {
            next: { revalidate: 600 },
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("[mlRecommendations] Error fetching skill gaps:", error);
        return { skill_gaps: [], oversupplied_skills: [], market_top_demands: [] };
    }
}
