"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    Brain, Target, TrendingUp, Trophy, Zap, Clock, TrendingDown,
    ChevronRight, Flame, BarChart3, BookOpen, AlertCircle,
    Wallet, Loader2, Plus, Award,
    CheckCircle2, ArrowUpRight, ExternalLink, GraduationCap
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import PriorityBoard from "@/components/PriorityBoard";
import NotificationBell from "@/components/NotificationBell";
import BestMatchHero from "@/components/BestMatchHero";
import { loadUserSkillsAction } from "@/app/actions/userSkills";
import { getSkillRelevanceAction, SkillRelevance } from "@/app/actions/market";
import type { MarketTrend } from "@/lib/types";

interface Skill {
    name: string;
    level: number;
    category: string;
}

interface DashboardStats {
    totalHackathons: number;
    urgentHackathons: number;
    avgMatchScore: number;
    skillsCount: number;
    neuroplasticity: number;
    pendingNotifications: number;
}

export default function UnifiedDashboard() {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        totalHackathons: 0,
        urgentHackathons: 0,
        avgMatchScore: 0,
        skillsCount: 0,
        neuroplasticity: 0,
        pendingNotifications: 0,
    });

    useEffect(() => {
        initializeDashboard();
    }, []);

    const initializeDashboard = async () => {
        setLoading(true);
        
        // Load wallet
        const savedWallet = localStorage.getItem("stellar_pubkey");
        if (savedWallet) {
            setWalletAddress(savedWallet);
            
            // Load skills from PostgreSQL via API
            const result = await loadUserSkillsAction(savedWallet);
            if (result.skills && result.skills.length > 0) {
                setSkills(result.skills.map((s: any) => ({
                    name: s.name,
                    level: s.level,
                    category: s.category,
                })));
            }
        }

        // Load from localStorage as fallback
        const savedSkills = localStorage.getItem("user_skills");
        if (savedSkills && skills.length === 0) {
            setSkills(JSON.parse(savedSkills));
        } else if (!savedWallet && skills.length === 0) {
            const defaults = [
                { name: "Python", level: 65, category: "technical" },
                { name: "JavaScript", level: 70, category: "technical" },
                { name: "React", level: 55, category: "technical" },
            ];
            setSkills(defaults);
        }

        // Load cached stats
        const savedStats = localStorage.getItem("dashboard_stats");
        if (savedStats) {
            setStats(JSON.parse(savedStats));
        } else {
            // Default stats
            setStats({
                totalHackathons: 12,
                urgentHackathons: 3,
                avgMatchScore: 68,
                skillsCount: skills.length || 3,
                neuroplasticity: 0.72,
                pendingNotifications: 0,
            });
        }

        setLoading(false);
    };

    // Sync localStorage with API data
    useEffect(() => {
        if (skills.length > 0) {
            localStorage.setItem("user_skills", JSON.stringify(skills));
        }
    }, [skills]);

    const avgSkillLevel = skills.length > 0 
        ? Math.round(skills.reduce((a, s) => a + s.level, 0) / skills.length) 
        : 0;

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-2xl card-premium flex items-center justify-center pulse-glow">
                        <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    </div>
                    <p className="text-sm text-slate-400">Cargando tu inteligencia...</p>
                    <div className="mt-4 flex justify-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-pulse" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-pulse" style={{ animationDelay: '200ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-pulse" style={{ animationDelay: '400ms' }} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                
                {/* Header */}
                <DashboardHeader 
                    walletAddress={walletAddress}
                    stats={stats}
                />

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Column - Priority & Actions */}
                    <div className="lg:col-span-2 space-y-6">
                        <BestMatchHero />
                        <HackathonsSection />
                        <QuickActionsSection />
                    </div>

                    {/* Right Column - Profile & Skills */}
                    <div className="space-y-6">
                        <ProfileSection 
                            skillsCount={skills.length}
                            avgSkillLevel={avgSkillLevel}
                            neuroplasticity={stats.neuroplasticity}
                        />
                        <SkillsOverview skills={skills} />
                        <MarketOverview />
                    </div>
                </div>
            </div>
        </div>
    );
}

