"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Trophy, Clock, Zap, Target, TrendingUp, AlertCircle,
    ChevronRight, Sparkles, Loader2, BarChart3, Tag, TrendingDown
} from "lucide-react";
import { getPrioritiesAction, MarketInsights, PriorityHackathon, TagInsight } from "@/app/actions/insights";
import { getSkillRelevanceAction, SkillRelevance } from "@/app/actions/market";
import RecommendationBadge from "./RecommendationBadge";

interface Recommendation {
    hackathon_id: string;
    hackathon_title: string;
    matching_skill: string;
    reasoning_phrase: string;
    potential_growth_score: number;
    match_score: number;
}

interface PriorityBoardProps {
    compact?: boolean;
}

export default function PriorityBoard({ compact = false }: PriorityBoardProps) {
    const [insights, setInsights] = useState<MarketInsights | null>(null);
    const [skillRelevance, setSkillRelevance] = useState<SkillRelevance[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [userSkills, setUserSkills] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"priorities" | "tags" | "relevance" | "actions">("priorities");

    useEffect(() => {
        loadInsights();
        loadUserSkills();
    }, []);

    const loadUserSkills = async () => {
        try {
            const savedSkills = localStorage.getItem("user_skills");
            if (savedSkills) {
                const parsed = JSON.parse(savedSkills);
                setUserSkills(parsed.map((s: { name: string }) => s.name));
            }
        } catch {
            setUserSkills(["Python", "JavaScript", "React"]);
        }
    };

    const loadInsights = async () => {
        setLoading(true);
        setError(null);
        
        const [prioritiesResult, relevanceResult] = await Promise.all([
            getPrioritiesAction(30),
            getSkillRelevanceAction(),
        ]);
        
        if ("error" in prioritiesResult) {
            setError(prioritiesResult.error);
        } else {
            setInsights(prioritiesResult.insights);
            
            if (userSkills.length > 0) {
                loadRecommendations(prioritiesResult.insights.prioritized_hackathons);
            }
        }
        
        if (!("error" in relevanceResult) && Array.isArray(relevanceResult.relevance_report)) {
            setSkillRelevance(relevanceResult.relevance_report);
        }
        
        setLoading(false);
    };

    const loadRecommendations = async (hackathons: PriorityHackathon[]) => {
        try {
            const vercelUrl = process.env.VERCEL_URL;
            const base = vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000";
            
            const res = await fetch(
                `${base}/api/learning/recommendations?skills=${encodeURIComponent(userSkills.join(","))}&hackathons=${encodeURIComponent(JSON.stringify(hackathons.map(h => ({
                    id: h.id,
                    title: h.title,
                    tags: h.tags,
                    match_score: h.match_score,
                }))))}`,
                { method: "GET", next: { revalidate: 3600 } }
            );
            
            if (res.ok) {
                const data = await res.json();
                setRecommendations(data.recommendations || []);
            }
        } catch (error) {
            console.error("Error loading recommendations:", error);
        }
    };

    const getRecommendationForHackathon = (hackathonId: string): Recommendation | undefined => {
        return recommendations.find(r => r.hackathon_id === hackathonId);
    };

    const sortedHackathons = useMemo(() => {
        if (!insights?.prioritized_hackathons) return [];
        return [...insights.prioritized_hackathons].sort((a, b) => b.match_score - a.match_score);
    }, [insights]);

    if (loading) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        );
    }

    if (error || !insights) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 text-rose-400 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Error en el análisis de relevancia</span>
                </div>
                <p className="text-xs text-slate-400">{error || "Intenta de nuevo"}</p>
                <button
                    onClick={loadInsights}
                    className="mt-3 px-4 py-2 bg-indigo-500/10 text-indigo-400 text-xs font-bold rounded-lg hover:bg-indigo-500/20 transition-colors"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    if (compact) {
        return <CompactView insights={insights} />;
    }

    return (
        <div className="space-y-4">
            <StatsHeader insights={insights} />

            <div className="flex gap-2 border-b border-border pb-2">
                {[
                    { id: "priorities", label: "Prioridades", icon: Target },
                    { id: "tags", label: "Tags", icon: Tag },
                    { id: "relevance", label: "Relevancia", icon: TrendingUp },
                    { id: "actions", label: "Acciones", icon: Zap },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            activeTab === tab.id
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {activeTab === "priorities" && (
                    <motion.div
                        key="priorities"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                    >
                        {sortedHackathons.map((hack, idx) => (
                            <PriorityCard 
                                key={hack.id} 
                                hackathon={hack} 
                                index={idx}
                                recommendation={getRecommendationForHackathon(hack.id)}
                            />
                        ))}
                    </motion.div>
                )}

                {activeTab === "tags" && (
                    <motion.div
                        key="tags"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <TagAnalysis tags={insights.top_tags} />
                    </motion.div>
                )}

                {activeTab === "relevance" && (
                    <motion.div
                        key="relevance"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                    >
                        {skillRelevance.length > 0 ? (
                            skillRelevance.map((skill, idx) => (
                                <SkillRelevanceCard key={skill.skill} skill={skill} index={idx} />
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-500 text-sm">
                                Cargando análisis de relevancia...
                            </div>
                        )}
                    </motion.div>
                )}

                {activeTab === "actions" && (
                    <motion.div
                        key="actions"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-2"
                    >
                        {insights.recommended_actions.map((action, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="flex items-start gap-3 p-3 bg-gradient-to-r from-accent/5 to-transparent rounded-xl border border-accent/10"
                            >
                                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-accent">{idx + 1}</span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{action}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function StatsHeader({ insights }: { insights: MarketInsights }) {
    const stats = [
        { label: "Hackathons", value: insights.total_hackathons, icon: Trophy, color: "text-amber-400" },
        { label: "Urgentes", value: insights.urgent_hackathons, icon: Clock, color: "text-rose-400" },
        { label: "Premio Promedio", value: `$${(insights.avg_prize_pool / 1000).toFixed(0)}k`, icon: BarChart3, color: "text-emerald-400" },
        { label: "Match Promedio", value: `${insights.avg_match_score}%`, icon: Target, color: "text-purple-400" },
    ];

    return (
        <div className="grid grid-cols-4 gap-3">
            {stats.map((stat) => (
                <div key={stat.label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</span>
                    </div>
                    <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                </div>
            ))}
        </div>
    );
}

interface PriorityCardProps {
    hackathon: PriorityHackathon;
    index: number;
    recommendation?: Recommendation;
}

function PriorityCard({ hackathon, index, recommendation }: PriorityCardProps) {
    const urgencyColor = hackathon.days_until_deadline <= 3 ? "text-rose-400" :
                          hackathon.days_until_deadline <= 7 ? "text-amber-400" : "text-slate-400";
    const urgencyBg = hackathon.days_until_deadline <= 3 ? "bg-rose-500/10 border-rose-500/30" :
                      hackathon.days_until_deadline <= 7 ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-white/10";
    
    const isHighMatch = hackathon.match_score >= 85;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`relative p-4 rounded-xl border overflow-hidden transition-all ${urgencyBg} ${
                isHighMatch ? "ring-2 ring-amber-500/50 ring-offset-2 ring-offset-background" : ""
            }`}
        >
            {isHighMatch && (
                <div className="absolute inset-0 rounded-xl animate-pulse bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 pointer-events-none" />
            )}
            
            {hackathon.days_until_deadline <= 7 && (
                <div className="absolute top-0 right-0 w-16 h-16 opacity-10">
                    <AlertCircle className="w-full h-full text-rose-400" />
                </div>
            )}

            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold text-white truncate">{hackathon.title}</h4>
                        {recommendation && (
                            <RecommendationBadge
                                matchingSkill={recommendation.matching_skill}
                                reasoningPhrase={recommendation.reasoning_phrase}
                                matchScore={hackathon.match_score}
                                size="sm"
                            />
                        )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{hackathon.reasoning}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-lg font-bold ${urgencyColor}`}>
                        {hackathon.total_priority.toFixed(0)}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase">priority</span>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-3">
                <div className={`flex items-center gap-1 text-xs ${urgencyColor}`}>
                    <Clock className="w-3 h-3" />
                    {hackathon.days_until_deadline === 0 ? "Hoy" :
                     hackathon.days_until_deadline === 1 ? "1 día" :
                     `${hackathon.days_until_deadline} días`}
                </div>
                <div className="flex items-center gap-1 text-xs text-amber-400">
                    <Trophy className="w-3 h-3" />
                    ${hackathon.prize_pool.toLocaleString()}
                </div>
                <div className={`flex items-center gap-1 text-xs ${isHighMatch ? "text-amber-400" : "text-purple-400"}`}>
                    <Target className="w-3 h-3" />
                    {hackathon.match_score}%
                </div>
            </div>

            <div className="flex flex-wrap gap-1">
                {hackathon.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[9px] text-slate-400">
                        {tag}
                    </span>
                ))}
                {hackathon.tags.length > 4 && (
                    <span className="px-2 py-0.5 text-[9px] text-slate-500">
                        +{hackathon.tags.length - 4}
                    </span>
                )}
            </div>

            <button className="mt-3 w-full flex items-center justify-center gap-1 py-2 bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold rounded-lg transition-colors">
                Ver Detalles <ChevronRight className="w-3 h-3" />
            </button>
        </motion.div>
    );
}

function TagAnalysis({ tags }: { tags: TagInsight[] }) {
    const maxCount = Math.max(...tags.map(t => t.count), 1);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-xs font-bold text-slate-300">Tags más demandados</span>
            </div>

            {tags.map((tag, idx) => (
                <div key={tag.tag} className="space-y-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center text-[9px] font-bold text-accent">
                                {idx + 1}
                            </span>
                            <span className="text-xs font-medium text-slate-200">{tag.tag}</span>
                            {tag.trend === "rising" && (
                                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] rounded uppercase">
                                    rising
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            <span>{tag.count} hackathons</span>
                            <span className="text-purple-400">avg {tag.avg_match_score}%</span>
                        </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(tag.count / maxCount) * 100}%` }}
                            transition={{ delay: idx * 0.05, duration: 0.5 }}
                            className="h-full bg-gradient-to-r from-accent to-purple-500"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

function SkillRelevanceCard({ skill, index }: { skill: SkillRelevance; index: number }) {
    const scoreColor = skill.score >= 80 ? "text-indigo-400" :
                       skill.score >= 60 ? "text-blue-400" : "text-slate-400";
    
    const barColor = skill.score >= 80 ? "bg-gradient-to-r from-indigo-500 to-blue-500" :
                     skill.score >= 60 ? "bg-gradient-to-r from-blue-500 to-cyan-500" :
                     "bg-gradient-to-r from-slate-500 to-slate-400";

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-indigo-500/20 transition-colors"
        >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-indigo-400">{index + 1}</span>
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-200 truncate">{skill.skill}</span>
                    {skill.trend === "up" ? (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] rounded uppercase">
                            <TrendingUp className="w-2.5 h-2.5" /> up
                        </span>
                    ) : (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-500/10 text-slate-400 text-[8px] rounded uppercase">
                            <TrendingDown className="w-2.5 h-2.5" /> stable
                        </span>
                    )}
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${skill.score}%` }}
                        transition={{ delay: index * 0.05 + 0.1, duration: 0.5 }}
                        className={`h-full ${barColor} rounded-full`}
                    />
                </div>
            </div>

            <div className="flex flex-col items-end shrink-0">
                <span className={`text-lg font-bold ${scoreColor}`}>{skill.score}</span>
                <span className="text-[9px] text-slate-500">relevancia</span>
            </div>
        </motion.div>
    );
}

function CompactView({ insights }: { insights: MarketInsights }) {
    const top3 = insights.prioritized_hackathons.slice(0, 3);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-slate-200">Top Relevancias</span>
                </div>
                {insights.urgent_hackathons > 0 && (
                    <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-full">
                        {insights.urgent_hackathons} urgentes
                    </span>
                )}
            </div>

            {top3.map((hack) => (
                <div key={hack.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{hack.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-500">
                                {hack.days_until_deadline}d
                            </span>
                            <span className="text-[10px] text-amber-400">
                                ${(hack.prize_pool / 1000).toFixed(0)}k
                            </span>
                        </div>
                    </div>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        hack.total_priority >= 70 ? "bg-emerald-500/20 text-emerald-400" :
                        hack.total_priority >= 50 ? "bg-amber-500/20 text-amber-400" :
                        "bg-slate-500/20 text-slate-400"
                    }`}>
                        <span className="text-xs font-bold">{hack.total_priority.toFixed(0)}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
