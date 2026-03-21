import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/api";
export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ address: string }> }) {
    const { address } = await params;
    const base = getApiBase();
    if (!base) return NextResponse.json(null, { status: 503 });
    try {
        const res = await fetch(`${base}/neuro/profile/${address}`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return NextResponse.json(null, { status: 404 });
        return NextResponse.json(await res.json());
    } catch { return NextResponse.json(null, { status: 503 }); }
}
