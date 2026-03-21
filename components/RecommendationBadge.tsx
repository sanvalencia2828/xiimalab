"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface RecommendationBadgeProps {
    matchingSkill?: string;
    reasoningPhrase?: string;
    matchScore?: number;
    size?: "sm" | "md" | "lg";
}

export default function RecommendationBadge({
    matchingSkill,
    reasoningPhrase,
    matchScore = 0,
    size = "md",
}: RecommendationBadgeProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    if (!matchingSkill) {
        return null;
    }

    const sizeClasses = {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
    };

    const iconSizes = {
        sm: "w-3 h-3",
        md: "w-3.5 h-3.5",
        lg: "w-4 h-4",
    };

    const isHighMatch = matchScore >= 85;

    return (
        <div className="relative inline-block">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={`
                    inline-flex items-center gap-1.5 rounded-full
                    font-semibold cursor-pointer
                    transition-all duration-200
                    ${sizeClasses[size]}
                    ${isHighMatch 
                        ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300" 
                        : "bg-indigo-500/15 border border-indigo-500/30 text-indigo-300"
                    }
                `}
            >
                <Sparkles className={`${iconSizes[size]} ${isHighMatch ? "text-amber-400" : "text-indigo-400"}`} />
                <span>Match por {matchingSkill}</span>
            </motion.div>

            <AnimatePresence>
                {showTooltip && reasoningPhrase && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="
                            absolute z-50 left-0 bottom-full mb-2
                            w-64 p-3 rounded-xl
                            bg-slate-900/95 backdrop-blur-xl
                            border border-white/10
                            shadow-2xl shadow-black/50
                        "
                    >
                        <div className="flex items-start gap-2">
                            <Sparkles className={`w-4 h-4 ${isHighMatch ? "text-amber-400" : "text-indigo-400"} shrink-0 mt-0.5`} />
                            <p className="text-xs text-slate-300 leading-relaxed">
                                {reasoningPhrase}
                            </p>
                        </div>
                        <div className="absolute left-4 -bottom-1.5 w-3 h-3 rotate-45 bg-slate-900/95 border-b border-r border-white/10" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
