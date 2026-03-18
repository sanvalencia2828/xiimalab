import { NextResponse } from "next/server";

<<<<<<< HEAD
=======
// Forzar renderizado dinámico — nunca pre-renderizar en build (no hay FastAPI en Vercel)
>>>>>>> 818308f5dd3f39122c8e46bc57ee372d2f05d9ba
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET() {
    try {
        const res = await fetch(`${API_URL}/skills/market`, {
            next: { revalidate: 3600 }, // skills change infrequently — 1h cache
        });

        if (!res.ok) {
            throw new Error(`Upstream API error: ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error("[/api/skills] Failed to fetch from API:", err);

        return NextResponse.json(FALLBACK_SKILLS, {
            headers: { "X-Data-Source": "fallback" },
        });
    }
}

const FALLBACK_SKILLS = [
    { id: 1, label: "Data Analytics", sublabel: "NODO-EAFIT", userScore: 82, marketDemand: 90, color: "#7dd3fc" },
    { id: 2, label: "Docker & DevOps", sublabel: "Containerización", userScore: 75, marketDemand: 85, color: "#38bdf8" },
    { id: 3, label: "Blockchain", sublabel: "Stellar · Avalanche", userScore: 68, marketDemand: 78, color: "#f59e0b" },
    { id: 4, label: "AI / ML", sublabel: "Python · Modelos", userScore: 70, marketDemand: 95, color: "#a78bfa" },
];