function DashboardHeader({ 
    walletAddress, 
    stats 
}: { 
    walletAddress: string | null;
    stats: DashboardStats;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
        >
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <Image
                        src="/Xiima-logo.png"
                        alt="Xiimalab Logo"
                        width={40}
                        height={40}
                        className="rounded-xl"
                    />
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            Xiima<span className="gradient-text">Hub</span>
                        </h1>
                        <p className="text-xs text-slate-500">Tu inteligencia personal de IA</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Stats badges */}
                <div className="hidden md:flex items-center gap-3">
                    <StatBadge 
                        icon={Trophy} 
                        value={stats.urgentHackathons} 
                        label="Urgentes" 
                        color="text-rose-400"
                    />
                    <StatBadge 
                        icon={Target} 
                        value={`${stats.avgMatchScore}%`} 
                        label="Match" 
                        color="text-accent"
                    />
                    <StatBadge 
                        icon={Brain} 
                        value={`${Math.round(stats.neuroplasticity * 100)}%`} 
                        label="Plasticidad" 
                        color="text-purple-400"
                    />
                </div>

                {/* Wallet */}
                {walletAddress ? (
                    <div className="flex items-center gap-2 px-3 py-2 card-premium rounded-xl">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-mono text-slate-300">
                            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        </span>
                    </div>
                ) : (
                    <Link
                        href="/settings"
                        className="btn-primary flex items-center gap-2"
                    >
                        <Wallet className="w-4 h-4" />
                        <span className="text-xs font-medium">Conectar</span>
                    </Link>
                )}

                {/* Notification Bell */}
                <NotificationBell walletAddress={walletAddress || undefined} />
            </div>
        </motion.div>
    );
}

function StatBadge({ icon: Icon, value, label, color }: { icon: any; value: string | number; label: string; color: string }) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 card-premium rounded-xl hover:glow-accent transition-all duration-300">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className={`text-sm font-bold ${color}`}>{value}</span>
            <span className="text-[10px] text-slate-500">{label}</span>
        </div>
    );
}

function HackathonsSection() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-premium p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-amber-400" />
                    </div>
                    <h2 className="text-lg font-bold text-white">Misiones Activas</h2>
                </div>
                <Link
                    href="/hackathons"
                    className="btn-ghost flex items-center gap-1 text-xs text-accent"
                >
                    Ver todos <ChevronRight className="w-3 h-3" />
                </Link>
            </div>
            <PriorityBoard />
        </motion.div>
    );
}

