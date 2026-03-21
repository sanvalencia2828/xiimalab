"use server";

import { getApiBase, safeFetch } from "@/lib/api";

export async function generateProjectAssetsAction(hackathonTitle: string, roadmap: unknown, projectIdea: string): Promise<{ error?: string; [key: string]: unknown }> {
    const base = getApiBase();
    if (!base) return { error: "Backend no disponible en este entorno" };

    const data = await safeFetch<{ [key: string]: unknown }>(`${base}/api/agents/coach/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hackathon_title: hackathonTitle, roadmap, project_idea: projectIdea }),
    });
    return data ?? { error: "No se pudo conectar al AI Coach" };
}

export async function generateNetworkingStrategyAction(hackathonTitle: string, matchScore: number, techStack: string[]): Promise<{ error?: string; [key: string]: unknown }> {
    const base = getApiBase();
    if (!base) return { error: "Backend no disponible en este entorno" };

    const data = await safeFetch<{ [key: string]: unknown }>(`${base}/api/agents/connector/networking-strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hackathon_title: hackathonTitle, match_score: matchScore, tech_stack: techStack }),
    });
    return data ?? { error: "No se pudo conectar al Connector Agent" };
}

interface AgentStatusItem { name: string; status: string; last_seen: string; }

export async function getAgentsStatusAction(): Promise<{ agents: AgentStatusItem[]; status: string; message?: string; error?: string }> {
    const base = getApiBase();
    if (!base) {
        return {
            agents: [],
            status: "offline",
            error: "Backend Docker no disponible — ejecuta docker compose up en tu máquina local",
        };
    }

    const data = await safeFetch<{ agents: AgentStatusItem[]; status: string }>(`${base}/api/agents/status`, { cache: "no-store" });
    return data ?? { agents: [], status: "offline", error: "Backend no responde" };
}

export async function runAgentAction(endpointId: string): Promise<{ error?: string; [key: string]: unknown }> {
    const base = getApiBase();
    if (!base) return { error: "Backend no disponible — requiere Docker local" };

    const data = await safeFetch<{ [key: string]: unknown }>(`${base}/api/agents/${endpointId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    return data ?? { error: `No se pudo ejecutar ${endpointId}` };
}
