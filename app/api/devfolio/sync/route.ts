import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DEVFOLIO_MCP_KEY = process.env.DEVFOLIO_MCP_API_KEY ?? "";
const MCP_BASE = "https://mcp.devfolio.co/mcp";

// ── MCP Session ─────────────────────────────────────────────────────────────
async function initSession(): Promise<string | null> {
    const res = await fetch(`${MCP_BASE}?apiKey=${DEVFOLIO_MCP_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "xiimalab", version: "1.0" },
            },
        }),
        signal: AbortSignal.timeout(10000),
    });
    return res.headers.get("mcp-session-id");
}

async function mcpCall(sessionId: string, toolName: string): Promise<unknown> {
    const res = await fetch(`${MCP_BASE}?apiKey=${DEVFOLIO_MCP_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: { name: toolName, arguments: {} },
        }),
        signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();

    // Handle SSE response
    for (const line of text.split("\n")) {
        if (line.startsWith("data:")) {
            try {
                const d = JSON.parse(line.slice(5));
                const content = d?.result?.content?.[0]?.text;
                return content ? JSON.parse(content) : null;
            } catch { /* skip malformed lines */ }
        }
    }

    // Handle plain JSON response
    try {
        const json = JSON.parse(text);
        const content = json?.result?.content?.[0]?.text;
        return content ? JSON.parse(content) : json?.result ?? null;
    } catch {
        return null;
    }
}

// ── Data Parsing ────────────────────────────────────────────────────────────
function generateId(title: string): string {
    // Simple hash matching Python's MD5[:12] pattern
    let hash = 0;
    const lower = title.toLowerCase().trim();
    for (let i = 0; i < lower.length; i++) {
        const chr = lower.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(12, "0").slice(0, 12);
}

function parsePrize(prize: string | number | undefined): number {
    if (!prize) return 0;
    if (typeof prize === "number") return prize;

    const cleaned = prize.replace(/[$,]/g, "").trim();
    if (cleaned.endsWith("K")) return Math.round(parseFloat(cleaned) * 1000);
    if (cleaned.endsWith("M")) return Math.round(parseFloat(cleaned) * 1000000);
    return Math.round(parseFloat(cleaned)) || 0;
}

function parseDeadline(deadline: string | undefined): string {
    if (!deadline) return "2099-12-31";
    try {
        const d = new Date(deadline);
        if (isNaN(d.getTime())) return "2099-12-31";
        return d.toISOString().slice(0, 10);
    } catch {
        return "2099-12-31";
    }
}

interface ParsedHackathon {
    id: string;
    title: string;
    prize_pool: number;
    tags: string[];
    deadline: string;
    match_score: number;
    source_url: string;
    source: string;
}

function parseHackathons(raw: Record<string, unknown>[]): ParsedHackathon[] {
    const results: ParsedHackathon[] = [];

    for (const item of raw) {
        const title = String(item.title ?? item.name ?? "").trim();
        if (!title) continue;

        results.push({
            id: generateId(title),
            title,
            prize_pool: parsePrize(item.prize as string | number | undefined ?? item.prize_pool as string | number | undefined),
            tags: Array.isArray(item.tags) ? item.tags : [],
            deadline: parseDeadline(String(item.deadline ?? item.ends_at ?? "")),
            match_score: 0,
            source_url: String(item.url ?? item.devfolio_url ?? "https://devfolio.co"),
            source: "devfolio",
        });
    }

    return results;
}

// ── POST /api/devfolio/sync ─────────────────────────────────────────────────
export async function POST() {
    if (!DEVFOLIO_MCP_KEY) {
        return NextResponse.json(
            { error: "DEVFOLIO_MCP_API_KEY not configured" },
            { status: 503 },
        );
    }

    if (!supabase) {
        return NextResponse.json(
            { error: "Supabase not configured" },
            { status: 503 },
        );
    }

    try {
        // 1. Init MCP session
        const sessionId = await initSession();
        if (!sessionId) throw new Error("No session ID from Devfolio MCP");

        // 2. Fetch hackathons via MCP tool
        const data = await mcpCall(sessionId, "fetchUserActiveHackathons") as Record<string, unknown> | null;

        let rawItems: Record<string, unknown>[] = [];
        if (data && typeof data === "object") {
            if (Array.isArray(data)) {
                rawItems = data;
            } else if (Array.isArray((data as Record<string, unknown>).hackathons)) {
                rawItems = (data as Record<string, unknown>).hackathons as Record<string, unknown>[];
            }
        }

        if (rawItems.length === 0) {
            return NextResponse.json({
                synced: 0,
                message: "No hackathons returned from Devfolio MCP",
            });
        }

        // 3. Parse raw data
        const parsed = parseHackathons(rawItems);

        // 4. Upsert to Supabase
        const { data: upserted, error } = await supabase
            .from("hackathons")
            .upsert(
                parsed.map((h) => ({
                    ...h,
                    tags: h.tags,
                    updated_at: new Date().toISOString(),
                })),
                { onConflict: "id" },
            )
            .select("id");

        if (error) {
            console.error("[devfolio/sync] Supabase upsert error:", error);
            return NextResponse.json(
                { error: "Failed to save to database", details: error.message },
                { status: 500 },
            );
        }

        return NextResponse.json({
            synced: upserted?.length ?? parsed.length,
            hackathons: parsed.map((h) => ({ id: h.id, title: h.title, prize_pool: h.prize_pool })),
            message: `Synced ${parsed.length} Devfolio hackathons to Supabase`,
        });
    } catch (err) {
        console.error("[devfolio/sync] Error:", err);
        return NextResponse.json(
            { error: String(err) },
            { status: 500 },
        );
    }
}

// GET returns sync status
export async function GET() {
    if (!supabase) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { count, error } = await supabase
        .from("hackathons")
        .select("*", { count: "exact", head: true })
        .eq("source", "devfolio");

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        devfolio_count: count ?? 0,
        message: "POST to this endpoint to sync Devfolio hackathons",
    });
}
