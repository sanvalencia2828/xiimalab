"use server";

import { supabase } from "@/lib/supabase";

export async function acceptRoadmapChallengeAction(
    studentAddress: string, 
    hackathonId: string, 
    stepIndex: number,
    stepTitle: string
) {
    if (!studentAddress || !hackathonId) {
        return { success: false, error: "Datos insuficientes" };
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
