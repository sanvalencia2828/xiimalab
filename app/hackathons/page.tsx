/**
 * app/hackathons/page.tsx — SERVER COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 * Página única de hackatones (antes repartida entre /hackathons y /aggregated).
 *   • Obtiene las hackatones abiertas en vivo (lib/hackathons/live.ts) en cada petición.
 *   • Pasa la lista completa a <AggregatedHackathonsClient>, que filtra, ordena y pagina.
 *   • Si las fuentes en vivo fallan → fallback a Supabase.
 * El número del badge es el total de la lista, el mismo que usa el menú lateral.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Metadata } from "next";
import { Database } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getLiveHackathons } from "@/lib/hackathons/live";
import { AggregatedHackathonsClient } from "@/components/AggregatedHackathonsClient";
import WalletOnboardingModal from "@/components/WalletOnboardingModal";
import type { AggregatedHackathon } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Hackatones abiertas | Xiimalab",
    description: "Convocatorias abiertas de Devpost, DoraHacks y Devfolio, con premio, fecha de cierre y match con tu perfil.",
};

async function fetchHackathons(): Promise<AggregatedHackathon[]> {
    // 1. Fuentes en vivo (DoraHacks + Devpost + Devfolio)
    try {
        const live = await getLiveHackathons();
        if (live.hackathons.length > 0) return live.hackathons;
    } catch (err) {
        console.warn("[hackatones/page] live sources error:", err);
    }

    // 2. Supabase (datos del scraper)
    if (supabase) {
        const { data, error } = await supabase
            .from("hackathons")
            .select("id, title, prize_pool, tags, deadline, match_score, source_url, source, scraped_at")
            .order("match_score", { ascending: false })
            .limit(200);
        if (!error && data && data.length > 0) return data as unknown as AggregatedHackathon[];
        if (error) console.error("[hackatones/page] Supabase error:", error.message);
    }

    // 3. Sin datos — el cliente muestra su estado vacío
    return [];
}

export default async function HackatonesPage() {
    const hackathons = await fetchHackathons();

    return (
        <div className="p-6 pt-20 md:pt-6 min-h-screen">
            {/* El contador va junto al título: la esquina superior derecha la ocupa la campana de notificaciones */}
            <div className="mb-8">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h1 className="text-3xl font-bold text-white">Hackatones</h1>
                    <span className="badge-accent flex items-center gap-1.5">
                        <Database className="w-3 h-3" />
                        {hackathons.length > 0 ? `${hackathons.length} abiertas` : "Sin convocatorias abiertas"}
                    </span>
                </div>
                <p className="text-slate-400 text-sm">Convocatorias abiertas de Devpost, DoraHacks y Devfolio</p>
            </div>

            {/* Modal Wallet-First — solo aparece si no hay wallet configurada */}
            <WalletOnboardingModal />

            <AggregatedHackathonsClient hackathons={hackathons} />
        </div>
    );
}
