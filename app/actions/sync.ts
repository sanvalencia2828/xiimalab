"use server";
import { getApiBase, safeFetch } from "@/lib/api";
// getApiBase() called inside each function to avoid module-level null

import { revalidatePath } from "next/cache";

export async function syncHackathons() {
    const apiUrl = getApiBase(); if (!apiUrl) return null as any;
    
    try {
        const response = await fetch(`${apiUrl}/hackathons/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Sync failed with status: ${response.status}`);
        }

        const data = await response.json();
        
        // Revalidate the hackatones page to show new data
        revalidatePath("/hackatones");
        
        return data;
    } catch (error) {
        console.error("Error triggering manual sync:", error);
        return { status: "error", message: error instanceof Error ? error.message : "Unknown error" };
    }
}
