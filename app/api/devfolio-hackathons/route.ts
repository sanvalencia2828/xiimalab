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

export async function GET() {
    try {
        const res = await fetch(
            "https://mcp.devfolio.co/mcp?apiKey=f8fdb3b311ae080e2678c4a566f139eb123b27be06fedc0098d4cc946690665e",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools/call",
                    params: { name: "list_hackathons", arguments: {} },
                }),
            }
        );

        if (!res.ok) throw new Error(`Devfolio ${res.status}`);

        const json = await res.json();
        const items: any[] = json?.result?.content ?? json?.content ?? [];

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
