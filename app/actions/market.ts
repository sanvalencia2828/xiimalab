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
        // Llamada directa al handler (sin ida y vuelta HTTP a VERCEL_URL)
        const { GET } = await import("@/app/api/market/skill-relevance/route");
        const response = await GET();

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
