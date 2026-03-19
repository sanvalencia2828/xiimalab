"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain, Target, TrendingUp, Trophy, Zap, Clock, Bell,
    ChevronRight, Sparkles, Flame, Award, BookOpen,
    Wallet, Settings, Loader2, Plus, Calendar, CheckCircle2,
    ArrowUpRight, Eye, EyeOff, Save, X, RefreshCw
} from "lucide-react";
import NeuroProfileDashboard from "@/components/NeuroProfileDashboard";
import PriorityBoard from "@/components/PriorityBoard";

interface SkillProgress {
    name: string;
    level: number;
    hours: number;
    streak: number;
    category: string;
}

interface UserProfile {
    walletAddress: string;
    displayName: string;
    bio: string;
    skills: SkillProgress[];
    achievements: Achievement[];
    stats: {
        hackathonsParticipated: number;
        projectsCompleted: number;
        totalHours: number;
        streakDays: number;
    };
}

interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    earned: boolean;
    earnedAt?: string;
}

export default function ProfilePage() {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ displayName: "", bio: "" });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = () => {
        setLoading(true);
        
        const savedWallet = localStorage.getItem("stellar_pubkey");
        if (savedWallet) {
            setWalletAddress(savedWallet);
        }

        const savedProfile = localStorage.getItem("user_profile");
        if (savedProfile) {
            setProfile(JSON.parse(savedProfile));
        } else {
            // Default profile
            const defaultProfile: UserProfile = {
                walletAddress: savedWallet || "No conectado",
                displayName: "Desarrollador Xiimalab",
                bio: "Construyendo el futuro con IA y Blockchain",
                skills: [
                    { name: "Python", level: 65, hours: 45, streak: 7, category: "technical" },
                    { name: "JavaScript", level: 70, hours: 30, streak: 3, category: "technical" },
                    { name: "React", level: 55, hours: 20, streak: 0, category: "technical" },
                    { name: "AI/ML", level: 35, hours: 15, streak: 5, category: "analytical" },
                ],
                achievements: [
                    { id: "1", title: "Primer Paso", description: "Completa tu primer hackathon", icon: "🎯", earned: false },
                    { id: "2", title: "Stack Lleno", description: "Agrega 5 skills a tu perfil", icon: "📚", earned: true, earnedAt: "2026-03-15" },
                    { id: "3", title: "Neuroplasticidad", description: "Alcanza 80% de plasticidad", icon: "🧠", earned: false },
                    { id: "4", title: "Cazador de Bounties", description: "Aplica a 3 hackatones", icon: "💰", earned: false },
                    { id: "5", title: "Escrow Master", description: "Libera tu primer staking", icon: "🔐", earned: false },
                ],
                stats: {
                    hackathonsParticipated: 2,
                    projectsCompleted: 5,
                    totalHours: 120,
                    streakDays: 7,
                },
            };
            setProfile(defaultProfile);
        }

        setLoading(false);
    };

    const saveProfile = () => {
        if (profile) {
            const updated = {
                ...profile,
                displayName: editForm.displayName || profile.displayName,
                bio: editForm.bio || profile.bio,
            };
            setProfile(updated);
            localStorage.setItem("user_profile", JSON.stringify(updated));
            setEditing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-accent animate-spin" />
            </div>
        );
    }

    if (!profile) return null;

    const earnedAchievements = profile.achievements.filter(a => a.earned);
    const avgSkillLevel = profile.skills.length > 0
        ? Math.round(profile.skills.reduce((a, s) => a + s.level, 0) / profile.skills.length)
        : 0;

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto p-6 space-y-6">
                
                {/* Header */}
                <ProfileHeader 
                    profile={profile}
                    editing={editing}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    setEditing={setEditing}
                    onSave={saveProfile}
                />

                {/* Stats Grid */}
                <StatsGrid profile={profile} />

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left - Neuro Profile & Skills */}
                    <div className="lg:col-span-2 space-y-6">
                        <NeuroProfileDashboard walletAddress={walletAddress || undefined} />
                        
                        {/* Skills Progress */}
                        <SkillsProgressSection skills={profile.skills} />
                    </div>

                    {/* Right - Achievements & Quick Actions */}
                    <div className="space-y-6">
                        <AchievementsSection achievements={profile.achievements} />
                        <QuickLinksSection />
                    </div>
                </div>

                {/* Recent Activity */}
                <RecentActivitySection />
            </div>
        </div>
    );
}

