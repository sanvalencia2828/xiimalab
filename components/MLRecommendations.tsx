"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Brain, Sparkles, TrendingUp, AlertTriangle, CheckCircle2,
    ChevronRight, Target, Zap, BookOpen, Users, Loader2,
    ExternalLink, ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import { getMLRecommendations, MLRecommendation, MLRecommendationsResponse } from "@/app/actions/mlRecommendations";

interface MLRecommendationsProps {
    walletAddress?: string;
}

const RISK_COLORS = {
    critical: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    high: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    medium: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

const RISK_LABELS = {
    critical: "Crítico",
    high: "Alto",
    medium: "Medio",
    low: "Bajo",
};

export default function MLRecommendations({ walletAddress }: MLRecommendationsProps) {
    const [data, setData] = useState<MLRecommendationsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (walletAddress) {
            loadRecommendations();
        } else {
            setLoading(false);
        }
    }, [walletAddress]);

    const loadRecommendations = async () => {
        if (!walletAddress) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const result = await getMLRecommendations(walletAddress, 5);
            setData(result);
        } catch (err) {
            setError("Error cargando recomendaciones");
        } finally {
            setLoading(false);
        }
    };

    if (!walletAddress) {
        return (
            <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <Brain className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-bold text-white">ML Recommendations</h3>
                </div>
                <p className="text-sm text-slate-400">
                    Conecta tu wallet para ver recomendaciones personalizadas
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <Brain className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-bold text-white">ML Recommendations</h3>
                </div>
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-accent animate-spin" />
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <Brain className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-bold text-white">ML Recommendations</h3>
                </div>
                <p className="text-sm text-rose-400">{error || "Sin datos"}</p>
            </div>
        );
    }

    const { recommendations, user_profile_summary, market_opportunities } = data;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">ML Recommendations</h3>
                        <p className="text-xs text-slate-500">Basado en tu perfil neuropsicológico</p>
                    </div>
                </div>
                <span className="text-xs text-slate-500">{data.model_used}</span>
            </div>

            {/* Market Overview */}
            {market_opportunities.active_hackathons > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-white">{market_opportunities.active_hackathons}</p>
                        <p className="text-[10px] text-slate-500">Activos</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-amber-400">{market_opportunities.urgent_count}</p>
                        <p className="text-[10px] text-slate-500">Urgentes</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-emerald-400">{market_opportunities.high_value_count}</p>
                        <p className="text-[10px] text-slate-500">Alto valor</p>
                    </div>
                </div>
            )}

            {/* User Profile Summary */}
            <div className="bg-gradient-to-r from-accent/10 to-purple-500/10 rounded-xl p-3 border border-accent/20">
                <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-accent" />
                    <span className="text-xs font-medium text-slate-300">Tu perfil</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-slate-400">
                        {user_profile_summary.skills_count} skills
                    </span>
                    <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-accent">
                        {user_profile_summary.neuroplasticity}% neuroplasticidad
                    </span>
                    {user_profile_summary.top_skills.slice(0, 3).map((skill) => (
                        <span key={skill} className="px-2 py-0.5 bg-emerald-500/10 rounded text-[10px] text-emerald-400">
                            {skill}
                        </span>
                    ))}
                </div>
            </div>

            {/* Recommendations List */}
            <AnimatePresence mode="popLayout">
                {recommendations.length > 0 ? (
                    <div className="space-y-3">
                        {recommendations.map((rec, idx) => (
                            <RecommendationCard key={rec.hackathon_id} recommendation={rec} index={idx} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 bg-white/5 rounded-xl">
                        <Target className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No hay recomendaciones disponibles</p>
                        <p className="text-xs text-slate-500">Los datos se actualizan periódicamente</p>
                    </div>
                )}
            </AnimatePresence>

            {/* View All */}
            <Link
                href="/hackathons"
                className="flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-colors"
            >
                <span className="text-sm text-slate-400">Ver todos los hackathons</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
            </Link>
        </div>
    );
}

function RecommendationCard({ recommendation, index }: { recommendation: MLRecommendation; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const riskClass = RISK_COLORS[recommendation.risk_level as keyof typeof RISK_COLORS] || RISK_COLORS.medium;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/5 border border-white/5 rounded-xl overflow-hidden hover:border-accent/30 transition-colors"
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 text-left"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-accent">#{index + 1}</span>
                            <h4 className="text-sm font-bold text-white truncate">{recommendation.title}</h4>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{recommendation.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${riskClass}`}>
                            <span>{Math.round(recommendation.score)}%</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <TrendingUp className="w-3 h-3" />
                        <span>${Math.round(recommendation.potential_reward)} potencial</span>
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] ${recommendation.risk_level === 'low' ? 'text-emerald-400' : recommendation.risk_level === 'high' ? 'text-amber-400' : 'text-slate-500'}`}>
                        <AlertTriangle className="w-3 h-3" />
                        <span>{RISK_LABELS[recommendation.risk_level as keyof typeof RISK_LABELS]}</span>
                    </div>
                </div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-white/5"
                    >
                        <div className="p-4 space-y-3">
                            {/* Skill Gaps */}
                            {recommendation.skill_gaps.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="text-xs font-medium text-slate-300">Skill gaps</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {recommendation.skill_gaps.map((gap) => (
                                            <span key={gap} className="px-2 py-0.5 bg-amber-500/10 rounded text-[10px] text-amber-400">
                                                {gap}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Team Fit */}
                            <div className="flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 text-purple-400" />
                                <span className="text-xs text-slate-400">{recommendation.team_fit}</span>
                            </div>

                            {/* Learning Potential */}
                            <div className="flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs text-slate-400">{recommendation.learning_potential}</span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2">
                                <Link
                                    href={`/hackathons/${recommendation.hackathon_id}`}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors"
                                >
                                    <span className="text-xs font-medium text-accent">Ver hackathon</span>
                                    <ArrowUpRight className="w-3 h-3 text-accent" />
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
