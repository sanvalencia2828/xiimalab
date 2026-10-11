"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, X, CheckCircle2, AlertCircle, Sparkles, Loader2, TrendingUp, Info, UserCircle2 } from "lucide-react";

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

interface UserProfile {
    skills: string[];
}

const MAX_SKILL_CHIPS = 5;
// /api/match responde con este modelo cuando no hay motor de IA disponible (sin backend o sin API key)
const HEURISTIC_MODEL = "heuristic-fallback";

function skillNames(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((s) => (typeof s === "string" ? s : s && typeof s === "object" && "name" in s ? String((s as { name: unknown }).name) : ""))
        .map((s) => s.trim())
        .filter(Boolean);
}

/** Skills guardadas en el navegador (página /skills, o perfil de /profile). Null si no hay ninguna. */
function getUserProfile(): UserProfile | null {
    if (typeof window === "undefined") return null;
    try {
        const saved = localStorage.getItem("user_skills");
        let skills = saved ? skillNames(JSON.parse(saved)) : [];
        for (const key of ["user_profile", "xiimalab_profile"]) {
            if (skills.length > 0) break;
            const stored = localStorage.getItem(key);
            const parsed: unknown = stored ? JSON.parse(stored) : null;
            if (parsed && typeof parsed === "object") skills = skillNames((parsed as Record<string, unknown>).skills);
        }
        return skills.length > 0 ? { skills } : null;
    } catch {
        return null; // perfil ilegible → se trata como sin perfil
    }
}

function ScoreRing({ score }: { score: number }) {
    const color = score >= 75 ? "#34d399" : score >= 50 ? "#f59e0b" : "#f87171";
    const r = 36, circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return (
        <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
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
                {score}%
            </motion.span>
        </div>
    );
}

