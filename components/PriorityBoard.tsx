"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Trophy, Clock, Zap, Target, TrendingUp, AlertCircle,
    ChevronRight, Sparkles, Loader2, BarChart3, Tag, TrendingDown, BookOpen, ExternalLink
} from "lucide-react";
import { getPrioritiesAction, MarketInsights, PriorityHackathon, TagInsight, SkillRelevance } from "@/app/actions/insights";
import { getSkillRelevanceAction, SkillRelevance as MarketSkillRelevance } from "@/app/actions/market";
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
    const [skillRelevance, setSkillRelevance] = useState<MarketSkillRelevance[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [userSkills, setUserSkills] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"priorities" | "skills" | "relevance" | "actions">("priorities");

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
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    <p className="text-xs text-slate-500">Analizando hackatones…</p>
                </div>
            </div>
        );
    }

    if (error || !insights) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 text-rose-400 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Error cargando datos</span>
                </div>
                <p className="text-xs text-slate-400">{error ?? "Intenta de nuevo"}</p>
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

    const tabs = [
        { id: "priorities" as const, label: "Misiones", icon: Target },
        { id: "skills" as const,     label: "Skills clave", icon: BookOpen },
        { id: "relevance" as const,  label: "Relevancia", icon: TrendingUp },
        { id: "actions" as const,    label: "Acciones",  icon: Zap },
    ];

    return (
        <div className="space-y-4">
            <StatsHeader insights={insights} />

            <div className="flex gap-2 border-b border-border pb-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
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

                {activeTab === "skills" && (
                    <motion.div key="skills" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <SkillRelevancePanel
                            skills={insights.skill_relevance ?? []}
                            total={insights.total_hackathons}
                        />
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
                    <motion.div key="actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2">
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

// ── Skill Relevance Panel ────────────────────────────────────────────────────
function SkillRelevancePanel({ skills, total }: { skills: SkillRelevance[]; total: number }) {
    const maxPrize = Math.max(...skills.map(s => s.prize_coverage), 1);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-accent" />
                <span className="text-xs font-bold text-slate-200">Skills más valiosas del mercado</span>
                <span className="ml-auto text-[10px] text-slate-500">Analizando {total} hackatones</span>
            </div>

            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                Ranking por cobertura de premios — cuánto dinero total puedes ganar con cada skill en las convocatorias activas.
            </p>

            {skills.map((s, idx) => (
                <motion.div
                    key={s.skill}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="space-y-1.5"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${
                                idx === 0 ? "bg-amber-500/20 text-amber-400" :
                                idx === 1 ? "bg-slate-400/20 text-slate-300" :
                                idx === 2 ? "bg-orange-800/30 text-orange-400" :
                                "bg-accent/10 text-accent"
                            }`}>
                                {idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-200">{s.skill}</span>
                            <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-[9px] rounded">
                                {s.percentage}% de hackatones
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                            <span className="text-amber-400 font-bold">
                                ${(s.prize_coverage / 1000).toFixed(0)}k en premios
                            </span>
                            <span className="text-slate-500">{s.hackathon_count} convoc.</span>
                        </div>
                    </div>

                    {/* Prize coverage bar */}
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(s.prize_coverage / maxPrize) * 100}%` }}
                            transition={{ delay: idx * 0.04 + 0.1, duration: 0.6, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                                idx === 0 ? "bg-gradient-to-r from-amber-400 to-yellow-300" :
                                idx === 1 ? "bg-gradient-to-r from-slate-400 to-slate-300" :
                                idx === 2 ? "bg-gradient-to-r from-orange-600 to-orange-400" :
                                "bg-gradient-to-r from-accent to-purple-500"
                            }`}
                        />
                    </div>

                    {s.top_hackathon && (
                        <p className="text-[10px] text-slate-600 pl-7 truncate">
                            Mejor oportunidad: <span className="text-slate-400">{s.top_hackathon}</span>
                        </p>
                    )}
                </motion.div>
            ))}
        </div>
    );
}

// ── Stats Header ─────────────────────────────────────────────────────────────
function StatsHeader({ insights }: { insights: MarketInsights }) {
    const stats = [
        { label: "Activos",         value: insights.total_hackathons,                              icon: Trophy,   color: "text-amber-400" },
        { label: "Urgentes",        value: insights.urgent_hackathons,                             icon: Clock,    color: "text-rose-400" },
        { label: "Premio prom.",    value: `$${(insights.avg_prize_pool / 1000).toFixed(0)}k`,     icon: BarChart3, color: "text-emerald-400" },
        { label: "Match prom.",     value: `${insights.avg_match_score}%`,                         icon: Target,   color: "text-purple-400" },
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
    const isUrgent = hackathon.days_until_deadline <= 3;
    const isHot    = hackathon.days_until_deadline <= 7;

    const urgencyColor = isUrgent ? "text-rose-400" : isHot ? "text-amber-400" : "text-slate-400";
    const urgencyBg    = isUrgent ? "bg-rose-500/10 border-rose-500/30" :
                         isHot    ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-white/10";
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

            {isHot && (
                <div className="absolute top-0 right-0 w-14 h-14 opacity-10">
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
                        {hackathon.total_priority}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase">score</span>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-3">
                <div className={`flex items-center gap-1 text-xs ${urgencyColor}`}>
                    <Clock className="w-3 h-3" />
                    {hackathon.days_until_deadline === 0 ? "Hoy" :
                     hackathon.days_until_deadline === 1 ? "1 día" :
                     `${hackathon.days_until_deadline}d`}
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

            <div className="flex flex-wrap gap-1 mb-3">
                {hackathon.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[9px] text-slate-400">{tag}</span>
                ))}
                {hackathon.tags.length > 4 && (
                    <span className="px-2 py-0.5 text-[9px] text-slate-500">+{hackathon.tags.length - 4}</span>
                )}
            </div>

            {hackathon.source_url && (
                <a
                    href={hackathon.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-1 py-2 bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold rounded-lg transition-colors"
                >
                    Aplicar <ExternalLink className="w-3 h-3" />
                </a>
            )}
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

function SkillRelevanceCard({ skill, index }: { skill: MarketSkillRelevance; index: number }) {
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

// ── Compact View ──────────────────────────────────────────────────────────────
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
                            <span className="text-[10px] text-slate-500">{hack.days_until_deadline}d</span>
                            <span className="text-[10px] text-amber-400">${(hack.prize_pool / 1000).toFixed(0)}k</span>
                        </div>
                    </div>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        hack.total_priority >= 70 ? "bg-emerald-500/20 text-emerald-400" :
                        hack.total_priority >= 50 ? "bg-amber-500/20 text-amber-400" :
                        "bg-slate-500/20 text-slate-400"
                    }`}>
                        <span className="text-xs font-bold">{hack.total_priority}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
