"use server";
import { getApiBase, safeFetch } from "@/lib/api";
// getApiBase() called inside each function to avoid module-level null

export interface SkillData {
    name: string;
    level: number;
    category: string;
    marketDemand: number;
    yearsExperience: number;
    lastUsed?: string;
}

export async function saveUserSkillsAction(
    walletAddress: string,
    skills: SkillData[]
): Promise<{ success: boolean; error?: string }> {
    if (!walletAddress) {
        return { success: false, error: "Wallet no conectada" };
    }

    try {
        const apiUrl = getApiBase(); if (!apiUrl) return null as any;
        
        const payload = {
            wallet_address: walletAddress,
            skills: skills.map(s => ({
                name: s.name,
                level: s.level,
                category: s.category,
                market_demand: s.marketDemand,
                years_experience: s.yearsExperience,
                last_used: s.lastUsed,
            })),
        };

        const response = await fetch(`${apiUrl}/skills/user/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("Skills API Error:", error);
            return { success: false, error: "Error guardando skills" };
        }

        return { success: true };
    } catch (error) {
        console.error("Save Skills Error:", error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "Error de conexión" 
        };
    }
}

export async function loadUserSkillsAction(
    walletAddress: string
): Promise<{ skills: SkillData[]; error?: string }> {
    if (!walletAddress) {
        return { skills: [], error: "Wallet no conectada" };
    }

    try {
        const apiUrl = getApiBase(); if (!apiUrl) return null as any;
        const response = await fetch(`${apiUrl}/skills/user/${walletAddress}`);

        if (!response.ok) {
            return { skills: [], error: "Error cargando skills" };
        }

        const data = await response.json();
        return {
            skills: (data.skills || []).map((s: any) => ({
                name: s.name,
                level: s.level,
                category: s.category,
                marketDemand: s.market_demand,
                yearsExperience: s.years_experience,
                lastUsed: s.last_used,
            })),
        };
    } catch (error) {
        console.error("Load Skills Error:", error);
        return { 
            skills: [], 
            error: error instanceof Error ? error.message : "Error de conexión" 
        };
    }
}

export async function logPracticeSessionAction(
    walletAddress: string,
    skillName: string,
    minutes: number
): Promise<{ 
    success: boolean; 
    newMastery?: number; 
    newStreak?: number;
    error?: string 
}> {
    if (!walletAddress) {
        return { success: false, error: "Wallet no conectada" };
    }

    try {
        const apiUrl = getApiBase(); if (!apiUrl) return null as any;
        const response = await fetch(
            `${apiUrl}/skills/user/${walletAddress}/practice?skill_name=${encodeURIComponent(skillName)}&minutes=${minutes}`,
            { method: "POST" }
        );

        if (!response.ok) {
            return { success: false, error: "Error registrando práctica" };
        }

        const data = await response.json();
        return {
            success: true,
            newMastery: data.new_mastery,
            newStreak: data.new_streak,
        };
    } catch (error) {
        console.error("Log Practice Error:", error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "Error de conexión" 
        };
    }
}