function SkillChips({ skills, tone }: { skills: string[]; tone: "neutral" | "good" | "gap" }) {
    const cls =
        tone === "good" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
        tone === "gap" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
        "bg-accent/10 text-accent border-accent/20";
    return (
        <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
                <span key={s} className={`text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{s}</span>
            ))}
        </div>
    );
}

export default function AIMatchModal({ hackathonTitle, hackathonTags, hackathonPrize, hackathonDeadline, onClose }: Props) {
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [result, setResult] = useState<MatchResult | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setProfile(getUserProfile());
        setMounted(true);
    }, []);

    const runAnalysis = async () => {
        if (!profile) return;
        setStatus("loading");
        setErrorMessage("");
        try {
            const res = await fetch("/api/match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_profile: { skills: profile.skills },
                    hackathon_data: {
                        title: hackathonTitle,
                        tags: hackathonTags,
                        prize_pool: hackathonPrize,
                        deadline: hackathonDeadline,
                    },
                }),
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) throw new Error(`El servidor respondió con HTTP ${res.status}`);
            const data = (await res.json()) as Partial<MatchResult>;
            if (typeof data.match_score !== "number") throw new Error("La respuesta no incluye un porcentaje de match");
            setResult({
                match_score: Math.round(data.match_score),
                matching_skills: data.matching_skills ?? [],
                missing_skills: data.missing_skills ?? [],
                recommendation: data.recommendation ?? "",
                model_used: data.model_used,
            });
            setStatus("done");
        } catch (err) {
            const timedOut = err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
            setErrorMessage(
                timedOut ? "El análisis tardó más de 15 segundos."
                : err instanceof TypeError ? "No se pudo conectar con el servidor. Revisa tu conexión."
                : err instanceof Error ? err.message
                : "Error desconocido",
            );
            setStatus("error");
        }
    };

    if (!mounted) return null;

    const isHeuristic = result?.model_used === HEURISTIC_MODEL;
    const profileSkills = profile?.skills ?? [];

    // Portal: las tarjetas que abren este modal tienen transform, y eso descoloca un `fixed` anidado
    return createPortal(
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Modal */}
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Análisis de match con IA"
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 20 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    onClick={e => e.stopPropagation()}
                    className="card-premium w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-white/[0.06] bg-accent/5 shrink-0">
                        <div className="flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5 text-accent" />
                            <span className="font-bold text-white text-sm">Análisis de match con IA</span>
                        </div>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
                            aria-label="Cerrar"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors">
                            <X className="w-4 h-4" />
                        </motion.button>
                    </div>

                    {/* Hackathon title */}
                    <div className="px-5 py-3 border-b border-white/[0.06] shrink-0">
                        <p className="text-xs text-slate-500 mb-0.5">Evaluando compatibilidad con</p>
                        <p className="text-sm font-semibold text-white line-clamp-1">{hackathonTitle}</p>
                    </div>

                    {/* Body */}
                    <div className="p-5 overflow-y-auto">
                        {status === "idle" && (
                            <div className="flex flex-col items-center gap-4 py-2">
                                <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20">
                                    <Sparkles className="w-8 h-8 text-accent" />
                                </div>
                                <p className="text-sm text-slate-400 text-center max-w-xs">
                                    La IA comparará tu perfil y tus skills con los requisitos de esta hackatón.
                                </p>

                                {profile ? (
                                    <div className="w-full">
                                        <p className="text-xs text-slate-500 mb-1.5">Skills de tu perfil que se van a comparar</p>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <SkillChips skills={profileSkills.slice(0, MAX_SKILL_CHIPS)} tone="neutral" />
                                            {profileSkills.length > MAX_SKILL_CHIPS && (
                                                <span className="text-[11px] text-slate-500">+{profileSkills.length - MAX_SKILL_CHIPS}</span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                        <UserCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            Aún no tienes skills en tu perfil, así que no hay nada que comparar.{" "}
                                            <Link href="/profile" onClick={onClose} className="text-accent font-semibold hover:underline">
                                                Completa Mi Perfil
                                            </Link>
                                        </p>
                                    </div>
                                )}

                                <motion.button
                                    whileHover={profile ? { scale: 1.03 } : {}} whileTap={profile ? { scale: 0.97 } : {}}
                                    onClick={runAnalysis}
                                    disabled={!profile}
                                    className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <BrainCircuit className="w-4 h-4" />
                                    Analizar match
                                </motion.button>
                            </div>
                        )}

                        {status === "loading" && (
                            <div className="flex flex-col items-center gap-3 py-8" role="status">
                                <div className="w-14 h-14 rounded-2xl card-premium flex items-center justify-center pulse-glow">
                                    <Loader2 className="w-7 h-7 animate-spin text-accent" />
                                </div>
                                <p className="text-sm text-slate-300">Analizando tu perfil…</p>
                                <p className="text-xs text-slate-500 text-center max-w-xs">
                                    Comparando {profileSkills.length} skill{profileSkills.length === 1 ? "" : "s"} con las etiquetas y requisitos de la hackatón. Puede tardar unos segundos.
                                </p>
                                <div className="w-32 progress-track">
                                    <div className="progress-fill bg-gradient-to-r from-accent to-purple-500 shimmer-bg w-2/3" />
                                </div>
                            </div>
                        )}

                        {status === "error" && (
                            <div className="flex flex-col items-center gap-3 py-6" role="alert">
                                <AlertCircle className="w-8 h-8 text-rose-400" />
                                <p className="text-sm text-slate-300">No se pudo completar el análisis</p>
                                {errorMessage && <p className="text-xs text-slate-500 text-center max-w-xs">{errorMessage}</p>}
                                <button onClick={runAnalysis} className="btn-ghost text-xs font-bold text-accent">
                                    Reintentar
                                </button>
                            </div>
                        )}

                        {status === "done" && result && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                {isHeuristic && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            El motor de IA no está configurado (falta el backend o su API key). Este resultado es una estimación por coincidencia entre tus skills y las etiquetas, no un análisis de IA.
                                        </p>
                                    </div>
                                )}

                                {/* Porcentaje */}
                                <div className="flex items-center gap-5">
                                    <ScoreRing score={result.match_score} />
                                    <div>
                                        <p className="text-xs text-slate-500 mb-0.5">Compatibilidad</p>
                                        <p className="text-lg font-bold text-white">
                                            {result.match_score >= 75 ? "🔥 Excelente fit"
                                             : result.match_score >= 50 ? "👍 Buen match"
                                             : "⚠️ Match parcial"}
                                        </p>
                                        <p className="text-[10px] text-slate-600 mt-0.5">
                                            {isHeuristic ? "Estimación sin IA" : "Análisis con IA"}
                                        </p>
                                    </div>
                                </div>

                                {/* Puntos fuertes */}
                                <div>
                                    <p className="text-xs font-semibold text-emerald-400 mb-1.5 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Puntos fuertes
                                    </p>
                                    {result.matching_skills.length > 0
                                        ? <SkillChips skills={result.matching_skills} tone="good" />
                                        : <p className="text-xs text-slate-500">Ninguna de tus skills coincide directamente con esta hackatón.</p>}
                                </div>

                                {/* Carencias */}
                                <div>
                                    <p className="text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> Carencias
                                    </p>
                                    {result.missing_skills.length > 0
                                        ? <SkillChips skills={result.missing_skills} tone="gap" />
                                        : <p className="text-xs text-slate-500">No se detectaron carencias relevantes.</p>}
                                </div>

                                {/* Recomendación */}
                                {result.recommendation && (
                                    <div className="p-3 rounded-xl bg-accent/5 border border-accent/15">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Recomendación</p>
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            💡 {result.recommendation}
                                        </p>
                                    </div>
                                )}

                                <button onClick={runAnalysis}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline">
                                    Analizar de nuevo
                                </button>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
}
