"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, X, CheckCircle2, AlertCircle, Sparkles, Loader2, TrendingUp } from "lucide-react";

interface MatchResult {
    match_score: number;
    matching_skills: string[];
    missing_skills: string[];
    recommendation: string;
    model_used?: string;
}

interface Props {
    hackathonTitle: string;
    hackathonTags: string[];
    hackathonPrize: number;
    hackathonDeadline: string;
    onClose: () => void;
}

// Default profile (can be overridden via localStorage)
function getUserProfile() {
    if (typeof window === "undefined") return null;
    try {
        const stored = localStorage.getItem("xiimalab_profile");
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return {
        username: "sanxi_ima",
        skills: ["Python", "Next.js", "FastAPI", "TypeScript", "Docker", "Supabase", "AI/ML"],
        stack: ["Next.js", "TypeScript", "FastAPI", "Docker", "Python"],
        experience: "intermediate",
        hackathons_count: 2,
    };
}

function ScoreRing({ score }: { score: number }) {
    const color = score >= 75 ? "#34d399" : score >= 50 ? "#f59e0b" : "#f87171";
    const r = 36, circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return (
        <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" width="96" height="96">
                <circle cx="48" cy="48" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
                <motion.circle
                    cx="48" cy="48" r={r} fill="none"
                    stroke={color} strokeWidth="8"
                    strokeDasharray={circ}
                    strokeLinecap="round"
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                />
            </svg>
            <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="text-2xl font-black"
                style={{ color }}
            >
                {score}
            </motion.span>
        </div>
    );
}

export default function AIMatchModal({ hackathonTitle, hackathonTags, hackathonPrize, hackathonDeadline, onClose }: Props) {
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [result, setResult] = useState<MatchResult | null>(null);

    const runAnalysis = async () => {
        setStatus("loading");
        const profile = getUserProfile();
        try {
            const res = await fetch("/api/match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_profile: profile,
                    hackathon_data: {
                        title: hackathonTitle,
                        tags: hackathonTags,
                        prize_pool: hackathonPrize,
                        deadline: hackathonDeadline,
                    },
                }),
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setResult(await res.json());
            setStatus("done");
        } catch {
            setStatus("error");
        }
    };

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 20 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    onClick={e => e.stopPropagation()}
                    className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-border bg-accent/5">
                        <div className="flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5 text-accent" />
                            <span className="font-bold text-white text-sm">AI Match Analysis</span>
                        </div>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors">
                            <X className="w-4 h-4" />
                        </motion.button>
                    </div>

                    {/* Hackathon title */}
                    <div className="px-5 py-3 border-b border-border/50">
                        <p className="text-xs text-slate-500 mb-0.5">Evaluando compatibilidad con</p>
                        <p className="text-sm font-semibold text-white line-clamp-1">{hackathonTitle}</p>
                    </div>

                    {/* Body */}
                    <div className="p-5">
                        {status === "idle" && (
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20">
                                    <Sparkles className="w-8 h-8 text-accent" />
                                </div>
                                <p className="text-sm text-slate-400 text-center max-w-xs">
                                    Claude 3.5 analizará tu perfil contra los requisitos de este hackatón
                                </p>
                                <motion.button
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    onClick={runAnalysis}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 rounded-xl text-sm font-semibold transition-all"
                                >
                                    <BrainCircuit className="w-4 h-4" />
                                    Analizar Match
                                </motion.button>
                            </div>
                        )}

                        {status === "loading" && (
                            <div className="flex flex-col items-center gap-3 py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                                <p className="text-sm text-slate-400">Claude analizando tu perfil...</p>
                            </div>
                        )}

                        {status === "error" && (
                            <div className="flex flex-col items-center gap-3 py-6">
                                <AlertCircle className="w-8 h-8 text-rose-400" />
                                <p className="text-sm text-slate-400">Error al analizar. Intenta de nuevo.</p>
                                <button onClick={() => setStatus("idle")} className="text-xs text-accent underline">
                                    Reintentar
                                </button>
                            </div>
                        )}

                        {status === "done" && result && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                {/* Score ring */}
                                <div className="flex items-center gap-5">
                                    <ScoreRing score={result.match_score} />
                                    <div>
                                        <p className="text-xs text-slate-500 mb-0.5">Compatibilidad</p>
                                        <p className="text-lg font-bold text-white">
                                            {result.match_score >= 75 ? "🔥 Excelente fit"
                                             : result.match_score >= 50 ? "👍 Buen match"
                                             : "⚠️ Match parcial"}
                                        </p>
                                        {result.model_used && (
                                            <p className="text-[10px] text-slate-600 mt-0.5">{result.model_used}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Matching skills */}
                                {result.matching_skills.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-400 mb-1.5 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Habilidades que ya tienes
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {result.matching_skills.map(s => (
                                                <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Missing skills */}
                                {result.missing_skills.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" /> Skills a reforzar
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {result.missing_skills.map(s => (
                                                <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Recommendation */}
                                {result.recommendation && (
                                    <div className="p-3 rounded-xl bg-accent/5 border border-accent/15">
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            💡 {result.recommendation}
                                        </p>
                                    </div>
                                )}

                                <button onClick={() => setStatus("idle")}
                                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors underline">
                                    Analizar de nuevo
                                </button>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
