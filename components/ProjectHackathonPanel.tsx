"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ExternalLink, Trophy, Clock, ChevronRight, Loader2, X } from "lucide-react";
import type { Hackathon } from "@/lib/types";

interface Props {
    projectTitle: string;
    projectStack: string[];
    accentColor?: string;
    onClose: () => void;
}

// Tag → hackathon tags mapping
const STACK_TO_TAGS: Record<string, string[]> = {
    "Next.js":     ["AI/ML", "Web", "Agents", "Open Ended"],
    "TypeScript":  ["AI/ML", "Web", "Agents"],
    "FastAPI":     ["AI/ML", "Agents", "Open Ended"],
    "Python":      ["AI/ML", "Agents", "Quantum"],
    "Docker":      ["AI/ML", "Enterprise"],
    "Supabase":    ["AI/ML", "Web", "Data"],
    "AI/ML":       ["AI/ML", "Agents", "Quantum", "Health"],
    "OpenAI":      ["AI/ML", "Agents"],
    "HTML5":       ["Web", "AI/ML"],
    "JavaScript":  ["Web", "AI/ML"],
    "Solidity":    ["Blockchain", "DeFi", "NFT", "Onchain"],
    "Web3":        ["Blockchain", "Web3", "DeFi", "Base"],
    "Blockchain":  ["Blockchain", "Web3", "DeFi", "Onchain"],
    "OpenCV":      ["AI/ML"],
    "AI":          ["AI/ML", "Agents"],
    "Vercel":      ["Web", "AI/ML"],
    "CSS3":        ["Web"],
};

function daysUntil(deadline: string): number {
    const now = new Date();
    const end = new Date(deadline);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days: number) {
    if (days <= 3)  return "text-rose-400 bg-rose-500/10";
    if (days <= 7)  return "text-amber-400 bg-amber-500/10";
    if (days <= 30) return "text-accent bg-accent/10";
    return "text-slate-400 bg-slate-500/10";
}

export default function ProjectHackathonPanel({ projectTitle, projectStack, accentColor = "#7dd3fc", onClose }: Props) {
    const [hackathons, setHackathons] = useState<Hackathon[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMatches = async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/hackathons");
                if (!res.ok) throw new Error("fetch failed");
                const data: Hackathon[] = await res.json();

                // Build relevant tag set from project stack
                const relevantTags = new Set<string>();
                projectStack.forEach(tech => {
                    (STACK_TO_TAGS[tech] ?? []).forEach(t => relevantTags.add(t.toLowerCase()));
                });

                // Score each hackathon by tag overlap
                const scored = data
                    .map(h => {
                        const hTags = (h.tags ?? []).map((t: string) => t.toLowerCase());
                        const overlap = hTags.filter(t => relevantTags.has(t)).length;
                        const days = daysUntil(h.deadline);
                        const urgencyBonus = days > 0 && days <= 14 ? 20 : 0;
                        return { ...h, _score: overlap * 15 + urgencyBonus + (h.match_score ?? 0) / 5 };
                    })
                    .filter(h => h._score > 0 && daysUntil(h.deadline) > 0)
                    .sort((a, b) => b._score - a._score)
                    .slice(0, 5);

                setHackathons(scored);
            } catch {
                setHackathons([]);
            } finally {
                setLoading(false);
            }
        };
        fetchMatches();
    }, [projectTitle, projectStack]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-80 shrink-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col"
            style={{ borderColor: `${accentColor}30` }}
        >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between"
                 style={{ background: `${accentColor}08` }}>
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" style={{ color: accentColor }} />
                    <span className="text-sm font-bold text-white">Aplica con este proyecto</span>
                </div>
                <motion.button
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                    <X className="w-4 h-4" />
                </motion.button>
            </div>

            {/* Project badge */}
            <div className="px-4 py-2 border-b border-border/50">
                <span className="text-xs text-slate-500">Hackatones recomendados para </span>
                <span className="text-xs font-semibold" style={{ color: accentColor }}>{projectTitle}</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 animate-spin text-accent" />
                    </div>
                ) : hackathons.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                        No hay hackatones relevantes activos
                    </div>
                ) : (
                    hackathons.map((h, i) => {
                        const days = daysUntil(h.deadline);
                        const urgency = urgencyColor(days);
                        return (
                            <motion.a
                                key={h.id}
                                href={h.source_url ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.07 }}
                                whileHover={{ x: 3 }}
                                className="flex flex-col gap-1.5 p-3 rounded-xl border border-border/60 hover:border-accent/30 bg-background/50 hover:bg-accent/5 transition-all cursor-pointer group"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-xs font-semibold text-white leading-tight line-clamp-2 flex-1">
                                        {h.title}
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-accent shrink-0 mt-0.5 transition-colors" />
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    {h.prize_pool > 0 && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                                            <Trophy className="w-3 h-3" />
                                            ${h.prize_pool.toLocaleString()}
                                        </span>
                                    )}
                                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${urgency}`}>
                                        <Clock className="w-2.5 h-2.5" />
                                        {days <= 0 ? "Cerrado" : days === 1 ? "¡Mañana!" : `${days}d`}
                                    </span>
                                    <span className="text-[10px] text-slate-500 capitalize">{h.source}</span>
                                </div>

                                <div className="flex gap-1 flex-wrap">
                                    {(h.tags ?? []).slice(0, 3).map((t: string) => (
                                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent/80">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </motion.a>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border/50">
                <a href="/hackathons" className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-accent transition-colors">
                    <ExternalLink className="w-3 h-3" />
                    Ver todos los hackatones
                </a>
            </div>
        </motion.div>
    );
}