function ProfileHeader({ 
    profile, 
    editing, 
    editForm, 
    setEditForm, 
    setEditing, 
    onSave 
}: { 
    profile: UserProfile;
    editing: boolean;
    editForm: { displayName: string; bio: string };
    setEditForm: (f: any) => void;
    setEditing: (e: boolean) => void;
    onSave: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-accent/20 via-purple-500/10 to-transparent border border-accent/20 rounded-2xl p-6"
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                        {profile.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        {editing ? (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={editForm.displayName}
                                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                    placeholder="Tu nombre"
                                    className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-lg font-bold focus:border-accent focus:outline-none"
                                />
                                <input
                                    type="text"
                                    value={editForm.bio}
                                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                    placeholder="Tu bio"
                                    className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-slate-300 text-sm focus:border-accent focus:outline-none"
                                />
                            </div>
                        ) : (
                            <>
                                <h1 className="text-2xl font-bold text-white">{profile.displayName}</h1>
                                <p className="text-sm text-slate-400">{profile.bio}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-xs font-mono text-slate-500">
                                        {profile.walletAddress.slice(0, 8)}...{profile.walletAddress.slice(-6)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {editing ? (
                        <>
                            <button
                                onClick={() => setEditing(false)}
                                className="p-2 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <button
                                onClick={onSave}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-lg hover:bg-emerald-600 transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                Guardar
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => {
                                setEditForm({ displayName: profile.displayName, bio: profile.bio });
                                setEditing(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/20 transition-colors"
                        >
                            <Settings className="w-4 h-4" />
                            Editar
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function StatsGrid({ profile }: { profile: UserProfile }) {
    const stats = [
        { label: "Hackatones", value: profile.stats.hackathonsParticipated, icon: Trophy, color: "text-amber-400" },
        { label: "Proyectos", value: profile.stats.projectsCompleted, icon: Award, color: "text-purple-400" },
        { label: "Horas", value: `${profile.stats.totalHours}h`, icon: Clock, color: "text-blue-400" },
        { label: "Racha", value: `${profile.stats.streakDays}d`, icon: Flame, color: "text-orange-400" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
            {stats.map((stat, idx) => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                    className="bg-card border border-border rounded-xl p-4 text-center"
                >
                    <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-2`} />
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                </motion.div>
            ))}
        </motion.div>
    );
}

function SkillsProgressSection({ skills }: { skills: SkillProgress[] }) {
    const sorted = [...skills].sort((a, b) => b.level - a.level);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-2xl p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-accent" />
                    <h2 className="text-lg font-bold text-white">Progreso de Skills</h2>
                </div>
                <a href="/skills" className="text-xs text-accent hover:text-accent-bright">
                    Ver todas →
                </a>
            </div>

            <div className="space-y-4">
                {sorted.map((skill, idx) => (
                    <div key={skill.name}>
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-200">{skill.name}</span>
                                {skill.streak > 0 && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded text-[9px]">
                                        🔥 {skill.streak}d
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500">{skill.hours}h</span>
                                <span className={`text-sm font-bold ${
                                    skill.level >= 70 ? "text-emerald-400" :
                                    skill.level >= 40 ? "text-amber-400" : "text-slate-400"
                                }`}>
                                    {skill.level}%
                                </span>
                            </div>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
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
        </motion.div>
    );
}

function AchievementsSection({ achievements }: { achievements: Achievement[] }) {
    const earned = achievements.filter(a => a.earned);
    const pending = achievements.filter(a => !a.earned);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-2xl p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Logros</h3>
                </div>
                <span className="text-xs text-slate-500">{earned.length}/{achievements.length}</span>
            </div>

            <div className="space-y-2">
                {earned.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <span className="text-lg">{a.icon}</span>
                        <div className="flex-1">
                            <p className="text-xs font-medium text-emerald-400">{a.title}</p>
                            <p className="text-[10px] text-slate-500">{a.description}</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                ))}
                {pending.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-2 bg-white/5 border border-white/5 rounded-lg opacity-60">
                        <span className="text-lg grayscale">{a.icon}</span>
                        <div className="flex-1">
                            <p className="text-xs font-medium text-slate-400">{a.title}</p>
                            <p className="text-[10px] text-slate-600">{a.description}</p>
                        </div>
                        <span className="text-[10px] text-slate-500">Bloqueado</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

function QuickLinksSection() {
    const links = [
        { label: "Agregar Skill", href: "/skills", icon: Plus, color: "text-blue-400" },
        { label: "Ver Hackatones", href: "/hackathons", icon: Trophy, color: "text-amber-400" },
        { label: "Market Match", href: "/match", icon: Target, color: "text-purple-400" },
        { label: "Configurar Wallet", href: "/settings", icon: Wallet, color: "text-emerald-400" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-2xl p-5"
        >
            <h3 className="text-sm font-bold text-white mb-3">Accesos Rápidos</h3>
            <div className="space-y-2">
                {links.map((link) => (
                    <a
                        key={link.label}
                        href={link.href}
                        className="flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-colors group"
                    >
                        <div className="flex items-center gap-2">
                            <link.icon className={`w-4 h-4 ${link.color}`} />
                            <span className="text-xs text-slate-300 group-hover:text-white">{link.label}</span>
                        </div>
                        <ArrowUpRight className="w-3 h-3 text-slate-600 group-hover:text-accent transition-colors" />
                    </a>
                ))}
            </div>
        </motion.div>
    );
}

function RecentActivitySection() {
    const activities = [
        { type: "skill", text: "Subiste Python a 65%", time: "Hace 2 horas", icon: "📈" },
        { type: "hackathon", text: "Aplicaste a Web3 Cross-Chain Challenge", time: "Ayer", icon: "🏆" },
        { type: "achievement", text: "Desbloqueaste Logro: Stack Lleno", time: "Hace 3 días", icon: "🎉" },
        { type: "project", text: "Completaste Proyecto: Xiima NFT Mint", time: "Hace 1 semana", icon: "✅" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border rounded-2xl p-5"
        >
            <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-accent" />
                <h3 className="text-sm font-bold text-white">Actividad Reciente</h3>
            </div>

            <div className="space-y-3">
                {activities.map((activity, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                        <span className="text-lg">{activity.icon}</span>
                        <div className="flex-1">
                            <p className="text-xs text-slate-300">{activity.text}</p>
                            <p className="text-[10px] text-slate-500">{activity.time}</p>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
