import { NextResponse } from "next/server";

const DEVFOLIO_MCP_KEY = process.env.DEVFOLIO_MCP_API_KEY ?? "";
const MCP_BASE = "https://mcp.devfolio.co/mcp";

async function initSession(): Promise<string | null> {
    const res = await fetch(`${MCP_BASE}?apiKey=${DEVFOLIO_MCP_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "initialize",
            params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "xiimalab", version: "1.0" } }
        }),
        signal: AbortSignal.timeout(8000),
    });
    return res.headers.get("mcp-session-id");
}

async function mcpCall(sessionId: string, toolName: string) {
    const res = await fetch(`${MCP_BASE}?apiKey=${DEVFOLIO_MCP_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
            jsonrpc: "2.0", id: Date.now(), method: "tools/call",
            params: { name: toolName, arguments: {} }
        }),
        signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    for (const line of text.split("\n")) {
        if (line.startsWith("data:")) {
            try {
                const d = JSON.parse(line.slice(5));
                const content = d?.result?.content?.[0]?.text;
                return content ? JSON.parse(content) : null;
            } catch { /* skip */ }
        }
    }
    return null;
}

export const dynamic = "force-dynamic";

export async function GET() {
    if (!DEVFOLIO_MCP_KEY) {
        return NextResponse.json({ error: "DEVFOLIO_MCP_API_KEY not configured" }, { status: 503 });
    }
    try {
        const sessionId = await initSession();
        if (!sessionId) throw new Error("No session ID from MCP");

        const [profile, hackathonsData] = await Promise.all([
            mcpCall(sessionId, "getUserBasicInfo"),
            mcpCall(sessionId, "fetchUserActiveHackathons"),
        ]);

        return NextResponse.json({
            profile,
            hackathons: hackathonsData?.hackathons ?? [],
        });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
