"use server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PortfolioData {
    wallet_address: string;
    generated_at: string;
    summary: string;
    total_skills: number;
    total_hackathons: number;
    total_achievements: number;
    skills: Array<{
        name: string;
        level: number;
        category: string;
        years_experience?: number;
        projects_count: number;
    }>;
    hackathons: Array<{
        id: string;
        title: string;
        prize_pool: number;
        date: string;
        role: string;
        skills_used: string[];
    }>;
    achievements: Array<{
        id: string;
        title: string;
        description: string;
        icon: string;
        earned_at: string;
        category: string;
    }>;
    cognitive_profile?: {
        dominant_category: string;
        strengths: string[];
        neuroplasticity: number;
        learning_style: string;
    };
    market_position: {
        percentile: number;
        hackathons_won: number;
        total_earnings: number;
        skill_diversity: number;
    };
    recommendations: string[];
}

export interface PortfolioResponse {
    portfolio: PortfolioData;
    export_formats: string[];
}

export async function getPortfolio(walletAddress: string): Promise<PortfolioResponse> {
    try {
        const response = await fetch(`${API_URL}/portfolio/${walletAddress}`, {
            next: { revalidate: 300 },
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("[portfolio] Error fetching portfolio:", error);
        return {
            portfolio: {
                wallet_address: walletAddress,
                generated_at: new Date().toISOString(),
                summary: "Error cargando portafolio",
                total_skills: 0,
                total_hackathons: 0,
                total_achievements: 0,
                skills: [],
                hackathons: [],
                achievements: [],
                market_position: {
                    percentile: 0,
                    hackathons_won: 0,
                    total_earnings: 0,
                    skill_diversity: 0,
                },
                recommendations: [],
            },
            export_formats: ["json"],
        };
    }
}

export async function getPortfolioMarkdown(walletAddress: string): Promise<{ markdown: string; filename: string }> {
    try {
        const response = await fetch(`${API_URL}/portfolio/${walletAddress}/markdown`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("[portfolio] Error fetching markdown:", error);
        return {
            markdown: "# Error generating portfolio",
            filename: "error.md",
        };
    }
}
