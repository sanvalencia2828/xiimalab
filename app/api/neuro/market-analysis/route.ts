import { NextResponse } from "next/server";
import { getApiBase } from "@/lib/api";
export const dynamic = "force-dynamic";

export async function GET() {
    const base = getApiBase();
    if (!base) return NextResponse.json({ skills: [], message: "Backend no disponible" }, { status: 503 });
    try {
        const res = await fetch(`${base}/neuro/market-analysis`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return NextResponse.json({ skills: [] });
        return NextResponse.json(await res.json());
    } catch { return NextResponse.json({ skills: [] }); }
}
