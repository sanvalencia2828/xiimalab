"use server";

export async function generateAuraEngagementKitAction(
    projectTitle: string, 
    hackathonTitle: string, 
    projectIdea: string,
    techStack: string[]
) {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/agents/aura/engagement-kit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                project_title: projectTitle,
                hackathon_title: hackathonTitle,
                project_idea: projectIdea,
                tech_stack: techStack
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("AURA API Error:", response.status, errorBody);
            throw new Error(`Error ${response.status}: El servicio de IA no respondió correctamente`);
        }

        return await response.json();
    } catch (error) {
        console.error("Aura Action Error:", error);
        const message = error instanceof Error ? error.message : "Error de conexión";
        return { 
            error: "No pudimos generar tu kit de engagement", 
            details: message,
            retryable: true
        };
    }
}

export async function submitToAuraEngagementPoolAction(studentAddress: string, content: string, platform: string) {
    // This will be expanded when we have the actual AURA pool API
    console.log(`Submitting to AURA pool for ${studentAddress}: ${platform}`);
    return { success: true, message: "Contenido enviado al pool de engagement" };
}

export async function processImageAction(formData: FormData, studentAddress: string) {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/aura/process-image`, {
            method: "POST",
            body: formData,
            headers: {
                "X-Student-Address": studentAddress,
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("AURA Process Image Error:", response.status, errorBody);
            throw new Error(`Error ${response.status}: El procesamiento de imagen falló`);
        }

        return { success: true, data: await response.json() };
    } catch (error) {
        console.error("Process Image Action Error:", error);
        const message = error instanceof Error ? error.message : "Error de conexión";
        return { success: false, error: message };
    }
}
