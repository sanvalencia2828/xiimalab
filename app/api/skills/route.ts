import { apiResponse, getApiBase } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const API_URL = getApiBase();
        if (!API_URL) {
            console.warn("[/api/skills] API_URL not configured, returning fallback");
            return apiResponse(FALLBACK_SKILLS, 200);
        }

        const res = await fetch(`${API_URL}/skills/market`, {
            next: { revalidate: 3600 }, // skills change infrequently — 1h cache
        });

        if (!res.ok) {
            throw new Error(`Upstream API error: ${res.status}`);
        }

        const data = await res.json();
        return apiResponse(data, 200);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("[/api/skills] Failed to fetch from API:", errorMsg);

        // Return fallback data as success (graceful degradation)
        return apiResponse(FALLBACK_SKILLS, 200);
    }
}

const FALLBACK_SKILLS = [
    { id: 1, label: "Data Analytics", sublabel: "NODO-EAFIT", userScore: 82, marketDemand: 90, color: "#7dd3fc" },
    { id: 2, label: "Docker & DevOps", sublabel: "Containerización", userScore: 75, marketDemand: 85, color: "#38bdf8" },
    { id: 3, label: "Blockchain", sublabel: "Stellar · Avalanche", userScore: 68, marketDemand: 78, color: "#f59e0b" },
    { id: 4, label: "AI / ML", sublabel: "Python · Modelos", userScore: 70, marketDemand: 95, color: "#a78bfa" },
];
