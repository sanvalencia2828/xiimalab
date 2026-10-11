/**
 * app/bounties/page.tsx — SERVER COMPONENT
 * Bounties abiertos de Superteam Earn. Los datos se obtienen en el servidor
 * (lib/bounties/superteam.ts) y los filtros se aplican en <BountiesClient>.
 * Si la fuente falla, la página muestra su estado vacío.
 */
import type { Metadata } from "next";
import { Coins, Zap } from "lucide-react";
import { BountiesClient } from "@/components/BountiesClient";
import { type BountiesResult, getSuperteamBounties } from "@/lib/bounties/superteam";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Bounties abiertos | Xiimalab",
    description:
        "Bounties abiertos de Superteam Earn con recompensa, fecha de cierre, número de envíos y match con tu perfil. Filtra por desarrollo y por token.",
    alternates: { canonical: "/bounties" },
    openGraph: {
        title: "Bounties abiertos | Xiimalab",
        description: "Bounties abiertos de Superteam Earn, con recompensa, cierre y match con tu perfil.",
        type: "website",
        url: "/bounties",
    },
};

async function fetchBounties(): Promise<Pick<BountiesResult, "bounties" | "devKnown">> {
    try {
        const { bounties, devKnown } = await getSuperteamBounties();
        return { bounties, devKnown };
    } catch (err) {
        console.warn("[bounties/page] Superteam error:", err);
        return { bounties: [], devKnown: false };
    }
}

export default async function BountiesPage() {
    const { bounties, devKnown } = await fetchBounties();

    return (
        <div className="p-6 min-h-screen">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-xs font-medium text-accent uppercase tracking-widest">Intelligence Feed</span>
                </div>
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">
                            Boun<span className="gradient-text">ties</span>
                        </h1>
                        <p className="text-slate-400 text-sm">Superteam Earn · trabajo pagado por entrega</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="badge-accent flex items-center gap-1.5">
                            <Coins className="w-3 h-3" />
                            {bounties.length > 0
                                ? `${bounties.length} ${bounties.length === 1 ? "abierto" : "abiertos"}`
                                : "Sin bounties abiertos"}
                        </span>
                        <span className="badge-emerald flex items-center gap-1.5">
                            <Zap className="w-3 h-3" />
                            Live Feed
                        </span>
                    </div>
                </div>
            </div>

            <BountiesClient bounties={bounties} devKnown={devKnown} />
        </div>
    );
}
