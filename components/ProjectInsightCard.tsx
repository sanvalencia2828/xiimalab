"use client";

/**
 * ProjectInsightCard.tsx
 * Muestra el top match de un proyecto contra las hackatones activas.
 * Diseñado para integrarse en ProjectCard o en el dashboard.
 *
 * Ejemplo de texto generado:
 *   "Match del 92% con AURA: Esta hackatón premia el procesamiento de
 *    imágenes, tu fuerte. Stack compartido: Python, OpenCV, AI."
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    TrendingUp, Trophy, ExternalLink, Tag,
    Loader2, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";

interface ProjectMatch {
    project_id:      string;
    project_title:   string;
    hackathon_id:    string;
    hackathon_title: string;
    match_pct:       number;
    shared_tags:     string[];
    reasoning:       string;
    prize_pool:      number;
    source:          string;
    source_url:      string | null;
}

// ── Helpers ────────────────────────────────────────────────────────
function matchGrade(pct: number) {
    if (pct >= 85) return { label: "Excelente",  color: "text-emerald-400", bar: "bg-emerald-400", ring: "border-emerald-500/25 bg-emerald-500/5" };
    if (pct >= 70) return { label: "Muy bueno",  color: "text-sky-400",     bar: "bg-sky-400",     ring: "border-sky-500/25 bg-sky-500/5" };
    if (pct >= 55) return { label: "Moderado",   color: "text-amber-400",   bar: "bg-amber-400",   ring: "border-amber-500/25 bg-amber-500/5" };
    return           { label: "Exploratorio",   color: "text-slate-400",   bar: "bg-slate-500",   ring: "border-slate-600/25 bg-slate-700/5" };
}

const SOURCE_COLOR: Record<string, string> = {
    devfolio:  "text-sky-400",
    dorahacks: "text-purple-400",
    devpost:   "text-emerald-400",
};

// ── Barra de match animada ─────────────────────────────────────────
function MatchBar({ pct, barColor }: { pct: number; barColor: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <div className="flex-1 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
                    className={`h-full rounded-full ${barColor}`}
                />
            </div>
            <span className="text-xs font-bold w-8 text-right shrink-0" style={{ color: "inherit" }}>
                {pct}%
            </span>
        </div>
    );
}

// ── Componente principal ───────────────────────────────────────────
interface ProjectInsightCardProps {
    projectId:    string;
    projectTitle: string;
    compact?:     boolean;  // versión pequeña para embeber en ProjectCard
}

export default function ProjectInsightCard({
    projectId,
    projectTitle,
    compact = false,
}: ProjectInsightCardProps) {
    const [matches,   setMatches]   = useState<ProjectMatch[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [expanded,  setExpanded]  = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/agents/matches?project_id=${projectId}`);
                if (res.ok) {
                    const data = await res.json();
                    setMatches(Array.isArray(data) ? data.slice(0, 3) : []);
                }
            } catch { /* silencioso */ }
            finally { setLoading(false); }
        };
        load();
    }, [projectId]);

    const top = matches[0];

    // ── Loading ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className={`flex items-center gap-2 ${compact ? "py-2" : "p-4 bg-card border border-border rounded-xl"}`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                <span className="text-xs text-slate-500">Calculando match...</span>
            </div>
        );
    }

    // ── Sin datos ──────────────────────────────────────────────────
    if (!top) {
        return (
            <div className={`flex items-center gap-2 ${compact ? "py-2" : "p-4 bg-card border border-border rounded-xl"}`}>
                <Sparkles className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-xs text-slate-500">
                    Corre el Agent Crew para descubrir oportunidades
                </span>
            </div>
        );
    }

    const grade = matchGrade(top.match_pct);

    // ── Vista compact (para ProjectCard) ──────────────────────────
    if (compact) {
        return (
            <div className={`rounded-xl border p-3 mt-3 ${grade.ring}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${grade.color}`} />
                        <span className={`text-xs font-bold ${grade.color}`}>
                            Match {top.match_pct}%
                        </span>
                        <span className="text-xs text-slate-500">·</span>
                        <span className="text-xs text-slate-400 truncate">{grade.label}</span>
                    </div>
                    {top.source_url && (
                        <a href={top.source_url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                            <ExternalLink className="w-3 h-3 text-accent" />
                        </a>
                    )}
                </div>

                <MatchBar pct={top.match_pct} barColor={grade.bar} />

                <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-2">
                    <span className="font-medium text-slate-200">
                        «{top.hackathon_title.slice(0, 45)}{top.hackathon_title.length > 45 ? "…" : ""}»
                    </span>{" "}
                    — {top.reasoning}
                </p>

                {top.prize_pool > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        <span className="text-xs text-amber-400 font-bold">
                            ${top.prize_pool.toLocaleString()}
                        </span>
                        <span className={`text-xs ml-1 ${SOURCE_COLOR[top.source] ?? "text-slate-400"}`}>
                            {top.source.charAt(0).toUpperCase() + top.source.slice(1)}
                        </span>
                    </div>
                )}
            </div>
        );
    }

    // ── Vista completa (para dashboard / /projects) ────────────────
    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${grade.ring}`}>
                        <TrendingUp className={`w-4.5 h-4.5 ${grade.color}`} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium">Top match para</p>
                        <h3 className="text-sm font-bold text-white">{projectTitle}</h3>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className={`text-xl font-bold ${grade.color}`}>{top.match_pct}%</p>
                        <p className="text-xs text-slate-500">{grade.label}</p>
                    </div>
                    {expanded
                        ? <ChevronUp className="w-4 h-4 text-slate-500" />
                        : <ChevronDown className="w-4 h-4 text-slate-500" />
                    }
                </div>
            </div>

            {/* Top match insight */}
            <div className="px-4 pb-4 border-t border-border/50">
                <div className="mt-3">
                    <MatchBar pct={top.match_pct} barColor={grade.bar} />
                </div>

                <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                    <span className="font-semibold text-white">
                        Match del {top.match_pct}% con {projectTitle}:
                    </span>{" "}
                    {top.reasoning}
                </p>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {top.shared_tags.slice(0, 4).map(tag => (
                        <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-300 border border-slate-600/40">
                            <Tag className="w-2.5 h-2.5" />{tag}
                        </span>
                    ))}
                    {top.prize_pool > 0 && (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-400 ml-auto">
                            <Trophy className="w-3 h-3" />
                            ${top.prize_pool.toLocaleString()}
                        </span>
                    )}
                </div>

                {top.source_url && (
                    <a href={top.source_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-accent hover:underline">
                        Ver hackatón <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </div>

            {/* Expandible: matches 2 y 3 */}
            <AnimatePresence>
                {expanded && matches.length > 1 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden border-t border-border/50"
                    >
                        {matches.slice(1).map((m, i) => {
                            const g = matchGrade(m.match_pct);
                            return (
                                <div key={m.hackathon_id}
                                    className={`px-4 py-3 flex items-center gap-3 ${i > 0 ? "border-t border-border/30" : ""}`}>
                                    <span className={`text-sm font-bold w-10 text-right ${g.color}`}>
                                        {m.match_pct}%
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-200 truncate">
                                            {m.hackathon_title}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                            {m.reasoning}
                                        </p>
                                    </div>
                                    {m.source_url && (
                                        <a href={m.source_url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-500 hover:text-accent transition-colors" />
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
