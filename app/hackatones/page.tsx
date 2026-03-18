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
        </div>
    );
}
