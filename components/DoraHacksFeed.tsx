"use client";

import { motion, type Variants } from "framer-motion";
import { Trophy, Tag, Clock, TrendingUp, ExternalLink, Bot, Globe, Zap } from "lucide-react";

export interface Hackathon {
    id: string;
    title: string;
    prizePool: number;
    tags: string[];
    deadline: string;
    matchScore: number;
    source?: string;
    url?: string;
    strategic_category?: string;
}

interface DoraHacksFeedProps {
    hackathons: Hackathon[];
    showSource?: boolean;
}

const tagColors: Record<string, string> = {
    Stellar: "bg-violet-500/15 text-violet-300 border-violet-500/25",
    Avalanche: "bg-red-500/15 text-red-300 border-red-500/25",
    DeFi: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    NFT: "bg-pink-500/15 text-pink-300 border-pink-500/25",
    AI: "bg-sky-500/15 text-sky-300 border-sky-500/25",
    Web3: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    Python: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    Blockchain: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
    "Smart Contracts": "bg-purple-500/15 text-purple-300 border-purple-500/25",
    "Cross-chain": "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
    Innovation: "bg-orange-500/15 text-orange-300 border-orange-500/25",
    "Open Track": "bg-teal-500/15 text-teal-300 border-teal-500/25",
};
const defaultTag = "bg-slate-700/50 text-slate-300 border-slate-600/30";

function matchColor(score: number) {
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-sky-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
}

function matchBg(score: number) {
    if (score >= 90) return "bg-emerald-500/10 border-emerald-500/20";
    if (score >= 75) return "bg-sky-500/10 border-sky-500/20";
    if (score >= 60) return "bg-amber-500/10 border-amber-500/20";
    return "bg-red-500/10 border-red-500/20";
}

const listVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, x: -12 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function DoraHacksFeed({ hackathons, showSource = false }: DoraHacksFeedProps) {
    const strategicHackathons = hackathons.filter(h => h.strategic_category === "Strategic Prize");
    const careerHackathons = hackathons.filter(h => h.strategic_category === "Skill Builder");
    const otherHackathons = hackathons.filter(h => !h.strategic_category || h.strategic_category === "Network Opportunity");

    const renderHackathonItem = (h: Hackathon) => {
        const daysLeft = Math.ceil(
            (new Date(h.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        const isHighMatch = h.matchScore >= 85;

        return (
            <motion.li
                key={h.id}
                variants={itemVariants}
                whileHover={{ backgroundColor: "rgba(17,24,39,0.8)" }}
                className={`px-5 py-4 group cursor-pointer transition-all relative ${isHighMatch ? "bg-accent/5" : ""}`}
            >
                {isHighMatch && (
                    <div className="absolute inset-0 bg-accent/5 blur-xl pointer-events-none -z-10 group-hover:bg-accent/10 transition-colors" />
                )}

                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            {isHighMatch ? (
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
                            ) : (
                                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
                                {h.title}
                            </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            {showSource && h.source && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border backdrop-blur-md ${
                                    h.source === "devfolio" 
                                    ? "bg-blue-500/10 text-blue-300 border-blue-500/20" 
                                    : "bg-purple-500/10 text-purple-300 border-purple-500/20"
                                }`}>
                                    <Globe className="w-2.5 h-2.5" />
                                    {h.source.charAt(0).toUpperCase() + h.source.slice(1)}
                                </span>
                            )}
                            {h.strategic_category && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border backdrop-blur-md ${
                                    h.strategic_category === "Strategic Prize"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                    : h.strategic_category === "Skill Builder"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                                }`}>
                                    <Zap className="w-2.5 h-2.5" />
                                    {h.strategic_category}
                                </span>
                            )}
                        </div>
                    </div>
                    <motion.a
                        href={h.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        className={`shrink-0 transition-opacity ${h.url ? "opacity-0 group-hover:opacity-100" : "opacity-0"}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink className="w-3.5 h-3.5 text-accent" />
                    </motion.a>
                </div>

                <div className="flex items-center gap-4 mb-3 text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="text-amber-400 font-bold">
                            ${h.prizePool.toLocaleString()}
                        </span>
                        <span className="text-muted-text">Prize</span>
                    </div>

                    <div className="flex items-center gap-1 text-muted-text">
                        <Clock className="w-3 h-3" />
                        <span className={daysLeft <= 14 ? "text-red-400" : "text-muted-text"}>
                            {daysLeft}d
                        </span>
                    </div>

                    <div className={`flex items-center gap-1 ml-auto font-bold ${matchColor(h.matchScore)}`}>
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>{h.matchScore}%</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {h.tags.map((tag) => (
                        <span
                            key={tag}
                            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${tagColors[tag] ?? defaultTag}`}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </motion.li>
        );
    };

    return (
        <div className="bg-card/50 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-purple-500/5 to-transparent">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/20">
                        <Bot className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-sm font-bold text-slate-100">Smart Match Intelligence</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Live AI Sync</span>
                </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                <motion.ul variants={listVariants} initial="hidden" animate="visible" className="divide-y divide-border">
                    {strategicHackathons.length > 0 && (
                        <>
                            <div className="px-5 py-2 bg-emerald-500/5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest border-y border-emerald-500/10">
                                🚀 Oportunidades Estratégicas
                            </div>
                            {strategicHackathons.map(renderHackathonItem)}
                        </>
                    )}

                    {careerHackathons.length > 0 && (
                        <>
                            <div className="px-5 py-2 bg-amber-500/5 text-amber-400 text-[10px] font-bold uppercase tracking-widest border-y border-amber-500/10">
                                📈 Crecimiento de Perfil
                            </div>
                            {careerHackathons.map(renderHackathonItem)}
                        </>
                    )}

                    {(otherHackathons.length > 0 || (strategicHackathons.length === 0 && careerHackathons.length === 0)) && (
                        <>
                            <div className="px-5 py-2 bg-slate-500/5 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-y border-slate-500/10">
                                Recientes & Otros
                            </div>
                            {otherHackathons.map(renderHackathonItem)}
                        </>
                    )}
                </motion.ul>
            </div>

            <div className="px-5 py-3 border-t border-border bg-black/40">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-xs font-bold text-accent hover:text-white transition-all py-1.5 rounded-lg border border-accent/20 hover:bg-accent/10"
                >
                    Explorar All Intelligence →
                </motion.button>
            </div>
        </div>
    );
}
