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

export async function generateNetworkingStrategyAction(hackathonTitle: string, matchScore: number, techStack: string[]) {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/connector/networking-strategy`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                hackathon_title: hackathonTitle,
                match_score: matchScore,
                tech_stack: techStack
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to generate networking strategy: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Action Error (Connector):", error);
        return { error: "Failed to connect to Connector Agent" };
    }
}

// ── Agent Management Actions ──────────────────────────────────────────────────

export async function getAgentsStatusAction() {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/status`, {
            method: "GET",
            // Evitar caché para obtener el status real siempre
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error(`Failed to get agents status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Action Error (getAgentsStatus):", error);
        return { error: "Failed to connect to API, ensure backend is running" };
    }
}

export async function runAgentAction(endpointId: string) {
    try {
        // endpointId is something like "notifier/run" or "orchestrator/coordinate"
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/agents/${endpointId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to execute agent ${endpointId}: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Action Error (runAgentAction):", error);
        return { error: `Failed to trigger ${endpointId}` };
    }
}
