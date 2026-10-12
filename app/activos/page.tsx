/**
 * app/activos/page.tsx — SERVER COMPONENT
 * Acciones ligadas a los temas de Xiimalab con su estado en Backpack
 * (precio, variación, próximos resultados, si se pueden operar) y su
 * importancia según la demanda de las hackatones y bounties abiertos.
 * Las reglas de adquisición las define el usuario en <AssetsClient>.
 */
import type { Metadata } from "next";
import { LineChart, Zap } from "lucide-react";
import { AssetsClient, type AssetRow } from "@/components/AssetsClient";
import { getMarketAssets } from "@/lib/markets/backpack";
import { stockRelevance, themeDemand, WATCHLIST, type OpportunityText, type ThemeDemand } from "@/lib/markets/watchlist";
import { getLiveHackathons } from "@/lib/hackathons/live";
import { getSuperteamBounties } from "@/lib/bounties/superteam";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Activos | Xiimalab",
    description:
        "Acciones ligadas a IA, blockchain y herramientas de desarrollo, con su estado en Backpack, próximos resultados e importancia según las hackatones y bounties abiertos.",
    alternates: { canonical: "/activos" },
};

async function fetchOpportunities(): Promise<OpportunityText[]> {
    const [hacks, bounties] = await Promise.allSettled([getLiveHackathons(), getSuperteamBounties()]);
    const items: OpportunityText[] = [];
    if (hacks.status === "fulfilled") {
        for (const h of hacks.value.hackathons) items.push({ title: h.title, tags: h.tags });
    }
    if (bounties.status === "fulfilled") {
        // Superteam Earn es el ecosistema de Solana: todos sus bounties cuentan como blockchain
        for (const b of bounties.value.bounties) items.push({ title: b.title, blockchainNative: true });
    }
    return items;
}

export default async function ActivosPage() {
    const [market, opportunities] = await Promise.all([
        getMarketAssets().catch(() => null),
        fetchOpportunities().catch(() => [] as OpportunityText[]),
    ]);
    const demand: ThemeDemand[] = themeDemand(opportunities);

    const rows: AssetRow[] = (market?.assets ?? []).map((a) => {
        const stock = WATCHLIST.find((w) => w.ticker === a.ticker)!;
        return { ...a, relevance: stockRelevance(stock, demand) };
    });

    const tradeable = rows.filter((r) => r.backpack.spot || r.backpack.perp).length;

    return (
        <div className="p-6 min-h-screen">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-xs font-medium text-accent uppercase tracking-widest">Market Intelligence</span>
                </div>
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">
                            Acti<span className="gradient-text">vos</span>
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Acciones de IA, blockchain y herramientas de desarrollo · datos de Backpack Exchange
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="badge-accent flex items-center gap-1.5">
                            <LineChart className="w-3 h-3" />
                            {rows.length} activos · {tradeable} en Backpack
                        </span>
                        <span className="badge-emerald flex items-center gap-1.5">
                            <Zap className="w-3 h-3" />
                            Live Feed
                        </span>
                    </div>
                </div>
            </div>

            <AssetsClient
                rows={rows}
                demand={demand}
                ok={Boolean(market?.ok)}
                fetchedAt={market?.fetched_at ?? null}
            />
        </div>
    );
}
