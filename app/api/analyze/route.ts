import { apiResponse, getApiBase } from "@/lib/api";

export const dynamic = "force-dynamic";

interface AnalyzeBody {
    id?: string;
    title?: string;
    tags?: string[];
    prize_pool?: number;
    description?: string;
}

interface AnalyzeResponse {
    hackathon_id?: string;
    match_score: number;
    missing_skills: string[];
    project_highlight: string;
}

/**
 * POST /api/analyze
 * Proxies to FastAPI POST /analyze/hackathon and returns the AI analysis.
 * Body: { id, title, tags, prize_pool, description }
 */
export async function POST(request: Request) {
    try {
        const body = (await request.json()) as AnalyzeBody;
        const API_URL = getApiBase();

        if (!API_URL) {
            console.warn("[/api/analyze] API not available, returning fallback");
            return apiResponse(FALLBACK_ANALYSIS, 200);
        }

        const res = await fetch(`${API_URL}/analyze/hackathon`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
        }

        const data = (await res.json()) as AnalyzeResponse;

        // Normalize field names: FastAPI returns snake_case
        return apiResponse(
            {
                hackathon_id: data.hackathon_id,
                match_score: data.match_score ?? 0,
                missing_skills: data.missing_skills ?? [],
                project_highlight: data.project_highlight ?? "",
            },
            200
        );
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("[/api/analyze] Error:", errorMsg);

        // Return fallback as success (graceful degradation)
        return apiResponse(FALLBACK_ANALYSIS, 200);
    }
}

const FALLBACK_ANALYSIS: AnalyzeResponse = {
    match_score: 0,
    missing_skills: [],
    project_highlight: "No se pudo conectar con el motor de IA. Verifica que la API esté corriendo.",
};
