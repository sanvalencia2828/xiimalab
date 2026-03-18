"use client";

/**
 * HackatonesTable.tsx
 * Vista tabla para /hackatones — datos en tiempo real desde Devfolio MCP + DoraHacks + Devpost
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ExternalLink, Trophy, TrendingUp, Tag, Clock,
    ChevronUp, ChevronDown, Loader2, CheckCircle2, Send,
    Globe, Bot, Zap, AlertCircle,
} from "lucide-react";
import type { ActiveHackathon } from "@/lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────
type SortKey = "title" | "prize_pool" | "match_score" | "deadline" | "source";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────

const SOURCE_CFG: Record<string, { label: string; className: string; dot: string }> = {
    devfolio:  { label: "Devfolio",  className: "bg-sky-500/10 text-sky-400 border-sky-500/25",      dot: "bg-sky-400" },
    dorahacks: { label: "DoraHacks", className: "bg-purple-500/10 text-purple-400 border-purple-500/25", dot: "bg-purple-400" },
    devpost:   { label: "Devpost",   className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-400" },
};
function sourceCfg(s: string) { return SOURCE_CFG[s.toLowerCase()] ?? SOURCE_CFG.devpost; }

function matchColor(score: number) {
    if (score >= 85) return "text-emerald-400";
    if (score >= 70) return "text-sky-400";
    if (score >= 55) return "text-amber-400";
    return "text-slate-400";
}

function MatchBar({ score }: { score: number }) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                        score >= 85 ? "bg-emerald-400" :
                        score >= 70 ? "bg-sky-400" :
                        score >= 55 ? "bg-amber-400" : "bg-slate-500"
                    }`}
                />
            </div>
            <span className={`text-xs font-bold w-8 text-right ${matchColor(score)}`}>
                {score}%
            </span>
        </div>
    );
}

function DaysLeft({ deadline }: { deadline: string }) {
    if (!deadline) return <span className="text-slate-500 text-xs">–</span>;
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    if (days < 0)   return <span className="text-slate-500 text-xs">Cerrado</span>;
    if (days === 0) return <span className="text-red-400 text-xs font-semibold">Hoy</span>;
    return (
        <span className={`text-xs ${days <= 14 ? "text-red-400" : "text-slate-400"}`}>
            {days}d
        </span>
    );
}

type ApplyState = "idle" | "loading" | "applied";
function ApplyBtn({ id, url }: { id: string; url: string | null }) {
    const [st, setSt] = useState<ApplyState>("idle");
    const handle = async () => {
        if (st !== "idle") return;
        setSt("loading");
        await new Promise(r => setTimeout(r, 800));
        setSt("applied");
        if (url) window.open(url, "_blank", "noopener noreferrer");
    };
    return (
        <motion.button
            whileHover={st === "idle" ? { scale: 1.04 } : {}}
            whileTap={st === "idle" ? { scale: 0.96 } : {}}
            onClick={handle}
            disabled={st !== "idle"}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap ${
                st === "applied"  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 cursor-default" :
                st === "loading"  ? "bg-accent/10 text-accent border-accent/20 opacity-70 cursor-not-allowed" :
                                    "bg-accent/10 text-accent border-accent/30 hover:bg-accent/20"
            }`}
        >
            {st === "applied" ? <><CheckCircle2 className="w-3 h-3" />¡Listo!</>
            : st === "loading" ? <><Loader2 className="w-3 h-3 animate-spin" />...</>
            : <><Send className="w-3 h-3" />Aplicar</>}
        </motion.button>
    );
}

// ── Sort helper ───────────────────────────────────────────────────
function sortData(data: ActiveHackathon[], key: SortKey, dir: SortDir) {
    return [...data].sort((a, b) => {
        let va: any = a[key as keyof ActiveHackathon] ?? "";
        let vb: any = b[key as keyof ActiveHackathon] ?? "";
        if (key === "deadline") {
            va = va ? new Date(va).getTime() : Infinity;
            vb = vb ? new Date(vb).getTime() : Infinity;
        }
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va < vb) return dir === "asc" ? -1 : 1;
        if (va > vb) return dir === "asc" ? 1 : -1;
        return 0;
    });
}

// ── Columnas ──────────────────────────────────────────────────────
interface ColDef {
    key: SortKey;
    label: string;
    className?: string;
    sortable?: boolean;
}

const COLUMNS: ColDef[] = [
    { key: "title",      label: "Hackatón",   className: "min-w-[200px]",  sortable: true },
    { key: "source",     label: "Fuente",     className: "w-28",           sortable: true },
    { key: "prize_pool", label: "Premio",     className: "w-28 text-right",sortable: true },
    { key: "match_score",label: "Match",      className: "w-32",           sortable: true },
    { key: "deadline",   label: "Cierre",     className: "w-20 text-right",sortable: true },
];

// ── Componente principal ──────────────────────────────────────────
export interface HackatonesTableProps {
    data:       ActiveHackathon[];
    isLoading?: boolean;
    error?:     string | null;
}

export default function HackatonesTable({ data, isLoading, error }: HackatonesTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("match_score");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const sorted = sortData(data, sortKey, sortDir);

    // ── Loading ─────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Cargando datos del MCP...</p>
                </div>
            </div>
        );
    }

    // ── Error ───────────────────────────────────────────────
    if (error) {
        return (
            <div className="bg-card border border-red-500/20 rounded-2xl p-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-red-400 text-sm font-medium">Error cargando Devfolio MCP</p>
                    <p className="text-slate-500 text-xs mt-1">{error}</p>
                </div>
            </div>
        );
    }

    // ── Empty ───────────────────────────────────────────────
    if (!data.length) {
        return (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Zap className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400 text-sm">Sin datos en este momento</p>
                <p className="text-slate-600 text-xs mt-1">El SNAP Engine actualizará pronto.</p>
            </div>
        );
    }

    // ── Tabla ───────────────────────────────────────────────
    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Sticky header */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-border bg-slate-900/60">
                            {COLUMNS.map(col => (
                                <th
                                    key={col.key}
                                    onClick={() => col.sortable && toggleSort(col.key)}
                                    className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider select-none ${
                                        col.sortable ? "cursor-pointer hover:text-slate-200 transition-colors" : ""
                                    } ${col.className ?? ""}`}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {col.sortable && sortKey === col.key && (
                                            sortDir === "asc"
                                                ? <ChevronUp className="w-3.5 h-3.5 text-accent" />
                                                : <ChevronDown className="w-3.5 h-3.5 text-accent" />
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className="px-4 py-3 w-24 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Acción
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-border/50">
                        <AnimatePresence initial={false}>
                            {sorted.map((h, i) => {
                                const cfg  = sourceCfg(h.source);
                                const tags = Array.isArray(h.tags) ? h.tags.slice(0, 3) : [];

                                return (
                                    <motion.tr
                                        key={h.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: i * 0.03, duration: 0.25 }}
                                        className="hover:bg-slate-800/40 transition-colors group"
                                    >
                                        {/* Hackatón */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-start gap-2.5">
                                                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-medium text-slate-100 group-hover:text-white transition-colors leading-snug line-clamp-1">
                                                            {h.title}
                                                        </span>
                                                        {h.source_url && (
                                                            <a
                                                                href={h.source_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                            >
                                                                <ExternalLink className="w-3 h-3 text-accent" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    {tags.length > 0 && (
                                                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                            {tags.map(tag => (
                                                                <span
                                                                    key={tag}
                                                                    className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 border border-slate-700/50"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                            {(Array.isArray(h.tags) ? h.tags.length : 0) > 3 && (
                                                                <span className="text-xs text-slate-600">
                                                                    +{h.tags.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Fuente */}
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border ${cfg.className}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                        </td>

                                        {/* Premio */}
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-amber-400 font-bold text-sm">
                                                ${(h.prize_pool ?? 0).toLocaleString()}
                                            </span>
                                        </td>

                                        {/* Match */}
                                        <td className="px-4 py-3">
                                            <MatchBar score={h.match_score ?? 0} />
                                        </td>

                                        {/* Cierre */}
                                        <td className="px-4 py-3 text-right" suppressHydrationWarning>
                                            <DaysLeft deadline={h.deadline} />
                                        </td>

                                        {/* Acción */}
                                        <td className="px-4 py-3 text-right">
                                            <ApplyBtn id={h.id} url={h.source_url} />
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border/50 bg-slate-900/30 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                    {sorted.length} hackatones
                </span>
                <div className="flex items-center gap-3">
                    {Object.entries(SOURCE_CFG).map(([src, cfg]) => {
                        const count = data.filter(h => h.source === src).length;
                        if (!count) return null;
                        return (
                            <span key={src} className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}: {count}
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
