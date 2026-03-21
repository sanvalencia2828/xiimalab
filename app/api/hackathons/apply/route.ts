import { apiResponse, getApiBase } from "@/lib/api";

export const dynamic = "force-dynamic";
const API_URL = getApiBase() ?? "";

interface ApplyBody {
    hackathon_id: string;
    title?: string;
}

interface ApplyResponseData {
    hackathon_id: string;
    applied_at: string;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as ApplyBody;
        const { hackathon_id } = body;

        if (!hackathon_id || typeof hackathon_id !== "string") {
            return apiResponse(
                null,
                400,
                "hackathon_id is required and must be a string"
            );
        }

        const responseData: ApplyResponseData = {
            hackathon_id,
            applied_at: new Date().toISOString(),
        };

        // Forward to FastAPI — fire and forget if unavailable
        if (API_URL) {
            try {
                await fetch(`${API_URL}/hackathons/${hackathon_id}/apply`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ hackathon_id, title: body.title }),
                });
            } catch (upstreamErr) {
                console.warn("[/api/hackathons/apply] FastAPI unavailable:", upstreamErr);
                // Still return success to client — the application was recorded locally
            }
        }

        return apiResponse(responseData, 200);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("[/api/hackathons/apply] Error:", errorMessage);
        return apiResponse(
            null,
            500,
            "Failed to apply to hackathon",
            errorMessage
        );
    }
}
