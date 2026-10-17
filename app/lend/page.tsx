/**
 * app/lend/page.tsx — SERVER COMPONENT
 * Mercados de préstamo de Backpack Lend y, para cada cripto, las oportunidades
 * de construir en su ecosistema: hackatones y bounties abiertos que lo nombran
 * y sus programas oficiales. Filtros y orden en <LendClient>.
 */
import type { Metadata } from "next";
import { Landmark, Zap } from "lucide-react";
import { LendClient, type LendRow } from "@/components/LendClient";
import { getSuperteamBounties } from "@/lib/bounties/superteam";
import { describeClosing } from "@/lib/hackathons/format";
import { getLiveHackathons } from "@/lib/hackathons/live";
import {
    ecosystemFor,
    fromBounty,
    fromHackathon,
    matchOpportunities,
    summarizeOpportunities,
    type Opportunity,
} from "@/lib/markets/ecosystems";
import { getLendMarkets } from "@/lib/markets/lend";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Lend · Xiimalab",
    description: "Tasas de Backpack Lend y oportunidades de construir en el ecosistema de cada cripto",
};

/** Hackatones y bounties abiertos; null si ninguna fuente respondió. */
async function fetchOpportunities(): Promise<Opportunity[] | null> {
    const [hacks, bounties] = await Promise.allSettled([getLiveHackathons(), getSuperteamBounties()]);
    if (hacks.status === "rejected" && bounties.status === "rejected") return null;
    const items = [
        ...(hacks.status === "fulfilled" ? hacks.value.hackathons.map(fromHackathon) : []),
        ...(bounties.status === "fulfilled" ? bounties.value.bounties.map(fromBounty) : []),
    ];
    return items.filter((o) => !describeClosing(o.deadline).closed);
}

export default async function LendPage() {
    const [lend, opportunities] = await Promise.all([getLendMarkets(), fetchOpportunities().catch(() => null)]);

    const rows: LendRow[] = lend.markets.map((m) => {
        const eco = ecosystemFor(m.symbol);
        const summary = summarizeOpportunities(matchOpportunities(opportunities ?? [], eco));
        return {
            ...m,
            ecosystem: { name: eco.name, programs: eco.programs, note: eco.note ?? null },
            hackathons: summary.hackathons,
            bounties: summary.bounties,
            top: summary.top.map((o) => ({ ...o, closing: describeClosing(o.deadline).label })),
        };
    });

    const withOpportunities = rows.filter((r) => r.hackathons + r.bounties > 0).length;

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
                            Le<span className="gradient-text">nd</span>
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Tasas de préstamo de Backpack Lend · oportunidades de construir en el ecosistema de cada cripto
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="badge-accent flex items-center gap-1.5">
                            <Landmark className="w-3 h-3" />
                            {rows.length} activos · {withOpportunities} con oportunidades
                        </span>
                        <span className="badge-emerald flex items-center gap-1.5">
                            <Zap className="w-3 h-3" />
                            Live Feed
                        </span>
                    </div>
                </div>
            </div>

            <LendClient
                rows={rows}
                lendOk={lend.ok}
                opportunitiesOk={opportunities !== null}
                fetchedAt={lend.ok ? lend.fetched_at : null}
            />
        </div>
    );
}
