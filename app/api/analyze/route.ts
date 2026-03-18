import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * POST /api/analyze
 * Proxies to FastAPI POST /analyze/hackathon and returns the AI analysis.
 * Body: { id, title, tags, prize_pool, description }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();

        const res = await fetch(`${API_URL}/analyze/hackathon`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();

        // Normalize field names: FastAPI returns snake_case, frontend expects camelCase
        return NextResponse.json({
            hackathon_id: data.hackathon_id,
            match_score: data.match_score ?? 0,
            missing_skills: data.missing_skills ?? [],
            project_highlight: data.project_highlight ?? "",
        });
    } catch (err) {
        console.error("[/api/analyze] Error:", err);
        // Graceful fallback so the modal doesn't break
        return NextResponse.json(
            {
                match_score: 0,
                missing_skills: [],
                project_highlight: "No se pudo conectar con el motor de IA. Verifica que la API esté corriendo.",
            },
            { status: 200 } // return 200 so the frontend doesn't crash
        );
    }
}
