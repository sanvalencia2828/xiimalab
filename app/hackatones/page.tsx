<<<<<<< HEAD
import { Sparkles, LayoutGrid, SearchX } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { OpportunityCard, type HackathonData } from "@/components/OpportunityCard";
import { cookies } from "next/headers";
import { getSmartMatchHackathons } from "@/app/actions/match";

import { SyncButton } from "@/components/SyncButton";

export const revalidate = 60; // Refresh data gracefully every 60s

export default async function HackatonesPage() {
    // 1. Get user identity via Cookies (Server-Side)
    const cookieStore = await cookies();
    const studentAddress = cookieStore.get("xiimalab_stellar_address")?.value || null;

    // 2. Fetch User Learning Skills if wallet is connected
    let userSkills: string[] = ["JavaScript", "React", "Smart Contracts (Stellar)"]; // Fallback defaults
    if (studentAddress) {
        const { data: progress } = await supabase
            .from("user_skills_progress")
            .select("skill_id")
            .eq("student_address", studentAddress);
            
        if (progress && progress.length > 0) {
            userSkills = progress.map((p) => p.skill_id.split("-").join(" ")).slice(0, 4);
        }
    }

    // 3. Real pgvector MarketMatch Logic using new Server Action
    const formattedHackathons: HackathonData[] = await getSmartMatchHackathons(studentAddress);

    return (
        <div className="min-h-screen p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
            {/* Header: Enfocado en el Match de Habilidades */}
            <header className="relative bg-slate-900/50 border border-blue-500/20 rounded-3xl p-8 overflow-hidden shadow-lg shadow-blue-900/10">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
                            <Sparkles className="w-3.5 h-3.5" />
                            Proof of Skill Tracker
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                            Tu Match de Habilidades
                        </h1>
                        <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-6">
                            El sistema cruza los requerimientos técnicos de tu <strong className="text-white">Staking Educativo</strong> con oportunidades globales. Aplica a un reto que requiera tus conocimientos para liberar automáticamente tu Escrow en Stellar.
                        </p>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <SyncButton />
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                            Última sync: {new Date().toLocaleTimeString()}
                        </span>
                    </div>
                </div>
                
                {/* Indicadores de Skills Requeridos (Dynamic) */}
                <div className="relative z-10 flex flex-wrap gap-2 items-center capitalize mt-6">
                        <span className="text-sm text-slate-400 mr-2">
                            {studentAddress ? "Tus skills en aprendizaje:" : "Skills de la industria objetivo:"}
                        </span>
                        {userSkills.map((skill, i) => {
                            const colors = ["emerald", "blue", "purple", "amber"];
                            const color = colors[i % colors.length];
                            return (
                                <span key={skill} className={`px-3 py-1 bg-slate-800 border border-slate-700 text-${color}-400 rounded-md text-sm font-mono flex items-center gap-1`}>
                                    <span className={`w-2 h-2 rounded-full bg-${color}-500 animate-pulse`}></span>
                                    {skill}
                                </span>
                    );
                })}
            </div>
        </header>

            {/* Grid de Oportunidades o Empty State */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5 text-accent" />
                        Hackatones Recomendados
                    </h2>
                    <span className="text-sm font-medium pr-2 text-slate-400">
                        {formattedHackathons.length} disponibles
                    </span>
                </div>
                
                {formattedHackathons.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {formattedHackathons.map((hackathon, idx) => (
                            <div key={hackathon.id} style={{ animationDelay: `${idx * 100}ms` }} className="animate-fade-in-up">
                                <OpportunityCard data={hackathon} userSkills={userSkills} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-3xl bg-card/20">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <SearchX className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No hay oportunidades activas</h3>
                        <p className="text-slate-400 max-w-md">
                            Nuestro <strong className="text-accent">Snap-Engine</strong> está buscando nuevas vacantes y hackatones en Devfolio y DoraHacks. Vuelve pronto para descubrir tu próximo reto.
                        </p>
                    </div>
                )}
            </section>
=======
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
import HackatonesClient        from "@/components/HackatonesClient";
import WalletOnboardingModal   from "@/components/WalletOnboardingModal";
import EcommerceLoading        from "../ecommerce/loading";

// force-dynamic: evita fetch a localhost:8000 durante el build de Vercel
export const dynamic = "force-dynamic";

// ── Fetch de datos ────────────────────────────────────────
async function fetchHackathons(): Promise<ActiveHackathon[]> {
    // 1. Intentar Supabase directamente
    if (supabase) {
        const { data, error } = await supabase
            .from("active_hackathons")
            .select("id, title, prize_pool, tags, deadline, match_score, source_url, source, last_seen_at")
            .order("last_seen_at", { ascending: false })
            .limit(50);

        if (!error && data && data.length > 0) {
            return data as ActiveHackathon[];
        }
        if (error) {
            console.error("[hackatones/page] Supabase error:", error.message);
        }
    } else {
        console.info("[hackatones/page] Supabase no configurada — usando fallback API");
    }

    // 2. Fallback → API route interna (proxy al FastAPI)
    try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
        const res  = await fetch(`${base}/api/hackathons?limit=50`, {
            next: { revalidate: 300 },
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data as ActiveHackathon[];
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

            {/* HackatonesClient recibe los datos del servidor.
                Suspense garantiza que el fallback se muestra si el fetch tarda. */}
            {/* Modal Wallet-First — solo aparece si no hay wallet configurada */}
            <WalletOnboardingModal />

            <Suspense fallback={<HackatonSkeleton />}>
                <HackatonesClient initialData={initialData} />
            </Suspense>
>>>>>>> 818308f5dd3f39122c8e46bc57ee372d2f05d9ba
        </div>
    );
}
