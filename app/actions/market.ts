"use server";

export interface SkillRelevance {
    skill: string;
    score: number;
    trend: "up" | "stable";
}

export interface SkillRelevanceReport {
    relevance_report: SkillRelevance[];
    total_skills_analyzed: number;
    total_hackathons: number;
    generated_at: string;
}

export async function getSkillRelevanceAction(): Promise<SkillRelevanceReport | { error: string }> {
    try {
        const vercelUrl = process.env.VERCEL_URL;
        const base = vercelUrl
            ? `https://${vercelUrl}`
            : (process.env.NEXTAUTH_URL ?? "http://localhost:3000");

        const response = await fetch(`${base}/api/market/skill-relevance`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            next: { revalidate: 3600 },
        });

        if (!response.ok) {
            console.error("Skill Relevance API Error:", response.status);
            return { error: "No se pudo obtener el análisis de relevancia" };
        }

        return await response.json();
    } catch (error) {
        console.error("Get Skill Relevance Error:", error);
        return { error: "Error de conexión con el servidor de análisis" };
    }
}
