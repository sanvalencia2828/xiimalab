"use server";

export interface PriorityHackathon {
    id: string;
    title: string;
    prize_pool: number;
    tags: string[];
    deadline: string;
    match_score: number;
    days_until_deadline: number;
    urgency_score: number;
    value_score: number;
    total_priority: number;
    reasoning: string;
}

export interface TagInsight {
    tag: string;
    count: number;
    percentage: number;
    avg_match_score: number;
    trend: "rising" | "stable" | "falling";
}

export interface MarketInsights {
    total_hackathons: number;
    avg_prize_pool: number;
    avg_match_score: number;
    top_tags: TagInsight[];
    urgent_hackathons: number;
    high_value_hackathons: number;
    recommended_actions: string[];
    prioritized_hackathons: PriorityHackathon[];
}

export interface PrioritiesResponse {
    insights: MarketInsights;
    generated_at: string;
}

export async function getPrioritiesAction(daysWindow: number = 30): Promise<PrioritiesResponse | { error: string }> {
    try {
        // Use internal Next.js API route (works on Vercel without FastAPI)
        const vercelUrl = process.env.VERCEL_URL;
        const base = vercelUrl
            ? `https://${vercelUrl}`
            : (process.env.NEXTAUTH_URL ?? "http://localhost:3000");

        const response = await fetch(`${base}/api/insights/priorities?days_window=${daysWindow}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            next: { revalidate: 300 },
        });

        if (!response.ok) {
            console.error("Insights API Error:", response.status);
            return { error: "No se pudo obtener el análisis de prioridades" };
        }

        return await response.json();
    } catch (error) {
        console.error("Get Priorities Error:", error);
        return { error: "Error de conexión con el servidor de análisis" };
    }
}

export async function getTagAnalysisAction(): Promise<{ tag_analysis: TagInsight[]; error?: string }> {
    try {
        const vercelUrl = process.env.VERCEL_URL;
        const base = vercelUrl
            ? `https://${vercelUrl}`
            : (process.env.NEXTAUTH_URL ?? "http://localhost:3000");

        const response = await fetch(`${base}/api/insights/priorities?days_window=90`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            next: { revalidate: 300 },
        });

        if (!response.ok) {
            return { tag_analysis: [], error: "No se pudo obtener el análisis de tags" };
        }

        const data = await response.json();
        return { tag_analysis: data?.insights?.top_tags ?? [] };
    } catch (error) {
        console.error("Tag Analysis Error:", error);
        return { tag_analysis: [], error: "Error de conexión" };
    }
}
