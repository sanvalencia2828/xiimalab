"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Trophy, Tag, Clock, TrendingUp, ExternalLink,
    Bot, Globe, Send, CheckCircle2, Loader2,
} from "lucide-react";
import type { ActiveHackathon } from "@/lib/supabase";

// ─────────────────────────────────────────────
// Tag color map
// ─────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
    stellar:          "bg-violet-500/15 text-violet-300 border-violet-500/25",
    avalanche:        "bg-red-500/15 text-red-300 border-red-500/25",
    defi:             "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    nft:              "bg-pink-500/15 text-pink-300 border-pink-500/25",
    ai:               "bg-sky-500/15 text-sky-300 border-sky-500/25",
    ml:               "bg-sky-500/15 text-sky-300 border-sky-500/25",
    web3:             "bg-amber-500/15 text-amber-300 border-amber-500/25",
    python:           "bg-blue-500/15 text-blue-300 border-blue-500/25",
    blockchain:       "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
    "smart contracts":"bg-purple-500/15 text-purple-300 border-purple-500/25",
    rust:             "bg-orange-500/15 text-orange-300 border-orange-500/25",
    typescript:       "bg-blue-600/15 text-blue-300 border-blue-600/30",
    react:            "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
    docker:           "bg-sky-600/15 text-sky-300 border-sky-600/25",
    data:             "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
};
const TAG_DEFAULT = "bg-slate-700/50 text-slate-300 border-slate-600/30";

function tagColor(tag: string): string {
    return TAG_COLORS[tag.toLowerCase()] ?? TAG_DEFAULT;
}

function matchColor(score: number): string {
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-sky-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
}

// ─────────────────────────────────────────────
// Días restantes — suppressHydrationWarning
// evita mismatch de timezone server vs cliente
// ─────────────────────────────────────────────
function DaysLeft({ deadline }: { deadline: string }) {
    if (!deadline) return <span className="text-slate-500">Sin fecha</span>;
    const days = Math.ceil(
        (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days < 0)  return <span className="text-slate-500">Cerrado</span>;
    if (days === 0) return <span className="text-red-400 font-semibold">Hoy</span>;
    return (
        <span className={days <= 14 ? "text-red-400" : "text-muted-text"}>
            {days}d restantes
        </span>
    );
}

// ─────────────────────────────────────────────
// Source badge
// ─────────────────────────────────────────────
function SourceBadge({ source }: { source: string }) {
    const configs: Record<string, { icon: typeof Bot; label: string; className: string }> = {
        devfolio:  { icon: Globe, label: "Devfolio",  className: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
        dorahacks: { icon: Bot,  label: "DoraHacks", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
        devpost:   { icon: Trophy, label: "Devpost", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    };
    const cfg = configs[source.toLowerCase()] ?? configs.devpost;
    const Icon = cfg.icon;
    return (
        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border shrink-0 ${cfg.className}`}>
            <Icon className="w-2.5 h-2.5" />
            {cfg.label}
        </span>
    );
}

// ─────────────────────────────────────────────
// Apply button — estado interno de React
// ─────────────────────────────────────────────
type ApplyState = "idle" | "loading" | "applied";

function ApplyButton({ hackathonId, sourceUrl }: { hackathonId: string; sourceUrl: string | null }) {
    const [state, setState] = useState<ApplyState>("idle");

    const handleApply = async () => {
        if (state !== "idle") return;
        setState("loading");
        try {
            const res = await fetch("/api/hackathons/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hackathon_id: hackathonId }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setState("applied");
            if (sourceUrl) window.open(sourceUrl, "_blank", "noopener noreferrer");
        } catch (err) {
            console.error("[ApplyButton]", err);
            setState("idle"); // reset so user can retry
        }
    };

    return (
        <motion.button
            whileHover={state === "idle" ? { scale: 1.03 } : {}}
            whileTap={state === "idle" ? { scale: 0.97 } : {}}
            onClick={handleApply}
            disabled={state !== "idle"}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                state === "applied"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 cursor-default"
                    : state === "loading"
                    ? "bg-accent/10 text-accent border-accent/20 cursor-not-allowed opacity-70"
                    : "bg-accent/10 text-accent border-accent/30 hover:bg-accent/20"
            }`}
        >
            {state === "applied" ? (
                <><CheckCircle2 className="w-3 h-3" /> ¡Aplicaste!</>
            ) : state === "loading" ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Aplicando...</>
            ) : (
                <><Send className="w-3 h-3" /> Aplicar</>
            )}
        </motion.button>
    );
}

// ─────────────────────────────────────────────
// HackathonCard — componente principal
// ─────────────────────────────────────────────
export interface HackathonCardProps {
    hackathon: ActiveHackathon;
}

export default function HackathonCard({ hackathon: h }: HackathonCardProps) {
    const tags = Array.isArray(h.tags) ? h.tags : [];

    return (
        <motion.div
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="bg-card border border-border rounded-2xl p-5 group relative overflow-hidden"
        >
            {/* Top glow line según match score */}
            <div
                className={`absolute top-0 left-0 right-0 h-[2px] opacity-60 ${h.match_score >= 90 ? 'animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.8)]' : ''}`}
                style={{
                    background: h.match_score >= 90
                        ? "linear-gradient(90deg, transparent, #10b981, transparent)"
                        : h.match_score >= 75
                            ? "linear-gradient(90deg, transparent, #38bdf8, transparent)"
                            : "linear-gradient(90deg, transparent, #f59e0b40, transparent)",
                }}
            />
            {h.match_score >= 90 && (
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
            )}

            {/* Title row */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors leading-snug">
                            {h.title}
                        </h3>
                    </div>
                    <SourceBadge source={h.source} />
                </div>
                {h.source_url && (
                    <a
                        href={h.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                        <ExternalLink className="w-3.5 h-3.5 text-accent" />
                    </a>
                )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mb-3 text-xs">
                <div className="flex items-center gap-1.5">
                    <span className="text-amber-400 font-bold">
                        ${(h.prize_pool ?? 0).toLocaleString()}
                    </span>
                    <span className="text-muted-text">Prize Pool</span>
                </div>

                <div className="flex items-center gap-1 text-muted-text">
                    <Clock className="w-3 h-3" />
                    {/* suppressHydrationWarning: timezone server ≠ cliente */}
                    <span suppressHydrationWarning>
                        <DaysLeft deadline={h.deadline} />
                    </span>
                </div>

                <div className={`flex items-center gap-1 ml-auto font-bold ${matchColor(h.match_score)}`}>
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{h.match_score}% match</span>
                </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {tags.slice(0, 5).map((tag) => (
                        <span
                            key={tag}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border font-medium ${tagColor(tag)}`}
                        >
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                        </span>
                    ))}
                    {tags.length > 5 && (
                        <span className="text-xs text-slate-500 self-center">+{tags.length - 5}</span>
                    )}
                </div>
            )}

            {/* Apply button */}
            <div className="flex justify-end">
                <ApplyButton hackathonId={h.id} sourceUrl={h.source_url} />
            </div>
        </motion.div>
    );
}
