/**
 * app/hackathons/page.tsx — SERVER COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 * Arquitectura de hidratación:
 *   • Este archivo NO tiene "use client" — se ejecuta en el servidor.
 *   • Obtiene hackatones en vivo (lib/hackathons/live.ts) en request time.
 *   • Pasa initialData a <AggregatedHackathonsClient> que maneja filtros + SSE.
 *   • Si las fuentes en vivo fallan → fallback a Supabase.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Suspense }      from "react";
import { Zap, Database } from "lucide-react";
import { supabase, type ActiveHackathon } from "@/lib/supabase";
import { getLiveHackathons } from "@/lib/hackathons/live";
import { AggregatedHackathonsClient } from "@/components/AggregatedHackathonsClient";
import WalletOnboardingModal   from "@/components/WalletOnboardingModal";

// force-dynamic: evita fetch a localhost:8000 durante el build de Vercel
export const dynamic = "force-dynamic";

// ── Fetch de datos ────────────────────────────────────────
async function fetchHackathons(): Promise<ActiveHackathon[]> {
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
            .limit(50);
        if (!error && data && data.length > 0) return data as unknown as ActiveHackathon[];
        if (error) console.error("[hackatones/page] Supabase error:", error.message);
    }

    // 3. Sin datos — el cliente mostrará su estado vacío
    return [];
}

// ── Componente de carga inline para el Suspense ─────────
function HackatonSkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card-premium p-5">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="h-4 w-4 rounded skeleton shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-3/4 rounded skeleton" />
                            <div className="h-3 w-16 rounded skeleton" />
                        </div>
                    </div>
                    <div className="flex gap-4 mb-3">
                        <div className="h-3 w-20 rounded skeleton" />
                        <div className="h-3 w-16 rounded skeleton" />
                        <div className="h-3 w-20 rounded skeleton ml-auto" />
                    </div>
                    <div className="flex gap-2 mb-3">
                        {[1, 2, 3].map((j) => <div key={j} className="h-5 w-14 rounded-md skeleton" />)}
                    </div>
                    <div className="flex justify-end">
                        <div className="h-7 w-20 rounded-lg skeleton" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────
export default async function HackatonesPage() {
    const initialData = await fetchHackathons();

    return (
        <div className="p-6 min-h-screen">
            {/* Header — Server rendered, sin datos dinámicos */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-xs font-medium text-accent uppercase tracking-widest">
                        Intelligence Feed
                    </span>
                </div>
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">
                            Hacka<span className="gradient-text">tones</span>
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Devpost · DoraHacks · Devfolio · SNAP Engine activo
                        </p>
                    </div>

                    {/* Contador — renderizado en servidor */}
                    <div className="flex items-center gap-2">
                        <span className="badge-accent flex items-center gap-1.5">
                            <Database className="w-3 h-3" />
                            {initialData.length > 0 ? `${initialData.length} abiertas ahora` : "Sin convocatorias abiertas"}
                        </span>
                        <span className="badge-emerald flex items-center gap-1.5">
                            <Zap className="w-3 h-3" />
                            Live Feed
                        </span>
                    </div>
                </div>
            </div>

            {/* Modal Wallet-First — solo aparece si no hay wallet configurada */}
            <WalletOnboardingModal />

            <Suspense fallback={<HackatonSkeleton />}>
                <AggregatedHackathonsClient />
            </Suspense>
        </div>
    );
}
