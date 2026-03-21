"use server";

import { getApiBase } from "@/lib/api";

export interface SkillResource {
    skill: string;
    difficulty: string;
    category: string;
    resources: {
        courses?: Array<{ name: string; url: string; type: string; duration?: string }>;
        tutorials?: Array<{ name: string; url: string; type: string }>;
        projects?: string[];
    };
}

export interface LearningResourcesResponse {
    resources: SkillResource[];
    total_estimated_hours: number;
    recommended_order: string[];
    summary?: {
        foundation_skills: string[];
        intermediate_skills: string[];
        advanced_skills: string[];
    };
}

/**
 * Fetch learning resources for a list of skills
 * @param skills - Array of skill names, e.g., ["Solidity", "React"]
 * @returns Learning resources with courses, tutorials, and projects
 */
export async function getLearningResourcesAction(skills: string[]): Promise<LearningResourcesResponse> {
    if (!skills || skills.length === 0) {
        return {
            resources: [],
            total_estimated_hours: 0,
            recommended_order: [],
        };
    }

    try {
        const API_URL = getApiBase();
        if (!API_URL) {
            console.warn("[getLearningResources] API URL not configured");
            return {
                resources: [],
                total_estimated_hours: 0,
                recommended_order: [],
            };
        }

        const skillsQuery = skills.join(",");
        const res = await fetch(`${API_URL}/learning/resources?skills=${encodeURIComponent(skillsQuery)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "force-cache", // Cache these resources for 1 hour
        });

        if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
        }

        const data = (await res.json()) as LearningResourcesResponse;
        return data;
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("[getLearningResources] Error:", errorMsg);

        // Return empty response gracefully
        return {
            resources: [],
            total_estimated_hours: 0,
            recommended_order: [],
        };
    }
}

/**
 * Fetch detailed roadmap for a specific skill
 * @param skill - Skill name, e.g., "Solidity"
 * @returns Detailed roadmap with prerequisites and study tips
 */
export async function getSkillRoadmapAction(skill: string) {
    try {
        const API_URL = getApiBase();
        if (!API_URL) {
            console.warn("[getSkillRoadmap] API URL not configured");
            return { found: false };
        }

        const res = await fetch(`${API_URL}/learning/roadmap/${encodeURIComponent(skill)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "force-cache",
        });

        if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
        }

        return await res.json();
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("[getSkillRoadmap] Error:", errorMsg);
        return { found: false };
    }
}

export interface RoadmapStep {
    title: string;
    duration: string;
    type: "Video" | "Project" | "Doc";
    description: string;
}

export interface LearningRoadmap {
    skill: string;
    target_level: number;
    roadmap: RoadmapStep[];
    estimated_total: string;
    source: "ai" | "fallback" | "default";
}

export async function getLearningRoadmapAction(
    skill: string,
    target: number = 60
): Promise<LearningRoadmap | { error: string }> {
    try {
        const vercelUrl = process.env.VERCEL_URL;
        const base = vercelUrl
            ? `https://${vercelUrl}`
            : (process.env.NEXTAUTH_URL ?? "http://localhost:3000");

        const response = await fetch(
            `${base}/api/learning/roadmap?skill=${encodeURIComponent(skill)}&target=${target}`,
            {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                next: { revalidate: 3600 },
            }
        );

        if (!response.ok) {
            console.error("Learning Roadmap API Error:", response.status);
            return { error: "No se pudo obtener la ruta de aprendizaje" };
        }

        return await response.json();
    } catch (error) {
        console.error("Get Learning Roadmap Error:", error);
        return { error: "Error de conexión con el servidor" };
    }
}
