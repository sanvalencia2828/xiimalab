"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Calendar, MapPin, CheckCircle2, Loader2, AlertCircle, Flame, Zap, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import CoachRoadmap from "./CoachRoadmap";

import { applyToHackathonAction } from "@/app/actions/hackathons";
import { useWallet } from "@/lib/WalletContext";

export type HackathonData = {
    id: string;
    title: string;
    description?: string;
    date?: string;
    location?: string;
    tags: string[];
    gradient?: string;
    matchScore?: number;
    match_score?: number;
    strategic_category?: string;
    project_highlight?: string;
    missing_skills?: string[];
    agent_roadmap?: object;
    // Fields from Supabase active_hackathons table
    url?: string;
    source_url?: string;
    source?: string;
    prize_pool?: number;
    deadline?: string;
    last_seen_at?: string;
};

export function OpportunityCard({ data, userSkills = [] }: { data: HackathonData, userSkills?: string[] }) {
    const [status, setStatus] = useState<"idle" | "applying" | "applied" | "missing_wallet">("idle");
    const [showRoadmap, setShowRoadmap] = useState(false);
    const { studentAddress, isLoaded } = useWallet();
    const router = useRouter();

    const handleApply = async () => {
        if (status !== "idle" && status !== "missing_wallet") return;
        
        if (!isLoaded) return; // Prevent action while hydrating

        if (!studentAddress) {
            setStatus("missing_wallet");
            // Auto redirect after a few seconds or they can click manually
            setTimeout(() => {
                router.push("/settings");
            }, 2500);
            return;
        }

        setStatus("applying");
        
        try {
            const result = await applyToHackathonAction(data.id, studentAddress);
            
            if (result.success) {
                setStatus("applied");
            } else {
                console.error("Error al aplicar:", result.error);
                setStatus("idle"); // Volver a idle para poder reintentar
            }
        } catch (e) {
            console.error("Excepción inesperada:", e);
            setStatus("idle");
        }
    };

    const isApplied = status === "applied";
    const isApplying = status === "applying";
    const isMissingWallet = status === "missing_wallet";

    const isGolden = (data.match_score || 0) >= 90;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className={`relative flex flex-col bg-card/80 backdrop-blur-md border rounded-2xl overflow-hidden shadow-lg transition-all duration-500 ${
                isApplied ? "border-emerald-500/50 bg-emerald-500/5" : 
                isGolden ? "border-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.2)]" : 
                data.gradient
            }`}
        >
            {/* Golden Particle Effect Mockup */}
            {isGolden && !isApplied && (
                <motion.div 
                    animate={{ 
                        opacity: [0.3, 0.6, 0.3],
                        scale: [1, 1.02, 1]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-amber-500/5 pointer-events-none" 
                />
            )}

            {/* Contenido principal */}
            <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20 text-accent">
                        <Briefcase className="w-6 h-6" />
                    </div>
                    <div className="flex gap-2">
                        {isGolden && !isApplied && (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-400 uppercase tracking-tighter animate-pulse">
                                <Zap className="w-3.5 h-3.5" /> Golden Opp
                            </span>
                        )}
                        {isApplied && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-500/30 font-medium flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Aplicado
                            </motion.div>
                        )}
                    </div>
                </div>

                <div className="flex items-baseline gap-2 mb-2">
                    <h3 className="text-xl font-bold text-white line-clamp-2">{data.title}</h3>
                </div>
                <p className="text-slate-400 text-sm mb-4 flex-1">{data.description}</p>

                {/* Meta info */}
                <div className="flex flex-col gap-2 mb-5">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                        <Calendar className="w-3.5 h-3.5 opacity-70" />
                        {data.date}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300">
                        <MapPin className="w-3.5 h-3.5 opacity-70" />
                        {data.location}
                    </div>
                </div>

                {/* Etiquetas */}
                <div className="flex flex-wrap gap-2 mt-auto mb-4">
                    {data.tags.map((tag) => (
                        <span key={tag} className="px-2 py-1 text-[10px] font-semibold tracking-wide uppercase bg-white/5 border border-white/10 rounded-md text-slate-300">
                            {tag}
                        </span>
                    ))}
                </div>

                {/* AI Strategic Insight (Senior Feature) */}
                {data.strategic_category && (
                    <div className="p-3 rounded-xl bg-accent/5 border border-accent/10 mt-auto">
                        <div className="flex items-center justify-between mb-1.5">
                           <div className="flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-accent" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                                    AI Strategic Insight: {data.strategic_category}
                                </span>
                           </div>
                           {data.agent_roadmap && (
                             <button 
                                onClick={() => setShowRoadmap(!showRoadmap)}
                                className="text-[10px] font-bold text-white hover:text-accent transition-colors flex items-center gap-1"
                             >
                                {showRoadmap ? "Cerrar" : "Ver Estrategia"}
                                <ChevronRight className={`w-3 h-3 transition-transform ${showRoadmap ? "rotate-90" : ""}`} />
                             </button>
                           )}
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed italic mb-2">
                            "{data.project_highlight || "Analizando impacto estratégico..."}"
                        </p>

                        {/* Expandable Roadmap */}
                        <AnimatePresence>
                            {showRoadmap && data.agent_roadmap && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <CoachRoadmap 
                                        hackathonId={data.id}
                                        hackathonTitle={data.title}
                                        tags={data.tags as string[]}
                                        roadmap={data.agent_roadmap as any} 
                                        onChallengeAccepted={(idx) => console.log(`Step ${idx} accepted`)}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Acción CTA */}
            <div className="p-4 border-t border-white/5 bg-black/20">
                <button
                    onClick={handleApply}
                    disabled={status === "applying" || status === "applied"}
                    className={`w-full relative overflow-hidden flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                        isApplied
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default"
                            : isMissingWallet
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                            : isApplying
                            ? "bg-accent/50 text-white cursor-not-allowed"
                            : "bg-accent text-white hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20 active:scale-95"
                    }`}
                >
                    <AnimatePresence mode="wait">
                        {isApplying ? (
                            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Enviando...
                            </motion.div>
                        ) : isApplied ? (
                            <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Hito Registrado
                            </motion.div>
                        ) : isMissingWallet ? (
                            <motion.div key="missing" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Conecta tu Wallet
                            </motion.div>
                        ) : (
                            <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                Aplicar ahora
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </div>

            {/* Floating Multi-source Match Score Badge */}
            {(data.match_score !== undefined || data.matchScore !== undefined) && (
                 (() => {
                    const score = data.match_score !== undefined ? data.match_score * 100 : (data.matchScore || 0);
                    if (score < 60) return null;

                    const isHighMatch = score > 85;

                    return (
                        <div
                            className={`absolute -top-3 -right-3 z-20 flex flex-col items-end group`}
                        >
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-lg border font-bold text-xs tracking-wide shadow-black/50 transition-transform hover:scale-105 cursor-help ${
                                isHighMatch
                                    ? "bg-slate-900 border-emerald-500/50 text-emerald-400 animate-pulse"
                                    : "bg-slate-900 border-blue-500/50 text-blue-400"
                            }`}>
                                {isHighMatch ? (
                                    <Flame className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20" />
                                ) : (
                                    <Zap className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
                                )}
                                {Math.round(score)}% {isHighMatch ? "Match Ideal" : "Gran Match"}
                            </div>
                            
                            {/* Hover Tooltip (Skills Basis) */}
                            {userSkills.length > 0 && (
                                <div className="absolute top-10 right-0 w-max max-w-[200px] p-2 bg-slate-900 border border-slate-700/50 text-[10px] text-slate-300 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 leading-tight">
                                    Basado en tus skills:<br/>
                                    <span className="text-emerald-400 font-medium">
                                        {userSkills.slice(0, 3).join(", ")}{userSkills.length > 3 && ", ..."}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })()
            )}
        </motion.div>
    );
}
