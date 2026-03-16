"use client";

/**
 * AgentInsights.tsx
 * Panel de oportunidades detectadas por el Agent Crew.
 * Se integra en /projects debajo del grid de ProjectCards.
 */
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bot, Sparkles, ExternalLink, ChevronRight,
    RefreshCw, Trophy, Zap, CheckCircle2, Clock,
} from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────
interface Insight {
    id:                number;
    agent_name:        string;
    insight_type:      string;
    project_id:        string | null;
    hackathon_id:      string | null;
    project_title:     string | null;
    hackathon_title:   string | null;
    hackathon_source:  string | null;
    title:             string;
    summary:           string;
    reasoning:         string | null;
    action_url:        string | null;
    relevance_score:   number;
    match_pct:         number;
    status:            string;
    created_at:        string;
    agent_metadata:    Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────
function matchColor(pct: number) {
    if (pct >= 85) return { bar: "bg-emerald-400", text: "text-emerald-400", ring: "border-emerald-500/30 bg-emerald-500/5" };
    if (pct >= 70) return { bar: "bg-sky-400",     text: "text-sky-400",     ring: "border-sky-500/30 bg-sky-500/5" };
    if (pct >= 55) return { bar: "bg-amber-400",   text: "text-amber-400",   ring: "border-amber-500/30 bg-amber-500/5" };
    return { bar: "bg-slate-400", text: "text-slate-400", ring: "border-slate-600/30 bg-slate-700/10" };
}

const SOURCE_COLORS: Record<string, string> = {
    devfolio:  "text-sky-400",
    dorahacks: "text-purple-400",
    devpost:   "text-emerald-400",
};

function MatchRing({ pct }: { pct: number }) {
    const c = matchColor(pct);
    const r = 20;
    const circ = 2 * Math.PI * r;
    const dash  = (pct / 100) * circ;
    return (
        <div className="relative w-14 h-14 shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor"
                    strokeWidth="4" className="text-slate-700" />
                <motion.circle cx="24" cy="24" r={r} fill="none"
                    stroke="currentColor" strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${circ}`}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ - dash }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={c.text}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xs font-bold ${c.text}`}>{pct}%</span>
            </div>
        </div>
    );
}

// ── InsightCard ───────────────────────────────────────────────────
function InsightCard({ insight, onRead }: { insight: Insight; onRead: (id: number) => void }) {
    const c      = matchColor(insight.match_pct);
    const meta   = insight.agent_metadata || {};
    const prize  = meta.prize_pool as number | undefined;
    const source = insight.hackathon_source ?? "";
    const tags   = (meta.hack_tags as string[] | undefined) ?? [];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className={`border rounded-2xl p-5 ${c.ring} group relative overflow-hidden`}
        >
            {/* Accent line */}
            <div className={`absolute top-0 left-0 right-0 h-px opacity-50 ${c.bar}`} />

            <div className="flex items-start gap-4">
                {/* Match ring */}
                <MatchRing pct={insight.match_pct} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                            {insight.title}
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {insight.action_url && (
                                <a href={insight.action_url} target="_blank" rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg border border-border text-slate-500 hover:text-accent hover:border-accent/40 transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            )}
                            <button
                                onClick={() => onRead(insight.id)}
                                className="p-1.5 rounded-lg border border-border text-slate-500 hover:text-emerald-400 hover:border-emerald-400/40 transition-colors"
                                title="Marcar como leído"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                        {insight.project_title && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Zap className="w-3 h-3 text-accent" />
                                {insight.project_title}
                            </span>
                        )}
                        {source && (
                            <span className={`text-xs font-medium ${SOURCE_COLORS[source] ?? "text-slate-400"}`}>
                                {source.charAt(0).toUpperCase() + source.slice(1)}
                            </span>
                        )}
                        {prize !== undefined && prize > 0 && (
                            <span className="flex items-center gap-1 text-xs text-amber-400 font-bold">
                                <Trophy className="w-3 h-3" />
                                ${prize.toLocaleString()}
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
                            <Clock className="w-3 h-3" />
                            {new Date(insight.created_at).toLocaleDateString("es", { month: "short", day: "numeric" })}
                        </span>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {insight.summary}
                    </p>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                            {tags.map(t => (
                                <span key={t} className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700/50">
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── Componente principal ───────────────────────────────────────────
export default function AgentInsights({ projectFilter }: { projectFilter?: string }) {
    const [insights, setInsights]   = useState<Insight[]>([]);
    const [loading,  setLoading]    = useState(true);
    const [running,  setRunning]    = useState(false);
    const [error,    setError]      = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ status: "new", limit: "10" });
            if (projectFilter) params.set("project_id", projectFilter);
            const res = await fetch(`/api/agents/insights?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setInsights(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error cargando insights");
        } finally {
            setLoading(false);
        }
    }, [projectFilter]);

    useEffect(() => { load(); }, [load]);

    const triggerCrew = async () => {
        setRunning(true);
        try {
            await fetch("/api/agents/insights", { method: "POST" });
            await new Promise(r => setTimeout(r, 2000));
            await load();
        } finally {
            setRunning(false);
        }
    };

    const markRead = async (id: number) => {
        setInsights(prev => prev.filter(i => i.id !== id));
        await fetch(`/api/agents/insights`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        }).catch(() => {});
    };

    return (
        <div className="mt-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
                        <Bot className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-white">Agent Crew</h2>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
                                Oportunidades
                            </span>
                            {insights.length > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 font-bold animate-pulse">
                                    {insights.length} nuevas
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            4 agentes analizando hackatones en tiempo real
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={load}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        Actualizar
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={triggerCrew}
                        disabled={running}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Sparkles className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
                        {running ? "Ejecutando..." : "Correr Agentes"}
                    </motion.button>
                </div>
            </div>

            {/* Pipeline visual */}
            <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1">
                {[
                    { label: "HackathonScout",    color: "text-purple-400 bg-purple-500/10 border-purple-500/25" },
                    { label: "ProjectAnalyzer",   color: "text-sky-400 bg-sky-500/10 border-sky-500/25" },
                    { label: "MatchOracle",        color: "text-accent bg-accent/10 border-accent/25" },
                    { label: "OpportunityWriter",  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
                ].map((a, i, arr) => (
                    <div key={a.label} className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${a.color}`}>
                            {a.label}
                        </span>
                        {i < arr.length - 1 && (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                        )}
                    </div>
                ))}
            </div>

            {/* Contenido */}
            {loading ? (
                <div className="grid grid-cols-1 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                            <div className="flex gap-4">
                                <div className="w-14 h-14 rounded-full bg-slate-700/50 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-2/3 rounded bg-slate-700/50" />
                                    <div className="h-3 w-1/2 rounded bg-slate-700/50" />
                                    <div className="h-3 w-full rounded bg-slate-700/50" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="bg-card border border-red-500/20 rounded-2xl p-6 text-center">
                    <p className="text-red-400 text-sm">{error}</p>
                    <button onClick={load} className="mt-3 text-xs text-slate-400 hover:text-slate-200">
                        Reintentar
                    </button>
                </div>
            ) : insights.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-10 text-center">
                    <Bot className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                    <p className="text-slate-400 text-sm font-medium">Los agentes no encontraron oportunidades nuevas</p>
                    <p className="text-slate-600 text-xs mt-1">
                        Haz clic en "Correr Agentes" para analizar las hackatones actuales.
                    </p>
                </div>
            ) : (
                <AnimatePresence>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {insights.map(ins => (
                            <InsightCard key={ins.id} insight={ins} onRead={markRead} />
                        ))}
                    </div>
                </AnimatePresence>
            )}
        </div>
    );
}
