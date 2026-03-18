"use client";

import { motion, type Variants } from "framer-motion";
import { Trophy, Tag, Clock, TrendingUp, ExternalLink, Bot, Globe } from "lucide-react";
import type { Hackathon } from "@/lib/types";

// -------------------------------------------------------
// TYPES
// -------------------------------------------------------
interface DoraHacksFeedProps {
    hackathons: Hackathon[];
    showSource?: boolean;
}

// -------------------------------------------------------
// TAG COLOR MAP
// -------------------------------------------------------
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

// -------------------------------------------------------
// MATCH SCORE COLOR
// -------------------------------------------------------
function matchColor(score: number) {
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-sky-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
}

// -------------------------------------------------------
// COMPONENT
// -------------------------------------------------------
const listVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, x: -12 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function DoraHacksFeed({ hackathons, showSource = false }: DoraHacksFeedProps) {
    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Feed header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-500/15">
                        <Bot className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-sm font-semibold text-slate-200">DoraHacks Scraping Bot</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400" />
                    </span>
                    <span className="text-xs text-purple-400 font-medium">Sync en vivo</span>
                </div>
            </div>

            {/* Hackathon list */}
            <motion.ul
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-border"
            >
                {hackathons.map((h) => {
                    const daysLeft = Math.ceil(
                        (new Date(h.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );

                    return (
                        <motion.li
                            key={h.id}
                            variants={itemVariants}
                            whileHover={{ backgroundColor: "rgba(17,24,39,0.8)" }}
                            className="px-5 py-4 group cursor-pointer transition-colors"
                        >
                            {/* Title row */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
                                            {h.title}
                                        </h3>
                                        {/* Source badge */}
                                        {showSource && h.source && (
                                            h.source === "devfolio" ? (
                                                <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                                                    <Globe className="w-2.5 h-2.5" />
                                                    Devfolio
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                                                    <Bot className="w-2.5 h-2.5" />
                                                    DoraHacks
                                                </span>
                                            )
                                        )}
                                    </div>
                                </div>
                                <motion.div
                                    whileHover={{ scale: 1.1 }}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <ExternalLink className="w-3.5 h-3.5 text-accent" />
                                </motion.div>
                            </div>

                            {/* Stats row */}
                            <div className="flex items-center gap-4 mb-3 text-xs">
                                {/* Prize pool */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-amber-400 font-bold">
                                        ${h.prize_pool.toLocaleString()}
                                    </span>
                                    <span className="text-muted-text">Prize Pool</span>
                                </div>

                                {/* Deadline */}
                                <div className="flex items-center gap-1 text-muted-text">
                                    <Clock className="w-3 h-3" />
                                    {daysLeft < 0 ? (
                                        <span className="text-slate-500">Cerrado</span>
                                    ) : daysLeft === 0 ? (
                                        <span className="text-red-400">Hoy</span>
                                    ) : (
                                        <span className={daysLeft <= 14 ? "text-red-400" : "text-muted-text"}>
                                            {daysLeft}d restantes
                                        </span>
                                    )}
                                </div>

                                {/* Match score */}
                                <div className={`flex items-center gap-1 ml-auto font-bold ${matchColor(h.match_score)}`}>
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    <span>{h.match_score}% match</span>
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1.5">
                                {h.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border font-medium ${tagColors[tag] ?? defaultTag
                                            }`}
                                    >
                                        <Tag className="w-2.5 h-2.5" />
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </motion.li>
                    );
                })}
            </motion.ul>

            {/* Footer CTA */}
            <div className="px-5 py-3 border-t border-border bg-background/40">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-xs font-medium text-accent hover:text-accent-bright transition-colors py-1"
                >
                    Ver todos los hackatones →
                </motion.button>
            </div>
        </div>
    );
}