function QuickActionsSection() {
    const actions = [
        { icon: Plus, label: "Agregar Skill", href: "/skills", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
        { icon: Target, label: "Ver Roles", href: "/skills", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
        { icon: Brain, label: "Mi Perfil", href: "/profile", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
        { icon: Award, label: "Logros", href: "/profile", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-premium p-5"
        >
            <h3 className="section-label mb-4">Acciones Rápidas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {actions.map((action, idx) => (
                    <motion.div
                        key={action.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + idx * 0.05 }}
                    >
                        <Link
                            href={action.href}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${action.bg} hover:scale-[1.03] hover:shadow-lg transition-all duration-200 group`}
                        >
                            <action.icon className={`w-6 h-6 ${action.color} group-hover:scale-110 transition-transform`} />
                            <span className="text-xs font-medium text-slate-300 group-hover:text-white text-center">
                                {action.label}
                            </span>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

function ProfileSection({ 
    skillsCount, 
    avgSkillLevel,
    neuroplasticity 
}: { 
    skillsCount: number;
    avgSkillLevel: number;
    neuroplasticity: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="card-glow p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-accent" />
                    <h3 className="text-sm font-bold text-white">Tu Neuro Perfil</h3>
                </div>
                <Link
                    href="/profile"
                    className="text-xs text-accent hover:text-accent-bright transition-colors"
                >
                    Editar
                </Link>
            </div>

            {/* Neuroplasticity */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Neuroplasticidad</span>
                    <span className="text-lg font-bold text-accent">
                        {Math.round((neuroplasticity || 0.72) * 100)}%
                    </span>
                </div>
                <div className="progress-track">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(neuroplasticity || 0.72) * 100}%` }}
                        transition={{ delay: 0.3, duration: 1 }}
                        className="progress-fill bg-gradient-to-r from-accent to-purple-500"
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="card-premium rounded-xl p-3 text-center">
                    <p className="stat-number text-purple-400">{skillsCount}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Skills</p>
                </div>
                <div className="card-premium rounded-xl p-3 text-center">
                    <p className="stat-number text-blue-400">{avgSkillLevel}%</p>
                    <p className="text-[10px] text-slate-500 mt-1">Nivel Avg</p>
                </div>
            </div>

            {/* Dominant Category */}
            <div className="mt-4 p-3 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-400">Categoría dominante</span>
                </div>
                <p className="text-sm font-bold text-emerald-400 mt-1">Ejecutivo</p>
            </div>
        </motion.div>
    );
}

function SkillsOverview({ skills }: { skills: Skill[] }) {
    const sortedSkills = [...skills].sort((a, b) => b.level - a.level).slice(0, 5);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="card-premium p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Top Skills</h3>
                </div>
                <Link
                    href="/skills"
                    className="text-xs text-accent hover:text-accent-bright transition-colors"
                >
                    Ver más
                </Link>
            </div>

            <div className="space-y-3">
                {sortedSkills.map((skill, idx) => (
                    <div key={skill.name}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-300">{skill.name}</span>
                            <span className={`text-xs font-bold ${
                                skill.level >= 70 ? "text-emerald-400" :
                                skill.level >= 40 ? "text-amber-400" : "text-slate-400"
                            }`}>
                                {skill.level}%
                            </span>
                        </div>
                        <div className="progress-track">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${skill.level}%` }}
                                transition={{ delay: 0.1 + idx * 0.05, duration: 0.5 }}
                                className={`progress-fill ${
                                    skill.level >= 70 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                                    skill.level >= 40 ? "bg-gradient-to-r from-amber-500 to-amber-400" : "bg-slate-500"
                                }`}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <Link
                href="/skills"
                className="btn-ghost mt-4 flex items-center justify-center gap-2 py-2"
            >
                <Plus className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-400">Agregar skill</span>
            </Link>
        </motion.div>
    );
}

interface SkillGap {
    skill: string;
    relevance: number;
    userLevel: number;
    gap: number;
    trend: "up" | "stable";
    priority: "high" | "medium" | "low";
    recommendedAction: string;
}

function MarketOverview() {
    const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

    useEffect(() => {
        fetchSkillAnalysis();
    }, []);

    const fetchSkillAnalysis = async () => {
        try {
            const [relevanceResult, userSkillsResult] = await Promise.all([
                getSkillRelevanceAction(),
                loadUserSkillsAction(localStorage.getItem("stellar_pubkey") || "")
            ]);

            if ("error" in relevanceResult || !Array.isArray(relevanceResult?.relevance_report)) {
                setSkillGaps(getFallbackGaps());
                setLoading(false);
                return;
            }

            const userSkills = userSkillsResult?.skills ?? [];
            const userSkillMap = new Map<string, number>();
            userSkills.forEach((s: { name: string; level: number }) => {
                userSkillMap.set(s.name.toLowerCase(), s.level);
            });

            const gaps: SkillGap[] = relevanceResult.relevance_report.slice(0, 6).map((r: SkillRelevance) => {
                let userLevel = 0;
                const skillLower = r.skill.toLowerCase();
                
                userSkillMap.forEach((level, name) => {
                    if ((name.includes(skillLower) || skillLower.includes(name)) && userLevel === 0) {
                        userLevel = level;
                    }
                });

                const gap = Math.max(0, r.score - userLevel);
                
                let priority: "high" | "medium" | "low" = "medium";
                if (r.trend === "up" && gap > 30) priority = "high";
                else if (gap < 15) priority = "low";

                let recommendedAction = "Mantén tu nivel actual";
                if (gap > 50) {
                    recommendedAction = "Curso intensivo recomendado";
                } else if (gap > 30) {
                    recommendedAction = "Practica y mejora";
                } else if (gap > 15) {
                    recommendedAction = "Refuerza con ejercicios";
                } else if (gap > 0) {
                    recommendedAction = "微 aprendizaje";
                }

                return {
                    skill: r.skill,
                    relevance: r.score,
                    userLevel,
                    gap,
                    trend: r.trend,
                    priority,
                    recommendedAction,
                };
            });

            setSkillGaps(gaps.sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }));
        } catch (error) {
            console.error("Error fetching skill analysis:", error);
            setSkillGaps(getFallbackGaps());
        } finally {
            setLoading(false);
        }
    };

    const getFallbackGaps = (): SkillGap[] => [
        { skill: "AI/ML", relevance: 83, userLevel: 45, gap: 38, trend: "up", priority: "high", recommendedAction: "Curso intensivo recomendado" },
        { skill: "DeFi", relevance: 67, userLevel: 30, gap: 37, trend: "stable", priority: "high", recommendedAction: "Practica y mejora" },
        { skill: "Blockchain", relevance: 60, userLevel: 25, gap: 35, trend: "stable", priority: "high", recommendedAction: "Practica y mejora" },
        { skill: "Social Good", relevance: 60, userLevel: 50, gap: 10, trend: "stable", priority: "low", recommendedAction: "微 aprendizaje" },
        { skill: "Web3", relevance: 50, userLevel: 20, gap: 30, trend: "stable", priority: "medium", recommendedAction: "Refuerza con ejercicios" },
        { skill: "Open Ended", relevance: 53, userLevel: 35, gap: 18, trend: "stable", priority: "medium", recommendedAction: "Refuerza con ejercicios" },
    ];

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high": return "text-rose-400 bg-rose-500/10 border-rose-500/30";
            case "medium": return "text-amber-400 bg-amber-500/10 border-amber-500/30";
            default: return "text-slate-400 bg-slate-500/10 border-slate-500/30";
        }
    };

    const getGapBarColor = (gap: number) => {
        if (gap > 50) return "bg-gradient-to-r from-rose-500 to-red-500";
        if (gap > 30) return "bg-gradient-to-r from-amber-500 to-orange-500";
        return "bg-gradient-to-r from-emerald-500 to-teal-500";
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="card-premium p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Mercado en Alza</h3>
                </div>
                <Link
                    href="/skills"
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                    <BookOpen className="w-3 h-3" />
                    Ver plan
                </Link>
            </div>

            {loading ? (
                <div className="flex justify-center p-4">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                </div>
            ) : (
                <div className="space-y-3">
                    {skillGaps.map((item, idx) => (
                        <motion.div
                            key={item.skill}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                expandedSkill === item.skill 
                                    ? "bg-indigo-500/10 border-indigo-500/30" 
                                    : "bg-white/5 border-white/5 hover:border-indigo-500/20"
                            }`}
                            onClick={() => setExpandedSkill(expandedSkill === item.skill ? null : item.skill)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-slate-200">{item.skill}</span>
                                    {item.trend === "up" ? (
                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] rounded">
                                            <TrendingUp className="w-2.5 h-2.5" /> up
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-500/10 text-slate-400 text-[8px] rounded">
                                            <TrendingDown className="w-2.5 h-2.5" /> stable
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getPriorityColor(item.priority)}`}>
                                    {item.priority === "high" ? "Urgente" : item.priority === "medium" ? "Medio" : "Bajo"}
                                </span>
                            </div>

                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex-1">
                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                        <span>Tu nivel: {item.userLevel}%</span>
                                        <span>Relevancia: {item.relevance}%</span>
                                    </div>
                                    <div className="progress-track">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${item.userLevel}%` }}
                                            transition={{ delay: idx * 0.05 + 0.1, duration: 0.5 }}
                                            className="progress-fill bg-gradient-to-r from-purple-500 to-indigo-400"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500">Brecha:</span>
                                    <span className={`text-xs font-bold ${
                                        item.gap > 30 ? "text-rose-400" : item.gap > 15 ? "text-amber-400" : "text-emerald-400"
                                    }`}>
                                        {item.gap}%
                                    </span>
                                </div>
                                {item.gap > 15 && (
                                    <Link
                                        href={`/skills?skill=${encodeURIComponent(item.skill)}`}
                                        className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <GraduationCap className="w-3 h-3" />
                                        {item.recommendedAction}
                                    </Link>
                                )}
                            </div>

                            {expandedSkill === item.skill && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 pt-3 border-t border-white/10"
                                >
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs text-slate-300 mb-2">{item.recommendedAction}</p>
                                            <Link
                                                href={`/learning?skill=${encodeURIComponent(item.skill)}&target=${item.relevance}`}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-medium rounded-lg transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <BookOpen className="w-3 h-3" />
                                                Encontrar cursos
                                                <ArrowUpRight className="w-3 h-3" />
                                            </Link>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            {skillGaps.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">
                            {skillGaps.filter(s => s.priority === "high").length} skills requieren atención
                        </span>
                        <Link
                            href="/learning"
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                        >
                            Plan de aprendizaje
                            <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
