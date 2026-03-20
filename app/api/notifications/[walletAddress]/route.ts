import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/api";
export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ walletAddress: string }> }) {
    const { walletAddress } = await params;
    const base = getApiBase();
    if (!base) return NextResponse.json([], { status: 200 });
    try {
        const res = await fetch(`${base}/notifications/${walletAddress}`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return NextResponse.json([]);
        return NextResponse.json(await res.json());
    } catch { return NextResponse.json([]); }
}
