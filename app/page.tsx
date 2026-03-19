"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain, Target, TrendingUp, Trophy, Zap, Clock, Bell,
    ChevronRight, Sparkles, Flame, BarChart3, BookOpen,
    Wallet, Settings, Loader2, Plus, Award, Calendar,
    CheckCircle2, AlertCircle, ArrowUpRight, X
} from "lucide-react";
import Link from "next/link";
import PriorityBoard from "@/components/PriorityBoard";

interface Notification {
    id: number;
    type: string;
    hackathon_id: string;
    message: string;
    created_at: string;
}

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
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
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
        
        // Load wallet from localStorage
        const savedWallet = localStorage.getItem("stellar_pubkey");
        if (savedWallet) {
            setWalletAddress(savedWallet);
        }

        // Load skills
        const savedSkills = localStorage.getItem("user_skills");
        if (savedSkills) {
            const parsed = JSON.parse(savedSkills);
            setSkills(parsed);
        } else {
            // Default skills
            const defaults = [
                { name: "Python", level: 65, category: "technical" },
                { name: "JavaScript", level: 70, category: "technical" },
                { name: "React", level: 55, category: "technical" },
            ];
            setSkills(defaults);
        }

        // Load stats
        const savedStats = localStorage.getItem("dashboard_stats");
        if (savedStats) {
            setStats(JSON.parse(savedStats));
        }

        // Load notifications
        const savedNotifications = localStorage.getItem("user_notifications");
        if (savedNotifications) {
            setNotifications(JSON.parse(savedNotifications));
        }

        setLoading(false);
    };

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
                <Header 
                    walletAddress={walletAddress}
                    stats={stats}
                    notifications={notifications}
                    onToggleNotifications={() => setShowNotifications(!showNotifications)}
                />

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Column - Priority & Actions */}
                    <div className="lg:col-span-2 space-y-6">
                        <HackathonsSection />
                        <QuickActionsSection walletAddress={walletAddress} />
                    </div>

                    {/* Right Column - Profile & Skills */}
                    <div className="space-y-6">
                        <ProfileSection 
                            walletAddress={walletAddress}
                            avgSkillLevel={avgSkillLevel}
                            skillsCount={skills.length}
                            neuroplasticity={stats.neuroplasticity}
                        />
                        <SkillsOverview skills={skills} />
                        <MarketOverview />
                    </div>
                </div>
            </div>

            {/* Notifications Panel */}
            <AnimatePresence>
                {showNotifications && (
                    <NotificationsPanel 
                        notifications={notifications}
                        onClose={() => setShowNotifications(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function Header({ 
    walletAddress, 
    stats, 
    notifications, 
    onToggleNotifications 
}: { 
    walletAddress: string | null;
    stats: DashboardStats;
    notifications: Notification[];
    onToggleNotifications: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
        >
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center">
                        <Brain className="w-6 h-6 text-white" />
                    </div>
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
                        <span className="text-xs font-medium text-accent">Conectar Wallet</span>
                    </Link>
                )}

                {/* Notifications Bell */}
                <button
                    onClick={onToggleNotifications}
                    className="relative p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                >
                    <Bell className="w-5 h-5 text-slate-400" />
                    {notifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {notifications.length}
                        </span>
                    )}
                </button>
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

function QuickActionsSection({ walletAddress }: { walletAddress: string | null }) {
    const actions = [
        { 
            icon: Plus, 
            label: "Agregar Skill", 
            href: "/skills",
            color: "text-blue-400",
            bg: "bg-blue-500/10 border-blue-500/20",
            hover: "hover:bg-blue-500/20"
        },
        { 
            icon: Target, 
            label: "Ver Roles", 
            href: "/skills",
            color: "text-purple-400",
            bg: "bg-purple-500/10 border-purple-500/20",
            hover: "hover:bg-purple-500/20"
        },
        { 
            icon: Brain, 
            label: "Neuro Perfil", 
            href: "/profile",
            color: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/20",
            hover: "hover:bg-emerald-500/20"
        },
        { 
            icon: Award, 
            label: "Logros", 
            href: "/achievements",
            color: "text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/20",
            hover: "hover:bg-amber-500/20"
        },
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
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${action.bg} ${action.hover} transition-all group`}
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
    walletAddress, 
    avgSkillLevel, 
    skillsCount,
    neuroplasticity 
}: { 
    walletAddress: string | null;
    avgSkillLevel: number;
    skillsCount: number;
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
    const marketSkills = [
        { name: "AI/ML", demand: 90, growth: "+12%" },
        { name: "Blockchain", demand: 75, growth: "+8%" },
        { name: "Rust", demand: 82, growth: "+15%" },
        { name: "Docker", demand: 78, growth: "+5%" },
    ];

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
            </div>

            <div className="space-y-2">
                {marketSkills.map((skill) => (
                    <div key={skill.name} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                        <div>
                            <span className="text-xs font-medium text-slate-300">{skill.name}</span>
                            <p className="text-[10px] text-emerald-400">{skill.growth} vs mes anterior</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-400">{skill.demand}%</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

function NotificationsPanel({ 
    notifications, 
    onClose 
}: { 
    notifications: Notification[]; 
    onClose: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
        >
            <motion.div
                initial={{ x: 300 }}
                animate={{ x: 0 }}
                exit={{ x: 300 }}
                transition={{ type: "spring", damping: 25 }}
                className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-accent" />
                        <h3 className="text-lg font-bold text-white">Notificaciones</h3>
                        {notifications.length > 0 && (
                            <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                                {notifications.length}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {notifications.length === 0 ? (
                    <div className="text-center py-12">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                        <p className="text-slate-400">¡Todo al día!</p>
                        <p className="text-xs text-slate-500 mt-1">No hay notificaciones pendientes</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notifications.map((notif, idx) => (
                            <motion.div
                                key={notif.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="p-3 bg-white/5 border border-white/5 rounded-xl"
                            >
                                <p className="text-sm text-slate-300">{notif.message}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                        notif.type === "urgency" 
                                            ? "bg-rose-500/10 text-rose-400" 
                                            : "bg-emerald-500/10 text-emerald-400"
                                    }`}>
                                        {notif.type === "urgency" ? "Urgente" : "Match"}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        {new Date(notif.created_at).toLocaleDateString("es")}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
