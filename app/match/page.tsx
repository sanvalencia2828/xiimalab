"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Sparkles, TrendingUp, Award, Zap, Code, Shield, Loader2 } from "lucide-react";
import MarketMatch from "@/components/MarketMatch";
import type { MarketTrend } from "@/lib/types";

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

// Mapeo dinámico de íconos y colores según palabras clave
const getStyleForTrend = (role: string, idx: number) => {
    const r = role.toLowerCase();
    if (r.includes("ai") || r.includes("data")) return { icon: BrainCircuit, accent: "#a78bfa", bg: "bg-purple-500/10", border: "border-purple-500/20", tagColor: "text-purple-400 bg-purple-500/10 border-purple-500/20" };
    if (r.includes("blockchain") || r.includes("web3")) return { icon: Shield, accent: "#f59e0b", bg: "bg-amber-500/10", border: "border-amber-500/20", tagColor: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
    if (r.includes("design") || r.includes("creative")) return { icon: Sparkles, accent: "#ec4899", bg: "bg-pink-500/10", border: "border-pink-500/20", tagColor: "text-pink-400 bg-pink-500/10 border-pink-500/20" };
    if (r.includes("manager") || r.includes("product")) return { icon: Zap, accent: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/20", tagColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
    return { icon: Code, accent: "#3b82f6", bg: "bg-blue-500/10", border: "border-blue-500/20", tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
};

export default function MatchPage() {
    const [liveTrends, setLiveTrends] = useState<MarketTrend[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrends = async () => {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const res = await fetch(`${API_URL}/api/v1/market/trends`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.trends && data.trends.length > 0) {
                        setLiveTrends(data.trends.slice(0, 4));
                    } else {
                        setLiveTrends([{ role_name: "Web3 Developer", demand_score: 95 }, { role_name: "AI Engineer", demand_score: 90 }, { role_name: "Data Analyst", demand_score: 80 }]);
                    }
                } else {
                    setLiveTrends([{ role_name: "Web3 Developer", demand_score: 95 }, { role_name: "AI Engineer", demand_score: 90 }, { role_name: "Data Analyst", demand_score: 80 }]);
                }
            } catch (err) {
                console.warn("Failed to fetch live trends, using fallbacks:", err);
                setLiveTrends([{ role_name: "Web3 Developer", demand_score: 95 }, { role_name: "AI Engineer", demand_score: 90 }, { role_name: "Data Analyst", demand_score: 80 }]);
            } finally {
                setLoading(false);
            }
        };
        fetchTrends();
    }, []);

    return (
        <div className="p-6 min-h-screen relative overflow-hidden">
            {/* Ambient Background Graphic */}
            <div 
              className="absolute top-0 right-0 w-full h-[600px] opacity-10 pointer-events-none mix-blend-screen"
              style={{ backgroundImage: 'url(/assets/market-match-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', maskImage: 'linear-gradient(to bottom, black, transparent)' }}
            />
            
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8 relative z-10"
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
                            Análisis de habilidades vs demanda dinámica en tiempo real
                        </p>
                    </div>
                    <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,139,250,0.2)]">
                        <Sparkles className="w-3.5 h-3.5" />
                        Live API Sync
                    </span>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 relative z-10">
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
                    {/* Componente MarketMatch Interno Mantenido intacto */}
                    <div className="bg-card/60 backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl p-1">
                        <MarketMatch />
                    </div>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-accent/10">
                            <Zap className="w-4 h-4 text-accent" />
                        </div>
                        <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                            Oportunidades en Alza Live
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center p-12 bg-card/40 border border-border rounded-2xl backdrop-blur-sm">
                            <Loader2 className="w-8 h-8 text-accent animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {liveTrends.map((trend, idx) => {
                                const style = getStyleForTrend(trend.role_name, idx);
                                const Icon = style.icon;
                                return (
                                    <motion.div
                                        key={trend.role_name}
                                        variants={itemVariants}
                                        whileHover={{ y: -2, scale: 1.01, transition: { duration: 0.2 } }}
                                        className={`relative bg-card/60 backdrop-blur-md border ${style.border} rounded-2xl p-5 overflow-hidden cursor-default shadow-lg`}
                                    >
                                        {/* Glow effect on top border */}
                                        <div
                                            className="absolute top-0 left-0 right-0 h-[2px] opacity-70"
                                            style={{
                                                background: `linear-gradient(90deg, transparent, ${style.accent}, transparent)`,
                                            }}
                                        />
                                        <div className="flex items-start gap-4 z-10 relative">
                                            <div className={`p-2.5 rounded-xl ${style.bg} border ${style.border} shrink-0 shadow-inner`}>
                                                <Icon className="w-5 h-5" style={{ color: style.accent }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h3 className="text-sm font-bold text-white tracking-wide">
                                                        {trend.role_name}
                                                    </h3>
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shadow-sm ${style.tagColor}`}>
                                                        {trend.growth_percentage}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-300 leading-relaxed mt-2 opacity-90">
                                                    Palabras clave solicitadas: <span className="text-white font-medium">{trend.top_projects_keywords?.join(" • ") || "N/A"}</span>.
                                                    <br/>Demanda actual: <span style={{color: style.accent}} className="font-bold">{trend.demand_score}/100</span>.
                                                </p>
                                            </div>
                                        </div>
                                        {/* Background subtle gradient for depth */}
                                        <div className="absolute -bottom-10 -right-10 w-32 h-32 blur-3xl opacity-20 rounded-full pointer-events-none" style={{ backgroundColor: style.accent }} />
                                    </motion.div>
                                );
                            })}
                            {liveTrends.length === 0 && !loading && (
                                <p className="text-xs text-slate-400">No se encontraron tendencias vivas. Por favor sincroniza el mercado en la página de inicio.</p>
                            )}
                        </div>
                    )}

                    <motion.p
                        variants={itemVariants}
                        className="mt-5 text-[11px] text-slate-500 leading-relaxed px-1 font-mono uppercase tracking-wider"
                    >
                        Las recomendaciones mostradas arriba se auto-sincronizan con el módulo IA de Market Scout.
                    </motion.p>
                </motion.div>
            </div>
        </div>
    );
}
