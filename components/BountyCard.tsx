"use client";

import { motion } from "framer-motion";
import { BadgeCheck, Clock, Coins, ExternalLink, Send, TrendingUp } from "lucide-react";
import { type Bounty, describeCountdown, formatReward } from "@/lib/bounties/parse";

interface BountyCardProps {
    bounty: Bounty;
    index?: number;
}

const matchColor = (score: number) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-sky-400";
    if (score >= 60) return "text-amber-400";
    return "text-slate-400";
};

/** Tarjeta de un bounty de Superteam Earn, con el mismo estilo que las de hackatones. */
export function BountyCard({ bounty, index = 0 }: BountyCardProps) {
    const countdown = describeCountdown(bounty.deadline);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 12) * 0.05, duration: 0.3, ease: "easeOut" }}
            className="group"
        >
            <div className="card-premium transition-all duration-300 p-5 hover:!border-accent/30 h-full flex flex-col">
                {/* Sponsor + título */}
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-800/60 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                        {bounty.sponsor.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- logos de hosts externos variables
                            <img src={bounty.sponsor.logo} alt="" loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-sm font-bold text-slate-400">{bounty.sponsor.name.charAt(0)}</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-200 line-clamp-2 group-hover:text-accent transition-colors">
                            {bounty.title}
                        </h3>
                        <p className="text-xs text-muted-text mt-1 flex items-center gap-1">
                            <span className="truncate">{bounty.sponsor.name}</span>
                            {bounty.sponsor.isVerified && (
                                <BadgeCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-label="Sponsor verificado" />
                            )}
                        </p>
                    </div>
                </div>

                {/* Recompensa + cierre + envíos + match */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                        <Coins className="w-3.5 h-3.5 text-yellow-500" />
                        <span>{formatReward(bounty)}</span>
                    </div>
                    <div
                        className={`flex items-center gap-1.5 font-medium ${countdown.urgent ? "text-red-400" : "text-muted-text"}`}
                        suppressHydrationWarning
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span suppressHydrationWarning>{countdown.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-text">
                        <Send className="w-3.5 h-3.5" />
                        <span>{bounty.submissions} {bounty.submissions === 1 ? "envío" : "envíos"}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${matchColor(bounty.matchScore)}`}>
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>{bounty.matchScore}% match</span>
                    </div>
                </div>

                {/* Pie */}
                <div className="flex items-center justify-between gap-3 pt-4 mt-auto border-t border-border">
                    <div className="flex items-center gap-1.5">
                        <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-md border border-purple-500/30">
                            Superteam Earn
                        </span>
                        {bounty.isDev && (
                            <span className="px-2 py-1 bg-sky-500/10 text-sky-300 text-xs rounded-md border border-sky-500/20">Dev</span>
                        )}
                        {bounty.type !== "bounty" && (
                            <span className="px-2 py-1 bg-slate-700/30 text-slate-300 text-xs rounded-md border border-slate-600/30 capitalize">
                                {bounty.type}
                            </span>
                        )}
                    </div>
                    <a
                        href={bounty.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-accent/10 text-accent border-accent/20 hover:bg-accent/20 transition-all"
                    >
                        Ver bounty
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>
        </motion.div>
    );
}
