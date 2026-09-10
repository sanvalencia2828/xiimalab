"use server";

import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/api";

export async function acceptRoadmapChallengeAction(
    studentAddress: string, 
    hackathonId: string, 
    stepIndex: number,
    stepTitle: string
) {
    if (!studentAddress || !hackathonId) {
        return { success: false, error: "Datos insuficientes" };
    }

    if (!supabase) {
        return { success: false, error: "Servicio de base de datos no disponible" };
    }

    try {
        // Record the achievement in the user_achievements table
        const { error } = await supabase
            .from("user_achievements")
            .insert({
                student_address: studentAddress,
                title: `Reto Aceptado: ${stepTitle}`,
                category: "roadmap_step",
                issuer: "AI Coach - Xiimalab",
                skills: [hackathonId, `step-${stepIndex}`],
                issued_date: new Date().toISOString(),
                is_active: true
            });

        if (error) {
            console.error("Error recording achievement:", error);
            return { success: false, error: "No se pudo registrar el progreso" };
        }

        return { success: true };
    } catch (err: any) {
        console.error("Roadmap Action error:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Persist a generated learning roadmap with its steps.
 * POST /api/v1/learning/roadmaps
 */
export async function saveRoadmapAction(
    walletAddress: string,
    hackathonId: string,
    skill: string,
    targetLevel: number,
    steps: Array<{
        step_index: number;
        title: string;
        duration: string;
        step_type: string;
        description: string;
    }>
) {
    if (!walletAddress || !hackathonId || !skill) {
        return { success: false, error: "Datos insuficientes" };
    }

    try {
        const API_URL = getApiBase();
        if (!API_URL) {
            return { success: false, error: "API URL not configured" };
        }

        const res = await fetch(`${API_URL}/api/v1/learning/roadmaps`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                wallet_address: walletAddress,
                hackathon_id: hackathonId,
                skill,
                target_level: targetLevel,
                steps,
            }),
            cache: "no-store",
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.detail || `API error: ${res.status}` };
        }

        return await res.json();
    } catch (err: any) {
        console.error("Save Roadmap error:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Mark a roadmap step as completed or not.
 * PATCH /api/v1/learning/steps/{step_id}
 */
export async function updateRoadmapStepAction(stepId: string, isCompleted: boolean) {
    if (!stepId) {
        return { success: false, error: "Step ID required" };
    }

    try {
        const API_URL = getApiBase();
        if (!API_URL) {
            return { success: false, error: "API URL not configured" };
        }

        const res = await fetch(`${API_URL}/api/v1/learning/steps/${stepId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_completed: isCompleted }),
            cache: "no-store",
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.detail || `API error: ${res.status}` };
        }

        return await res.json();
    } catch (err: any) {
        console.error("Update Roadmap Step error:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch all roadmaps for a user with their step progress.
 * GET /api/v1/learning/roadmaps/{wallet}
 */
export async function getUserRoadmapsAction(walletAddress: string) {
    if (!walletAddress) {
        return { success: false, error: "Wallet address required", roadmaps: [] };
    }

    try {
        const API_URL = getApiBase();
        if (!API_URL) {
            return { success: false, error: "API URL not configured", roadmaps: [] };
        }

        const res = await fetch(`${API_URL}/api/v1/learning/roadmaps/${encodeURIComponent(walletAddress)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
        });

        if (!res.ok) {
            return { success: false, error: `API error: ${res.status}`, roadmaps: [] };
        }

        const data = await res.json();
        return { success: true, roadmaps: data, error: null };
    } catch (err: any) {
        console.error("Get User Roadmaps error:", err);
        return { success: false, error: err.message, roadmaps: [] };
    }
}
