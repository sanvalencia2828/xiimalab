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
    { id: 1, label: "Data Analytics", sublabel: "NODO-EAFIT", user_score: 82, market_demand: 90, color: "#7dd3fc" },
    { id: 2, label: "Docker & DevOps", sublabel: "Containerización", user_score: 75, market_demand: 85, color: "#38bdf8" },
    { id: 3, label: "Blockchain", sublabel: "Stellar · Avalanche", user_score: 68, market_demand: 78, color: "#f59e0b" },
    { id: 4, label: "AI / ML", sublabel: "Python · Modelos", user_score: 70, market_demand: 95, color: "#a78bfa" },
];
