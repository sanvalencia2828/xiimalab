"use client";

import { motion } from "framer-motion";
import { Target } from "lucide-react";
import MarketMatch from "@/components/MarketMatch";

export default function MatchPage() {
    return (
        <div className="p-6 min-h-screen">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-purple-500/15">
                        <Target className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-xs font-medium text-purple-400 uppercase tracking-widest">
                        Análisis IA
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-1">
                    Market <span className="gradient-text">Match</span>
                </h1>
                <p className="text-slate-400 text-sm">
                    Compara tus habilidades con la demanda del mercado · Powered by Claude
                </p>
            </motion.div>

            {/* MarketMatch widget */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="max-w-2xl"
            >
                <MarketMatch />
            </motion.div>
        </div>
    );
}
