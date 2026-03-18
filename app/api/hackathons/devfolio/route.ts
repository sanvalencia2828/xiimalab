/**
 * /api/hackathons/devfolio
 * ─────────────────────────────────────────────────────────
 * Llama directamente al MCP de Devfolio (JSON-RPC 2.0)
 * sin depender del FastAPI. Funciona tanto en local como en Vercel.
 *
 * Flujo:
 *   1. POST initialize  → captura Mcp-Session-Id
 *   2. POST tools/list  → descubre herramientas disponibles
 *   3. POST tools/call  → ejecuta la herramienta de hackatones
 *   4. Normaliza + devuelve array al frontend
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEVFOLIO_API_KEY = process.env.DEVFOLIO_MCP_API_KEY ?? "";
const MCP_URL = `https://mcp.devfolio.co/mcp?apiKey=${DEVFOLIO_API_KEY}`;

const MCP_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/event-stream",
};

// ── Helpers MCP ──────────────────────────────────────────

function parseSse(text: string): any {
  let result = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("data:")) {
      const raw = line.slice(5).trim();
      if (raw && raw !== "[DONE]") {
        try {
          const parsed = JSON.parse(raw);
          if ("result" in parsed) result = parsed.result;
        } catch {}
      }
    }
  }
  return result;
}

async function mcpRpc(
  method: string,
  params?: object,
  sessionId?: string
): Promise<{ result: any; sessionId: string | null }> {
  const headers: Record<string, string> = { ...MCP_HEADERS };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const body = JSON.stringify({
    jsonrpc: "2.0",
    method,
    id: Date.now(),
    ...(params ? { params } : {}),
  });

  const res = await fetch(MCP_URL, { method: "POST", headers, body });

  const newSession =
    res.headers.get("Mcp-Session-Id") ??
    res.headers.get("mcp-session-id") ??
    sessionId ??
    null;

  const text = await res.text();
  const ct = res.headers.get("content-type") ?? "";

  let result: any = null;
  if (ct.includes("text/event-stream") || text.startsWith("event:") || text.startsWith("data:")) {
    result = parseSse(text);
  } else {
    try {
      const json = JSON.parse(text);
      result = json.result ?? null;
    } catch {
      result = parseSse(text);
    }
  }

  return { result, sessionId: newSession };
}

// ── Normalización ────────────────────────────────────────

const SKILL_TAGS = new Set([
  "stellar","blockchain","web3","defi","ai","python","data",
  "nft","solidity","evm","avalanche","smart contracts","ipfs",
  "typescript","react","next.js","rust","move",
]);

function matchScore(tags: string[]): number {
  const hits = tags.filter((t) => SKILL_TAGS.has(t.toLowerCase())).length;
  return Math.min(50 + hits * 15, 100);
}

function normalizeHackathon(raw: any): any | null {
  const title = (raw.name ?? raw.title ?? raw.hackathon_name ?? "").trim();
  if (!title) return null;

  const slug = raw.slug ?? raw.id ?? title.toLowerCase().replace(/\s+/g, "-").slice(0, 32);
  const id   = `devfolio-${slug}`;

  const prizeRaw = raw.prize_amount ?? raw.total_prize ?? raw.prize ?? "0";
  let prizePool = 0;
  try { prizePool = parseInt(String(prizeRaw).replace(/[^0-9]/g, ""), 10) || 0; } catch {}

  const rawTags: unknown = raw.tags ?? raw.technologies ?? raw.themes ?? [];
  let tags: string[] = Array.isArray(rawTags)
    ? (rawTags as string[])
    : typeof rawTags === "string"
      ? (rawTags as string).split(",").map((t) => t.trim()).filter(Boolean)
      : [];

  const deadline =
    raw.ends_at ?? raw.deadline ?? raw.submission_deadline ?? raw.end_date ?? "";

  return {
    id,
    title,
    prize_pool:  prizePool,
    tags,
    deadline:    typeof deadline === "string" ? deadline.slice(0, 32) : "",
    match_score: matchScore(tags),
    source_url:  raw.url ?? raw.link ?? `https://devfolio.co/hackathons/${slug}`,
    source:      "devfolio",
  };
}

function extractList(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (!result) return [];

  // {"content": [{"type":"text","text":"[...]"}]}
  for (const item of result.content ?? []) {
    if (item.type === "text") {
      try {
        const p = JSON.parse(item.text);
        if (Array.isArray(p)) return p;
        for (const k of ["hackathons","data","results","items"]) {
          if (Array.isArray(p[k])) return p[k];
        }
      } catch {}
    }
  }

  for (const k of ["hackathons","data","results","items"]) {
    if (Array.isArray(result[k])) return result[k];
  }
  return [];
}

// ── Handler ──────────────────────────────────────────────

export async function GET() {
  if (!DEVFOLIO_API_KEY) {
    return NextResponse.json(
      { error: "DEVFOLIO_MCP_API_KEY no configurada" },
      { status: 503 }
    );
  }

  try {
    // 1. Initialize
    const init = await mcpRpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      clientInfo: { name: "xiimalab-web", version: "1.0.0" },
    });
    const sessionId = init.sessionId;

    // 2. Notificación initialized (requerida por spec)
    await fetch(MCP_URL, {
      method: "POST",
      headers: { ...MCP_HEADERS, ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }).catch(() => {});

    // 3. Listar herramientas
    const toolsRes = await mcpRpc("tools/list", undefined, sessionId ?? undefined);
    const tools: string[] = (toolsRes.result?.tools ?? []).map((t: any) => t.name as string);

    // 4. Elegir herramienta de hackatones
    const hackTool =
      tools.find((n) => n.toLowerCase().includes("hackathon")) ??
      "get_hackathons";

    // 5. Llamar herramienta
    const callRes = await mcpRpc(
      "tools/call",
      { name: hackTool, arguments: { status: "open" } },
      sessionId ?? undefined
    );

    const rawList = extractList(callRes.result);
    const hackathons = rawList
      .map(normalizeHackathon)
      .filter(Boolean);

    return NextResponse.json(hackathons, {
      headers: {
        "X-Data-Source": "devfolio-mcp",
        "X-Tool-Used":   hackTool,
        "X-Count":       String(hackathons.length),
      },
    });
  } catch (err) {
    console.error("[/api/hackathons/devfolio]", err);
    return NextResponse.json(
      { error: "Error conectando con Devfolio MCP", detail: String(err) },
      { status: 502 }
    );
  }
}
