/**
 * app/hackatones/page.tsx — SERVER COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 * Arquitectura de hidratación:
 *   • Este archivo NO tiene "use client" — se ejecuta en el servidor.
 *   • Fetcha active_hackathons desde Supabase en build/request time.
 *   • Pasa initialData a <HackatonesClient> que maneja filtros + SSE.
 *   • Si Supabase no responde → fallback a /api/hackathons (FastAPI).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Suspense }      from "react";
import { Zap, Database } from "lucide-react";
import { supabase, type ActiveHackathon } from "@/lib/supabase";
import { AggregatedHackathonsClient } from "@/components/AggregatedHackathonsClient";
import WalletOnboardingModal   from "@/components/WalletOnboardingModal";

// force-dynamic: evita fetch a localhost:8000 durante el build de Vercel
export const dynamic = "force-dynamic";

// ── Fetch de datos ────────────────────────────────────────
async function fetchHackathons(): Promise<ActiveHackathon[]> {
    // 1. Intentar Supabase directamente
    if (supabase) {
        const { data, error } = await supabase
            .from("hackathons")
            .select("id, title, prize_pool, tags, deadline, match_score, source_url, source, scraped_at")
            .order("match_score", { ascending: false })
            .limit(50);

        if (!error && data && data.length > 0) {
            return data as unknown as ActiveHackathon[];
        }
        if (error) {
            console.error("[hackatones/page] Supabase error:", error.message);
        }
    } else {
        console.info("[hackatones/page] Supabase no configurada — usando fallback API");
    }

    // 2. Fallback → API route interna
    // En Vercel usar VERCEL_URL; en local usar localhost:3000
    try {
        const vercelUrl = process.env.VERCEL_URL;
        const base = vercelUrl
            ? `https://${vercelUrl}`
            : (process.env.NEXTAUTH_URL ?? "http://localhost:3000");
        const res = await fetch(`${base}/api/hackathons?limit=50`, {
            next: { revalidate: 300 },
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data as unknown as ActiveHackathon[];
        }
    } catch (err) {
        console.warn("[hackatones/page] Fallback API error:", err);
    }

    // 3. Sin datos — el cliente mostrará "Buscando nuevas oportunidades..."
    return [];
}

// ── Componente de carga inline para el Suspense ─────────
function HackatonSkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="h-4 w-4 rounded bg-muted shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-3/4 rounded bg-muted" />
                            <div className="h-3 w-16 rounded bg-muted" />
                        </div>
                    </div>
                    <div className="flex gap-4 mb-3">
                        <div className="h-3 w-20 rounded bg-muted" />
                        <div className="h-3 w-16 rounded bg-muted" />
                        <div className="h-3 w-20 rounded bg-muted ml-auto" />
                    </div>
                    <div className="flex gap-2 mb-3">
                        {[1, 2, 3].map((j) => <div key={j} className="h-5 w-14 rounded-md bg-muted" />)}
                    </div>
                    <div className="flex justify-end">
                        <div className="h-7 w-20 rounded-lg bg-muted" />
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
                        <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                            <Database className="w-3.5 h-3.5" />
                            {initialData.length} en base de datos
                        </span>
                        <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Zap className="w-3.5 h-3.5" />
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
