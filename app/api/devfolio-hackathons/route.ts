import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface DevfolioHackathon {
    id: string;
    title: string;
    prizePool: number;
    tags: string[];
    deadline: string;
    url: string;
}

const FALLBACK: DevfolioHackathon[] = [
    { id: "df1", title: "AI & ML Global Hackathon", prizePool: 50000, tags: ["Python", "AI", "ML", "FastAPI"], deadline: "2026-07-01", url: "https://devfolio.co" },
    { id: "df2", title: "Web3 Innovation Sprint", prizePool: 75000, tags: ["Blockchain", "Solidity", "Stellar", "Avalanche"], deadline: "2026-06-20", url: "https://devfolio.co" },
    { id: "df3", title: "Cloud Native DevOps Challenge", prizePool: 30000, tags: ["Docker", "Kubernetes", "CI/CD"], deadline: "2026-08-10", url: "https://devfolio.co" },
    { id: "df4", title: "Data Analytics Buildathon", prizePool: 25000, tags: ["Python", "Pandas", "SQL", "Tableau"], deadline: "2026-07-15", url: "https://devfolio.co" },
];

const DEVFOLIO_API_KEY = process.env.DEVFOLIO_MCP_API_KEY ?? "";
const MCP_URL = `https://mcp.devfolio.co/mcp?apiKey=${DEVFOLIO_API_KEY}`;

export async function GET() {
    if (!DEVFOLIO_API_KEY) {
        return NextResponse.json(FALLBACK);
    }

    try {
        const res = await fetch(MCP_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: { name: "list_hackathons", arguments: {} },
            }),
        });

        if (!res.ok) throw new Error(`Devfolio ${res.status}`);

        const text = await res.text();
        let items: any[] = [];

        // Handle SSE or JSON response
        if (text.startsWith("event:") || text.startsWith("data:")) {
            for (const line of text.split("\n")) {
                if (line.startsWith("data:")) {
                    const raw = line.slice(5).trim();
                    if (raw && raw !== "[DONE]") {
                        try {
                            const parsed = JSON.parse(raw);
                            const content = parsed?.result?.content ?? [];
                            for (const c of content) {
                                if (c.type === "text") {
                                    const inner = JSON.parse(c.text);
                                    items = Array.isArray(inner) ? inner : inner?.hackathons ?? [];
                                }
                            }
                        } catch {}
                    }
                }
            }
        } else {
            const json = JSON.parse(text);
            items = json?.result?.content ?? json?.content ?? [];
        }

        const hackathons: DevfolioHackathon[] = items.map((item: any, i: number) => ({
            id: item.id ?? item.slug ?? `devfolio-${i}`,
            title: item.title ?? item.name ?? "Hackathon",
            prizePool: Number(item.prize_pool ?? item.prizePool ?? 0),
            tags: Array.isArray(item.tags) ? item.tags : [],
            deadline: item.deadline ?? item.ends_at ?? "",
            url: item.url ?? item.devfolio_url ?? "https://devfolio.co",
        }));

        return NextResponse.json(hackathons.length ? hackathons : FALLBACK);
    } catch {
        return NextResponse.json(FALLBACK);
    }
}

