"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain, Target, TrendingUp, Clock, Zap, Award,
    BookOpen, ChevronRight, Loader2, AlertCircle,
    Activity, Flame, Calendar, Trophy
} from "lucide-react";

interface SkillProgress {
    name: string;
    hours: number;
    mastery: number;
    streak: number;
    category: string;
}

interface NeuroProfile {
    wallet_address: string;
    dominant_category: string;
    cognitive_strengths: string[];
    neuroplasticity_score: number;
    learning_efficiency: number;
    skills_progress: Record<string, SkillProgress>;
    target_skills: string[];
    total_hours_learned: number;
    hackathons_participated: number;
}

const VALID_CATEGORIES = ["memory", "attention", "executive", "language", "visuospatial", "motor", "metacognition"] as const;
type Category = typeof VALID_CATEGORIES[number];

const CATEGORY_INFO: Record<Category, { icon: any; color: string; bg: string; label: string }> = {
    memory: { icon: Brain, color: "text-blue-400", bg: "bg-blue-500/10", label: "Memoria" },
    attention: { icon: Target, color: "text-red-400", bg: "bg-red-500/10", label: "Atención" },
    executive: { icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10", label: "Ejecutivo" },
    language: { icon: BookOpen, color: "text-purple-400", bg: "bg-purple-500/10", label: "Lenguaje" },
    visuospatial: { icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Visuoespacial" },
    motor: { icon: Flame, color: "text-orange-400", bg: "bg-orange-500/10", label: "Motor" },
    metacognition: { icon: Brain, color: "text-cyan-400", bg: "bg-cyan-500/10", label: "Metacognición" },
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    memory: "Retención y manipulación de información. Usado para recordar APIs, patrones y conceptos.",
    attention: "Enfoque selectivo y sostenido. Crítico para debugging y código complejo.",
    executive: "Planificación y toma de decisiones. Esencial para arquitectura de sistemas.",
    language: "Comprensión y producción verbal. Importante para documentación técnica.",
    visuospatial: "Procesamiento espacial. Relevante para frontend, UI/UX y visualización.",
    motor: "Coordinación y velocidad motora. Afecta velocidad de escritura de código.",
    metacognition: "Conciencia del proceso de aprendizaje. Clave para mejora continua.",
};

export default function NeuroProfileDashboard({ walletAddress }: { walletAddress?: string }) {
    const [profile, setProfile] = useState<NeuroProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "skills" | "insights">("overview");

    useEffect(() => {
        if (walletAddress) {
            loadProfile(walletAddress);
        } else {
            setLoading(false);
        }
    }, [walletAddress]);

    const loadProfile = async (address: string) => {
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const response = await fetch(`${apiUrl}/neuro/profile/${address}`);
            if (response.ok) {
                const data = await response.json();
                setProfile(data);
            } else {
                // Profile not found, use mock data
                setProfile(generateMockProfile(address));
            }
        } catch (err) {
            setError("Error cargando perfil neuropsicológico");
            setProfile(generateMockProfile(address || "demo"));
        }
        setLoading(false);
    };

    const generateMockProfile = (address: string): NeuroProfile => ({
        wallet_address: address,
        dominant_category: "executive",
        cognitive_strengths: ["executive", "memory"],
        neuroplasticity_score: 0.72,
        learning_efficiency: 0.85,
        skills_progress: {
            python: { name: "Python", hours: 45, mastery: 65, streak: 7, category: "executive" },
            javascript: { name: "JavaScript", hours: 30, mastery: 55, streak: 3, category: "executive" },
            ai: { name: "AI/ML", hours: 20, mastery: 35, streak: 0, category: "executive" },
            blockchain: { name: "Blockchain", hours: 15, mastery: 40, streak: 5, category: "executive" },
            docker: { name: "Docker", hours: 10, mastery: 25, streak: 0, category: "practical" },
        },
        target_skills: ["AI/ML", "Rust", "Smart Contracts"],
        total_hours_learned: 120,
        hackathons_participated: 2,
    });

    if (loading) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 text-rose-400 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Perfil no encontrado</span>
                </div>
                <p className="text-xs text-slate-400">
                    Completa tu perfil para ver tu análisis neuropsicológico personalizado.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <TabsHeader active={activeTab} setActive={setActiveTab} />

            <AnimatePresence mode="wait">
                {activeTab === "overview" && <OverviewTab profile={profile} />}
                {activeTab === "skills" && <SkillsTab profile={profile} />}
                {activeTab === "insights" && <InsightsTab profile={profile} />}
            </AnimatePresence>
        </div>
    );
}

