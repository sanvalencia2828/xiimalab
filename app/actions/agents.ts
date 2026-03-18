"use server";

export async function generateProjectAssetsAction(hackathonTitle: string, roadmap: any, projectIdea: string) {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/coach/assets`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                hackathon_title: hackathonTitle,
                roadmap: roadmap,
                project_idea: projectIdea
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to generate assets");
        }

        return await response.json();
    } catch (error) {
        console.error("Action Error:", error);
        return { error: "Failed to connect to AI Coach" };
    }
}
