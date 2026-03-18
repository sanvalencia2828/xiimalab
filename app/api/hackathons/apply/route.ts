import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { hackathon_id, title } = body;

        if (!hackathon_id) {
            return NextResponse.json({ error: "hackathon_id required" }, { status: 400 });
        }

        // Forward to FastAPI — fire and forget if unavailable
        try {
            await fetch(`${API_URL}/hackathons/${hackathon_id}/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hackathon_id, title }),
            });
        } catch (upstreamErr) {
            console.warn("[/api/hackathons/apply] FastAPI unavailable:", upstreamErr);
        }

        return NextResponse.json({ success: true, hackathon_id });
    } catch (err) {
        console.error("[/api/hackathons/apply]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
