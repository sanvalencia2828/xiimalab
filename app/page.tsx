"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    Brain, Target, TrendingUp, Trophy, Zap, Clock,
    ChevronRight, Flame, BarChart3,
    Wallet, Loader2, Plus, Award,
    CheckCircle2, ArrowUpRight, ExternalLink
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import PriorityBoard from "@/components/PriorityBoard";
import NotificationBell from "@/components/NotificationBell";
import { loadUserSkillsAction } from "@/app/actions/userSkills";
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
                    <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Cargando tu inteligencia...</p>
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
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-mono text-slate-300">
                            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        </span>
                    </div>
                ) : (
                    <Link
                        href="/settings"
                        className="flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/20 rounded-xl hover:bg-accent/20 transition-colors"
                    >
                        <Wallet className="w-4 h-4 text-accent" />
                        <span className="text-xs font-medium text-accent">Conectar</span>
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
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg">
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
            className="bg-card border border-border rounded-2xl p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-bold text-white">Hackatones Prioritarios</h2>
                </div>
                <Link
                    href="/hackathons"
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent-bright transition-colors"
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
            className="bg-card border border-border rounded-2xl p-5"
        >
            <h3 className="text-sm font-bold text-slate-200 mb-4">Acciones Rápidas</h3>
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
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${action.bg} hover:opacity-80 transition-all group`}
                        >
                            <action.icon className={`w-6 h-6 ${action.color}`} />
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
            className="bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent border border-accent/20 rounded-2xl p-5"
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
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(neuroplasticity || 0.72) * 100}%` }}
                        transition={{ delay: 0.3, duration: 1 }}
                        className="h-full bg-gradient-to-r from-accent to-purple-500"
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-purple-400">{skillsCount}</p>
                    <p className="text-[10px] text-slate-500">Skills</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-blue-400">{avgSkillLevel}%</p>
                    <p className="text-[10px] text-slate-500">Nivel Avg</p>
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
            className="bg-card border border-border rounded-2xl p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
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
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${skill.level}%` }}
                                transition={{ delay: 0.1 + idx * 0.05, duration: 0.5 }}
                                className={`h-full ${
                                    skill.level >= 70 ? "bg-emerald-500" :
                                    skill.level >= 40 ? "bg-amber-500" : "bg-slate-500"
                                }`}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <Link
                href="/skills"
                className="mt-4 flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-colors"
            >
                <Plus className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-400">Agregar skill</span>
            </Link>
        </motion.div>
    );
}

function MarketOverview() {
    const [marketSkills, setMarketSkills] = useState<MarketTrend[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        fetchTrends();
    }, []);

    const fetchTrends = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/market/trends`);
            const data = await res.json();
            if (data.success && data.trends && data.trends.length > 0) {
                setMarketSkills(data.trends);
            } else {
                setMarketSkills(getFallbackTrends());
            }
        } catch (error) {
            console.error("Error fetching trends:", error);
            setMarketSkills(getFallbackTrends());
        } finally {
            setLoading(false);
        }
    };

    const getFallbackTrends = () => [
        { role_name: "AI/ML", demand_score: 90, growth_percentage: "+12%" },
        { role_name: "Blockchain", demand_score: 75, growth_percentage: "+8%" },
        { role_name: "Rust", demand_score: 82, growth_percentage: "+15%" },
        { role_name: "Docker", demand_score: 78, growth_percentage: "+5%" },
        { role_name: "Program Manager", demand_score: 85, growth_percentage: "+10%" },
        { role_name: "Data Analytics", demand_score: 88, growth_percentage: "+14%" },
    ];

    const handleSync = async () => {
        setSyncing(true);
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/market/sync`, { method: "POST" });
            // Wait a few seconds for background agent to process, then refetch
            setTimeout(fetchTrends, 5000);
        } catch (error) {
            console.error("Error syncing trends:", error);
        } finally {
            setTimeout(() => setSyncing(false), 2000);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-2xl p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Mercado en Alza</h3>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent-bright transition-colors disabled:opacity-50"
                >
                    {syncing ? <Loader2 className="w-3 h-3 animate-spin"/> : <TrendingUp className="w-3 h-3"/>}
                    {syncing ? "Sincronizando..." : "Actualizar"}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-4">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                </div>
            ) : (
                <div className="space-y-2">
                    {marketSkills.map((skill, idx) => (
                        <div key={skill.role_name} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                            <div>
                                <span className="text-xs font-medium text-slate-300">{skill.role_name}</span>
                                <p className="text-[10px] text-emerald-400">{skill.growth_percentage} vs mes anterior</p>
                            </div>
                            <span className="text-sm font-bold text-emerald-400">{skill.demand_score}%</span>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
