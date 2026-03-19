"use client";

import { motion } from "framer-motion";
import { BrainCircuit, Sparkles, TrendingUp, Award, Zap } from "lucide-react";
import MarketMatch from "@/components/MarketMatch";

const recommendations = [
    {
        icon: BrainCircuit,
        title: "Completa AI / ML",
        description: "PyTorch y LLMs son el gap más rentable. Dominarlos sube tu match score un ~25% en convocatorias de IA.",
        accent: "#a78bfa",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
        tag: "Alta prioridad",
        tagColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
    {
        icon: Award,
        title: "Certifica Blockchain",
        description: "Avalanche + Stellar abren grants de $10k+. Tu certificado Stellar Impacta ya es ventaja — falta el de Avalanche Academy.",
        accent: "#f59e0b",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        tag: "Grant disponible",
        tagColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
    {
        icon: Zap,
        title: "Conecta Devfolio",
        description: "Tu perfil está listo para aplicar a hackatones activos. El scraper MCP ya está corriendo — revisa /hackatones.",
        accent: "#7dd3fc",
        bg: "bg-accent/10",
        border: "border-accent/20",
        tag: "Acción inmediata",
        tagColor: "text-accent bg-accent/10 border-accent/20",
    },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.2 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function MatchPage() {
    return (
        <div className="p-6 min-h-screen">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-xs font-medium text-purple-400 uppercase tracking-widest">
                        Inteligencia de Mercado
                    </span>
                </div>
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">
                            Market{" "}
                            <span className="gradient-text">Match</span>
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Análisis de habilidades vs demanda del mercado · Powered by Claude 3.5
                        </p>
                    </div>
                    <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Sparkles className="w-3.5 h-3.5" />
                        Claude 3.5 · Live Analysis
                    </span>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-purple-500/15">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                            Habilidades vs. Mercado
                        </span>
                    </div>
                    <MarketMatch />
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-accent/10">
                            <Sparkles className="w-4 h-4 text-accent" />
                        </div>
                        <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                            Próximas Recomendaciones
                        </span>
                    </div>

                    <div className="space-y-4">
                        {recommendations.map((rec, idx) => {
                            const Icon = rec.icon;
                            return (
                                <motion.div
                                    key={rec.title}
                                    variants={itemVariants}
                                    whileHover={{ y: -2, transition: { duration: 0.2 } }}
                                    className={`relative bg-card border ${rec.border} rounded-2xl p-5 overflow-hidden cursor-default`}
                                >
                                    <div
                                        className="absolute top-0 left-0 right-0 h-px opacity-50"
                                        style={{
                                            background: `linear-gradient(90deg, transparent, ${rec.accent}80, transparent)`,
                                        }}
                                    />
                                    <div className="flex items-start gap-4">
                                        <div
                                            className={`p-2.5 rounded-xl ${rec.bg} border ${rec.border} shrink-0`}
                                        >
                                            <Icon className="w-5 h-5" style={{ color: rec.accent }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <h3 className="text-sm font-bold text-white">
                                                    {rec.title}
                                                </h3>
                                                <span
                                                    className={`text-xs font-medium px-2 py-0.5 rounded-full border ${rec.tagColor}`}
                                                >
                                                    {rec.tag}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                {rec.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-4 right-4 text-xs font-bold text-slate-600">
                                        0{idx + 1}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    <motion.p
                        variants={itemVariants}
                        className="mt-5 text-xs text-slate-500 leading-relaxed px-1"
                    >
                        Las recomendaciones se actualizan con cada análisis de Claude 3.5.
                        Haz click en{" "}
                        <span className="text-purple-400 font-medium">IA</span> en cualquier
                        habilidad para ver el análisis completo.
                    </motion.p>
                </motion.div>
            </div>
        </div>
    );
}
