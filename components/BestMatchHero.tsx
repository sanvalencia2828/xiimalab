"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Loader2, Trophy, Target } from "lucide-react";
import Link from "next/link";

interface Hackathon {
    id: string;
    title: string;
    match_score: number;
    prize_pool: number;
    deadline: string;
    tags: string[];
}

interface BestMatchHeroProps {
    hackathons?: Hackathon[];
}

export default function BestMatchHero({ hackathons: propHackathons }: BestMatchHeroProps) {
    const [bestMatch, setBestMatch] = useState<Hackathon | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const findBestMatch = async () => {
            if (propHackathons && propHackathons.length > 0) {
                const sorted = [...propHackathons].sort((a, b) => b.match_score - a.match_score);
                setBestMatch(sorted[0]);
                setLoading(false);
                return;
            }

            try {
                const res = await fetch("/api/insights/priorities?days_window=90", {
                    cache: "no-store",
                });
                
                if (res.ok) {
                    const data = await res.json();
                    const hacks: Hackathon[] = data?.insights?.prioritized_hackathons ?? [];
                    
                    if (hacks.length > 0) {
                        const sorted = hacks.sort((a, b) => b.match_score - a.match_score);
                        setBestMatch(sorted[0]);
                    }
                }
            } catch (error) {
                console.error("Error fetching best match:", error);
            } finally {
                setLoading(false);
            }
        };

        findBestMatch();
    }, [propHackathons]);

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden card-glow p-6"
            >
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <div className="w-10 h-10 rounded-xl card-premium flex items-center justify-center pulse-glow">
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    </div>
                    <span className="text-sm text-slate-400">Analizando nuevas oportunidades para ti...</span>
                    <div className="w-40 progress-track mt-1">
                        <div className="progress-fill bg-gradient-to-r from-indigo-500 to-purple-500 w-1/2 shimmer-bg" />
                    </div>
                </div>
            </motion.div>
        );
    }

    if (!bestMatch) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden card-premium p-6"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 card-premium rounded-xl">
                        <Sparkles className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-300 font-medium">Sin coincidencias aún</p>
                        <p className="text-xs text-slate-500">Completa tu perfil para ver matches</p>
                    </div>
                </div>
            </motion.div>
        );
    }

    const daysLeft = Math.max(0, Math.ceil(
        (new Date(bestMatch.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl"
        >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/30 via-purple-600/20 to-indigo-600/10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent" />
            
            {/* Animated border glow */}
            <div className="absolute inset-[1px] rounded-2xl bg-slate-900/90 backdrop-blur-xl" />
            
            {/* Content */}
            <div className="relative p-6">
                {/* Header badge */}
                <div className="flex items-center gap-2 mb-4">
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                            ¡Tu mejor Match!
                        </span>
                    </span>
                </div>

                {/* Main content */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        {/* Match score badge */}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
                                <Target className="w-4 h-4 text-emerald-400" />
                                <span className="text-lg font-bold text-emerald-400">
                                    {bestMatch.match_score}%
                                </span>
                            </div>
                            {bestMatch.prize_pool > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                    <span>${(bestMatch.prize_pool / 1000).toFixed(0)}k</span>
                                </div>
                            )}
                            <div className="text-xs text-slate-500">
                                {daysLeft === 0 ? "Cierra hoy" : `${daysLeft}d restantes`}
                            </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg md:text-xl font-bold text-white mb-2 line-clamp-2">
                            {bestMatch.title}
                        </h3>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5">
                            {bestMatch.tags?.slice(0, 4).map((tag) => (
                                <span
                                    key={tag}
                                    className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-slate-400"
                                >
                                    {tag}
                                </span>
                            ))}
                            {bestMatch.tags?.length > 4 && (
                                <span className="px-2 py-0.5 text-[10px] text-slate-500">
                                    +{bestMatch.tags.length - 4}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* CTA Button */}
                    <div className="shrink-0">
                        <Link
                            href={`/hackathons?id=${bestMatch.id}`}
                            className="btn-primary group flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-sm text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105"
                        >
                            Ir al desafío
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
