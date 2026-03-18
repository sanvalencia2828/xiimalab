"use server";

import { supabase } from "@/lib/supabase";

export async function applyToHackathonAction(hackathonId: string, studentAddress: string) {
    if (!hackathonId || !studentAddress) {
        return { success: false, error: "Faltan datos obligatorios" };
    }

    try {
        // 1. Fetch current progress array to append to it
        const { data: progress, error: fetchError } = await supabase
            .from("user_skills_progress")
            .select("hackathons_applied")
            .eq("student_address", studentAddress)
            .single();

        // Ignore exactly 0 rows error, which means the user has no row yet
        if (fetchError && fetchError.code !== "PGRST116") {
            console.error("Error fetching progress:", fetchError);
            return { success: false, error: "Error de conexión con la base de datos" };
        }

        // 2. Safely parse the current array (fallback to [] if row is new or column holds something else)
        let currentArray: string[] = [];
        if (progress && Array.isArray(progress.hackathons_applied)) {
            currentArray = progress.hackathons_applied;
        }

        // Prevent duplicate applications
        if (currentArray.includes(hackathonId)) {
            return { success: false, error: "Ya aplicaste a este hackathon" };
        }

        // 3. Append the new hackathon ID and evaluate completion logic
        const newArray = [...currentArray, hackathonId];
        const isCompleted = newArray.length >= 1;

        // 4. Update the DB via UPSERT
        const { error: upsertError } = await supabase
            .from("user_skills_progress")
            .upsert(
                {
                    student_address: studentAddress,
                    hackathons_applied: newArray,
                    is_completed: isCompleted,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "student_address" } // Assuming student_address is the Primary Key
            );

        if (upsertError) {
            console.error("Error updating progress:", upsertError);
            return { success: false, error: "No se pudo registrar el hito" };
        }

        return { success: true };
    } catch (err: any) {
        console.error("Action error:", err);
        return { success: false, error: err.message || "Error interno del servidor" };
    }
}