function TabsHeader({ active, setActive }: { active: "overview" | "skills" | "insights"; setActive: (t: "overview" | "skills" | "insights") => void }) {
    const tabs: { id: "overview" | "skills" | "insights"; label: string; icon: any }[] = [
        { id: "overview", label: "Overview", icon: Brain },
        { id: "skills", label: "Skills", icon: TrendingUp },
        { id: "insights", label: "Insights", icon: Zap },
    ];

    return (
        <div className="flex gap-2 border-b border-border pb-2">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActive(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        active === tab.id
                            ? "bg-accent/20 text-accent"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

function OverviewTab({ profile }: { profile: NeuroProfile }) {
    const dominantCategory = (VALID_CATEGORIES.includes(profile.dominant_category as Category) 
        ? profile.dominant_category 
        : "executive") as Category;
    const strengthInfo = CATEGORY_INFO[dominantCategory];
    const StrengthIcon = strengthInfo.icon;

    return (
        <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            {/* Neuroplasticity Score */}
            <div className="bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent rounded-xl p-4 border border-accent/20">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-accent" />
                        <span className="text-sm font-bold text-slate-200">Neuroplasticidad</span>
                    </div>
                    <span className="text-2xl font-bold text-accent">
                        {(profile.neuroplasticity_score * 100).toFixed(0)}%
                    </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${profile.neuroplasticity_score * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-accent to-purple-500"
                    />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    Tu capacidad de aprender y adaptarte a nuevas tecnologías.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
                <StatCard icon={Clock} label="Horas totales" value={`${profile.total_hours_learned}h`} color="text-blue-400" />
                <StatCard icon={Trophy} label="Hackatones" value={String(profile.hackathons_participated)} color="text-amber-400" />
                <StatCard icon={Target} label="Skills" value={String(Object.keys(profile.skills_progress).length)} color="text-emerald-400" />
            </div>

            {/* Dominant Category */}
            <div className={`p-4 rounded-xl ${strengthInfo.bg} border border-border`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg bg-slate-900/50`}>
                        <StrengthIcon className={`w-5 h-5 ${strengthInfo.color}`} />
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Categoría dominante</span>
                        <h4 className={`text-sm font-bold ${strengthInfo.color}`}>{strengthInfo.label}</h4>
                    </div>
                </div>
                <p className="text-xs text-slate-400">
                    {CATEGORY_DESCRIPTIONS[dominantCategory]}
                </p>
            </div>

            {/* Cognitive Strengths */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Fortalezas cognitivas</span>
                <div className="flex flex-wrap gap-2 mt-2">
                    {profile.cognitive_strengths.map((cat) => {
                        const safeCat: Category = VALID_CATEGORIES.includes(cat as Category) ? cat as Category : "executive";
                        const info = CATEGORY_INFO[safeCat];
                        return (
                            <span key={cat} className={`px-2 py-1 rounded-full text-[10px] font-medium ${info.bg} ${info.color}`}>
                                {info.label}
                            </span>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
}

function SkillsTab({ profile }: { profile: NeuroProfile }) {
    const skills = Object.values(profile.skills_progress).sort((a, b) => b.mastery - a.mastery);

    return (
        <motion.div
            key="skills"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Progreso de Skills</span>
                <span className="text-xs text-accent">{skills.length} skills</span>
            </div>

            {skills.map((skill, idx) => (
                <motion.div
                    key={skill.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-3 bg-white/5 rounded-xl border border-white/5"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">{skill.name}</span>
                            {skill.streak > 0 && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded text-[9px]">
                                    <Flame className="w-2.5 h-2.5" /> {skill.streak}d
                                </span>
                            )}
                        </div>
                        <span className={`text-sm font-bold ${
                            skill.mastery >= 70 ? "text-emerald-400" :
                            skill.mastery >= 40 ? "text-amber-400" : "text-slate-400"
                        }`}>
                            {skill.mastery}%
                        </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${skill.mastery}%` }}
                            transition={{ delay: idx * 0.05 + 0.2, duration: 0.5 }}
                            className={`h-full ${
                                skill.mastery >= 70 ? "bg-emerald-500" :
                                skill.mastery >= 40 ? "bg-amber-500" : "bg-slate-500"
                            }`}
                        />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{skill.hours}h practicadas</span>
                        <span>{skill.category}</span>
                    </div>
                </motion.div>
            ))}

            {/* Target Skills */}
            <div className="p-3 bg-accent/5 rounded-xl border border-accent/10 mt-4">
                <span className="text-xs text-accent uppercase tracking-wider">Skills objetivo</span>
                <div className="flex flex-wrap gap-2 mt-2">
                    {profile.target_skills.map((skill) => (
                        <span key={skill} className="px-2 py-1 bg-accent/10 text-accent rounded text-[10px] font-medium">
                            {skill}
                        </span>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

function InsightsTab({ profile }: { profile: NeuroProfile }) {
    const recommendations = [
        {
            icon: Brain,
            title: "Desarrolla tu memoria de trabajo",
            description: "Practica con ejercicios de coding challenges diarios para mejorar retención de patrones.",
            priority: "high",
        },
        {
            icon: Target,
            title: "Mejora atención sostenida",
            description: "Usa técnica Pomodoro: 25 min focus, 5 min break. Evita multitasking.",
            priority: "medium",
        },
        {
            icon: Award,
            title: "Participa en hackatones",
            description: `Tienes ${profile.hackathons_participated} hackatones. Participa en 1 más para desbloquear el staking.`,
            priority: "high",
        },
    ];

    return (
        <motion.div
            key="insights"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
        >
            <span className="text-xs text-slate-500 uppercase tracking-wider">Recomendaciones personalizadas</span>

            {recommendations.map((rec, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-3 rounded-xl border ${
                        rec.priority === "high" 
                            ? "bg-amber-500/5 border-amber-500/20" 
                            : "bg-white/5 border-white/5"
                    }`}
                >
                    <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg ${
                            rec.priority === "high" ? "bg-amber-500/10" : "bg-slate-700/50"
                        }`}>
                            <rec.icon className={`w-4 h-4 ${
                                rec.priority === "high" ? "text-amber-400" : "text-slate-400"
                            }`} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-200">{rec.title}</h4>
                                {rec.priority === "high" && (
                                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[9px]">
                                        Alta prioridad
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">{rec.description}</p>
                        </div>
                    </div>
                </motion.div>
            ))}

            {/* Learning Efficiency */}
            <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 mt-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400 font-medium">Eficiencia de aprendizaje</span>
                    <span className="text-lg font-bold text-emerald-400">
                        {(profile.learning_efficiency * 100).toFixed(0)}%
                    </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                    Basado en tus horas practicadas vs. mastery alcanzado.
                </p>
            </div>
        </motion.div>
    );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
    return (
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-center">
            <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-[9px] text-slate-500 uppercase">{label}</p>
        </div>
    );
}
