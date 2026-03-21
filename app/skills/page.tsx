"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain, Target, TrendingUp, Plus, X, Search, Sparkles,
    ChevronRight, Trophy, Clock, Zap, Award, BarChart3,
    CheckCircle2, Circle, Loader2, Star, ArrowUpRight
} from "lucide-react";
import { getSkillRelevanceAction, SkillRelevance } from "@/app/actions/market";

interface Skill {
    id: string;
    name: string;
    level: number; // 1-100
    category: string;
    marketDemand: number;
    yearsExperience: number;
    lastUsed: string;
}

interface MarketSkill {
    skill: string;
    category: string;
    marketDemand: number;
    avgPrize: number;
    opportunityCount: number;
}

interface Role {
    title: string;
    description: string;
    requiredSkills: string[];
    currentLevel: number;
    marketDemand: number;
    growth: "hot" | "stable" | "emerging";
    icon: any;
}

const CATEGORIES = [
    { id: "technical", label: "Técnico", color: "text-blue-400", bg: "bg-blue-500/10" },
    { id: "creative", label: "Creativo", color: "text-purple-400", bg: "bg-purple-500/10" },
    { id: "analytical", label: "Analítico", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { id: "social", label: "Social", color: "text-amber-400", bg: "bg-amber-500/10" },
    { id: "practical", label: "Práctico", color: "text-orange-400", bg: "bg-orange-500/10" },
];

const SUGGESTED_SKILLS = [
    "Python", "JavaScript", "TypeScript", "React", "Node.js",
    "AI/ML", "TensorFlow", "PyTorch", "Docker", "Kubernetes",
    "Blockchain", "Smart Contracts", "Solidity", "Rust",
    "PostgreSQL", "MongoDB", "GraphQL", "REST APIs",
    "AWS", "GCP", "Azure", "Firebase",
    "Figma", "UI/UX", "Tailwind", "CSS",
    "Git", "CI/CD", "Agile", "Scrum",
];

const ROLES: Role[] = [
    {
        title: "Full Stack Developer",
        description: "Desarrolla aplicaciones completas de extremo a extremo",
        requiredSkills: ["JavaScript", "React", "Node.js", "PostgreSQL"],
        currentLevel: 0,
        marketDemand: 85,
        growth: "hot",
        icon: Code2,
    },
    {
        title: "AI/ML Engineer",
        description: "Construye sistemas de inteligencia artificial",
        requiredSkills: ["Python", "TensorFlow", "PyTorch", "AI/ML"],
        currentLevel: 0,
        marketDemand: 90,
        growth: "hot",
        icon: Brain,
    },
    {
        title: "Blockchain Developer",
        description: "Desarrolla soluciones Web3 y smart contracts",
        requiredSkills: ["Solidity", "Blockchain", "Smart Contracts", "Rust"],
        currentLevel: 0,
        marketDemand: 75,
        growth: "emerging",
        icon: Zap,
    },
    {
        title: "DevOps Engineer",
        description: "Automatiza infraestructura y despliegues",
        requiredSkills: ["Docker", "Kubernetes", "AWS", "CI/CD"],
        currentLevel: 0,
        marketDemand: 80,
        growth: "stable",
        icon: Server,
    },
    {
        title: "Data Engineer",
        description: "Diseña pipelines de datos y analytics",
        requiredSkills: ["Python", "PostgreSQL", "MongoDB", "AWS"],
        currentLevel: 0,
        marketDemand: 82,
        growth: "stable",
        icon: Database,
    },
];

export default function SkillsPage() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [marketSkills, setMarketSkills] = useState<MarketSkill[]>([]);
    const [skillRelevance, setSkillRelevance] = useState<SkillRelevance[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"profile" | "market" | "roles">("profile");
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        
        // Load saved skills from localStorage
        const saved = localStorage.getItem("user_skills");
        if (saved) {
            setSkills(JSON.parse(saved));
        } else {
            // Initialize with some default skills
            const defaults: Skill[] = [
                { id: "1", name: "Python", level: 65, category: "technical", marketDemand: 88, yearsExperience: 2, lastUsed: "2026-03" },
                { id: "2", name: "JavaScript", level: 70, category: "technical", marketDemand: 92, yearsExperience: 3, lastUsed: "2026-03" },
                { id: "3", name: "React", level: 55, category: "technical", marketDemand: 85, yearsExperience: 1, lastUsed: "2026-02" },
            ];
            setSkills(defaults);
        }

        // Load market data and skill relevance in parallel
        try {
            const [marketResponse, relevanceResult] = await Promise.all([
                fetch(`/api/neuro/market-analysis`),
                getSkillRelevanceAction(),
            ]);
            
            if (marketResponse.ok) {
                const data = await marketResponse.json();
                setMarketSkills(data.top_skills_by_demand || []);
            }
            
            if (!("error" in relevanceResult) && Array.isArray(relevanceResult.relevance_report)) {
                setSkillRelevance(relevanceResult.relevance_report);
            }
        } catch (err) {
            console.log("Using mock market data");
        }
        
        setLoading(false);
    };

    const saveSkills = (newSkills: Skill[]) => {
        setSkills(newSkills);
        localStorage.setItem("user_skills", JSON.stringify(newSkills));
    };

    const addSkill = (skill: Omit<Skill, "id">) => {
        const newSkill: Skill = {
            ...skill,
            id: Date.now().toString(),
        };
        saveSkills([...skills, newSkill]);
    };

    const removeSkill = (id: string) => {
        saveSkills(skills.filter(s => s.id !== id));
    };

    const updateSkillLevel = (id: string, level: number) => {
        saveSkills(skills.map(s => s.id === id ? { ...s, level } : s));
    };

    const getMatchingSkills = () => {
        const userSkillNames = skills.map(s => s.name.toLowerCase());
        return marketSkills.filter(m => 
            userSkillNames.some(u => m.skill.toLowerCase().includes(u) || u.includes(m.skill.toLowerCase()))
        );
    };

    const getMissingSkills = () => {
        const userSkillNames = skills.map(s => s.name.toLowerCase());
        
        const missingFromMarket = marketSkills.filter(m => 
            !userSkillNames.some(u => m.skill.toLowerCase().includes(u) || u.includes(m.skill.toLowerCase()))
        );
        
        // Prioritize by skill relevance score using Optional Chaining
        const sortedMissing = missingFromMarket.sort((a, b) => {
            const relevanceA = skillRelevance?.find(r => 
                r.skill.toLowerCase() === a.skill.toLowerCase() || 
                a.skill.toLowerCase().includes(r.skill.toLowerCase())
            )?.score ?? 0;
            const relevanceB = skillRelevance?.find(r => 
                r.skill.toLowerCase() === b.skill.toLowerCase() || 
                b.skill.toLowerCase().includes(r.skill.toLowerCase())
            )?.score ?? 0;
            return relevanceB - relevanceA;
        });
        
        return sortedMissing.slice(0, 8);
    };

    const calculateRoleProgress = (role: Role): number => {
        const userSkillNames = skills.map(s => s.name.toLowerCase());
        const matched = role.requiredSkills.filter(req => 
            userSkillNames.some(u => req.toLowerCase().includes(u))
        );
        return Math.round((matched.length / role.requiredSkills.length) * 100);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto p-6 space-y-6">
                <Header onAddSkill={() => setShowAddModal(true)} />

                <Tabs active={activeTab} setActive={setActiveTab} />

                <AnimatePresence mode="wait">
                    {activeTab === "profile" && (
                        <ProfileTab
                            skills={skills}
                            matchingSkills={getMatchingSkills()}
                            missingSkills={getMissingSkills()}
                            onRemove={removeSkill}
                            onUpdateLevel={updateSkillLevel}
                        />
                    )}
                    {activeTab === "market" && (
                        <MarketTab
                            userSkills={skills}
                            marketSkills={marketSkills}
                            onAddSkill={(name) => {
                                const market = marketSkills.find(m => m.skill.toLowerCase() === name.toLowerCase());
                                addSkill({
                                    name,
                                    level: 30,
                                    category: market?.category || "technical",
                                    marketDemand: market?.marketDemand || 50,
                                    yearsExperience: 0,
                                    lastUsed: new Date().toISOString().slice(0, 7),
                                });
                            }}
                        />
                    )}
                    {activeTab === "roles" && (
                        <RolesTab
                            skills={skills}
                            calculateRoleProgress={calculateRoleProgress}
                        />
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {showAddModal && (
                    <AddSkillModal
                        onClose={() => setShowAddModal(false)}
                        onAdd={addSkill}
                        existingSkills={skills.map(s => s.name)}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function Header({ onAddSkill }: { onAddSkill: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
        >
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-xs font-medium text-accent uppercase tracking-widest">
                        Perfil de Habilidades
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-white">
                    Mi Stack <span className="gradient-text">Profesional</span>
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                    Desarrolla habilidades que el mercado demanda
                </p>
            </div>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onAddSkill}
                className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white font-bold text-sm rounded-xl hover:bg-accent-bright transition-colors"
            >
                <Plus className="w-4 h-4" />
                Agregar Skill
            </motion.button>
        </motion.div>
    );
}

function Tabs({ active, setActive }: { active: string; setActive: (t: "profile" | "market" | "roles") => void }) {
    const tabs = [
        { id: "profile", label: "Mi Perfil", icon: Brain },
        { id: "market", label: "vs Mercado", icon: BarChart3 },
        { id: "roles", label: "Roles", icon: Target },
    ];

    return (
        <div className="flex gap-2 border-b border-border pb-2">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActive(tab.id as "profile" | "market" | "roles")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                        active === tab.id
                            ? "bg-accent/20 text-accent"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

function ProfileTab({
    skills,
    matchingSkills,
    missingSkills,
    onRemove,
    onUpdateLevel,
}: {
    skills: Skill[];
    matchingSkills: MarketSkill[];
    missingSkills: MarketSkill[];
    onRemove: (id: string) => void;
    onUpdateLevel: (id: string, level: number) => void;
}) {
    const sortedSkills = [...skills].sort((a, b) => b.level - a.level);
    const avgLevel = skills.length > 0 ? Math.round(skills.reduce((a, s) => a + s.level, 0) / skills.length) : 0;

    return (
        <motion.div
            key="profile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
            {/* Skills principales */}
            <div className="lg:col-span-2 space-y-4">
                <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-200">Mis Habilidades</h3>
                        <span className="text-xs text-slate-500">{skills.length} skills</span>
                    </div>
                    
                    <div className="space-y-3">
                        {sortedSkills.map((skill, idx) => (
                            <SkillCard
                                key={skill.id}
                                skill={skill}
                                index={idx}
                                onRemove={onRemove}
                                onUpdateLevel={onUpdateLevel}
                            />
                        ))}
                    </div>

                    {skills.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Agrega tu primera habilidad</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats y Missing Skills */}
            <div className="space-y-4">
                <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-200 mb-4">Stats</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <StatBox label="Nivel Promedio" value={`${avgLevel}%`} color="text-accent" />
                        <StatBox label="Skills" value={String(skills.length)} color="text-purple-400" />
                        <StatBox label="Match Mercado" value={String(matchingSkills.length)} color="text-emerald-400" />
                        <StatBox label="Gap" value={String(missingSkills.length)} color="text-amber-400" />
                    </div>
                </div>

                {missingSkills.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-amber-400" />
                            <h3 className="text-sm font-bold text-slate-200">Skills en Demanda</h3>
                        </div>
                        <div className="space-y-2">
                            {missingSkills.slice(0, 5).map((skill) => (
                                <div key={skill.skill} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                                    <span className="text-xs text-slate-300">{skill.skill}</span>
                                    <span className="text-xs font-bold text-emerald-400">{skill.marketDemand}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function SkillCard({
    skill,
    index,
    onRemove,
    onUpdateLevel,
}: {
    skill: Skill;
    index: number;
    onRemove: (id: string) => void;
    onUpdateLevel: (id: string, level: number) => void;
}) {
    const category = CATEGORIES.find(c => c.id === skill.category) || CATEGORIES[0];

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-3 bg-white/5 rounded-xl border border-white/5"
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${category.bg} ${category.color}`}>
                        {category.label}
                    </span>
                    <h4 className="text-sm font-medium text-slate-200">{skill.name}</h4>
                </div>
                <button
                    onClick={() => onRemove(skill.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={skill.level}
                    onChange={(e) => onUpdateLevel(skill.id, parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-accent"
                />
                <span className={`text-sm font-bold w-10 text-right ${
                    skill.level >= 70 ? "text-emerald-400" :
                    skill.level >= 40 ? "text-amber-400" : "text-slate-400"
                }`}>
                    {skill.level}%
                </span>
            </div>

            <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                <span>{skill.yearsExperience} año(s) exp.</span>
                <span>Demanda: {skill.marketDemand}%</span>
            </div>
        </motion.div>
    );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-slate-500 uppercase">{label}</p>
        </div>
    );
}

function MarketTab({
    userSkills,
    marketSkills,
    onAddSkill,
}: {
    userSkills: Skill[];
    marketSkills: MarketSkill[];
    onAddSkill: (name: string) => void;
}) {
    const userSkillNames = userSkills.map(s => s.name.toLowerCase());
    
    const matched = marketSkills.filter(m => 
        userSkillNames.some(u => m.skill.toLowerCase().includes(u) || u.includes(m.skill.toLowerCase()))
    );
    
    const notMatched = marketSkills.filter(m => 
        !userSkillNames.some(u => m.skill.toLowerCase().includes(u) || u.includes(m.skill.toLowerCase()))
    );

    return (
        <motion.div
            key="market"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            {/* Header Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-card border border-emerald-500/30 rounded-2xl p-4 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-emerald-400">{matched.length}</p>
                    <p className="text-xs text-slate-500">Skills en Mercado</p>
                </div>
                <div className="bg-card border border-amber-500/30 rounded-2xl p-4 text-center">
                    <ArrowUpRight className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-amber-400">{notMatched.length}</p>
                    <p className="text-xs text-slate-500">Para Desarrollar</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 text-center">
                    <Trophy className="w-6 h-6 text-accent mx-auto mb-2" />
                    <p className="text-2xl font-bold text-accent">
                        {marketSkills.length > 0 
                            ? Math.round(matched.length / marketSkills.length * 100) 
                            : 0}%
                    </p>
                    <p className="text-xs text-slate-500">Cobertura</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-400">
                        {userSkills.length}
                    </p>
                    <p className="text-xs text-slate-500">Tus Skills</p>
                </div>
            </div>

            {/* Comparison Chart */}
            <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-200 mb-4">Comparativa: Tú vs Mercado</h3>
                <div className="space-y-4">
                    {marketSkills.slice(0, 10).map((market, idx) => {
                        const userSkill = userSkills.find(u => 
                            u.name.toLowerCase() === market.skill.toLowerCase() ||
                            market.skill.toLowerCase().includes(u.name.toLowerCase())
                        );
                        const hasSkill = !!userSkill;

                        return (
                            <div key={market.skill} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${hasSkill ? "text-slate-200" : "text-slate-500"}`}>
                                        {market.skill}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {userSkill && (
                                            <span className="text-xs text-emerald-400">Tú: {userSkill.level}%</span>
                                        )}
                                        <span className="text-xs text-accent">Mercado: {market.marketDemand}%</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 h-3">
                                    {userSkill && (
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${userSkill.level}%` }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="h-full bg-emerald-500 rounded-full"
                                        />
                                    )}
                                    <div
                                        className="h-full bg-accent/30 rounded-full"
                                        style={{ width: `${market.marketDemand}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Skills to Add */}
            {notMatched.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-200 mb-4">Skills para Agregar</h3>
                    <div className="flex flex-wrap gap-2">
                        {notMatched.slice(0, 12).map((skill) => (
                            <motion.button
                                key={skill.skill}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onAddSkill(skill.skill)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-accent/10 border border-white/10 hover:border-accent/30 rounded-lg transition-all group"
                            >
                                <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-accent" />
                                <span className="text-xs text-slate-300 group-hover:text-white">{skill.skill}</span>
                                <span className="text-[10px] text-emerald-400">{skill.marketDemand}%</span>
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
}

function RolesTab({
    skills,
    calculateRoleProgress,
}: {
    skills: Skill[];
    calculateRoleProgress: (role: Role) => number;
}) {
    const userSkillNames = skills.map(s => s.name.toLowerCase());

    return (
        <motion.div
            key="roles"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
            {ROLES.map((role, idx) => {
                const progress = calculateRoleProgress(role);
                const missing = role.requiredSkills.filter(req => 
                    !userSkillNames.some(u => req.toLowerCase().includes(u))
                );

                return (
                    <motion.div
                        key={role.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-card border border-border rounded-2xl p-5"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${
                                    role.growth === "hot" ? "bg-emerald-500/10" :
                                    role.growth === "emerging" ? "bg-amber-500/10" : "bg-slate-500/10"
                                }`}>
                                    <role.icon className={`w-5 h-5 ${
                                        role.growth === "hot" ? "text-emerald-400" :
                                        role.growth === "emerging" ? "text-amber-400" : "text-slate-400"
                                    }`} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-200">{role.title}</h4>
                                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                                        role.growth === "hot" ? "bg-emerald-500/10 text-emerald-400" :
                                        role.growth === "emerging" ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"
                                    }`}>
                                        {role.growth === "hot" ? "🔥 Hot" : role.growth === "emerging" ? "⭐ Emerging" : "📊 Stable"}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-accent">{role.marketDemand}%</p>
                                <p className="text-[10px] text-slate-500">demanda</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 mb-4">{role.description}</p>

                        {/* Progress */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-slate-500">Compatibility</span>
                                <span className={`text-xs font-bold ${
                                    progress >= 75 ? "text-emerald-400" :
                                    progress >= 50 ? "text-amber-400" : "text-slate-400"
                                }`}>
                                    {progress}%
                                </span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ delay: idx * 0.1 + 0.2 }}
                                    className={`h-full ${
                                        progress >= 75 ? "bg-emerald-500" :
                                        progress >= 50 ? "bg-amber-500" : "bg-slate-500"
                                    }`}
                                />
                            </div>
                        </div>

                        {/* Required Skills */}
                        <div className="space-y-1.5">
                            {role.requiredSkills.map((req) => {
                                const has = userSkillNames.some(u => req.toLowerCase().includes(u));
                                return (
                                    <div key={req} className="flex items-center gap-2">
                                        {has ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        ) : (
                                            <Circle className="w-3.5 h-3.5 text-slate-600" />
                                        )}
                                        <span className={`text-xs ${has ? "text-slate-300" : "text-slate-500"}`}>
                                            {req}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {missing.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/5">
                                <p className="text-[10px] text-slate-500 mb-2">Para completar:</p>
                                <div className="flex flex-wrap gap-1">
                                    {missing.map((m) => (
                                        <span key={m} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] rounded">
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                );
            })}
        </motion.div>
    );
}

function AddSkillModal({
    onClose,
    onAdd,
    existingSkills,
    searchTerm,
    setSearchTerm,
}: {
    onClose: () => void;
    onAdd: (skill: Omit<Skill, "id">) => void;
    existingSkills: string[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
}) {
    const [customSkill, setCustomSkill] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("technical");

    const filteredSuggestions = SUGGESTED_SKILLS.filter(s => 
        s.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !existingSkills.map(e => e.toLowerCase()).includes(s.toLowerCase())
    );

    const handleAdd = (name: string, category?: string) => {
        onAdd({
            name,
            level: 30,
            category: category || selectedCategory,
            marketDemand: 60,
            yearsExperience: 0,
            lastUsed: new Date().toISOString().slice(0, 7),
        });
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-card border border-border rounded-2xl p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Agregar Skill</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar skill..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
                    />
                </div>

                {/* Suggestions */}
                {filteredSuggestions.length > 0 && (
                    <div className="mb-4">
                        <p className="text-[10px] text-slate-500 uppercase mb-2">Sugerencias</p>
                        <div className="flex flex-wrap gap-2">
                            {filteredSuggestions.slice(0, 8).map((skill) => (
                                <button
                                    key={skill}
                                    onClick={() => handleAdd(skill)}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-accent/10 border border-white/10 hover:border-accent/30 rounded-lg text-xs text-slate-300 hover:text-white transition-all"
                                >
                                    {skill}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Custom Skill */}
                <div className="border-t border-white/5 pt-4">
                    <p className="text-[10px] text-slate-500 uppercase mb-2">Skill personalizado</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={customSkill}
                            onChange={(e) => setCustomSkill(e.target.value)}
                            placeholder="Nombre del skill..."
                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
                            onKeyDown={(e) => e.key === "Enter" && customSkill && handleAdd(customSkill)}
                        />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 focus:border-accent/50 focus:outline-none"
                        >
                            {CATEGORIES.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.label}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => customSkill && handleAdd(customSkill, selectedCategory)}
                            disabled={!customSkill}
                            className="px-4 py-2 bg-accent text-white text-sm font-bold rounded-lg hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Agregar
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Icons needed
function Code2(props: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
        </svg>
    );
}

function Server(props: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
            <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
            <line x1="6" x2="6.01" y1="6" y2="6" />
            <line x1="6" x2="6.01" y1="18" y2="18" />
        </svg>
    );
}

function Database(props: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5V19A9 3 0 0 0 21 19V5" />
            <path d="M3 12A9 3 0 0 0 21 12" />
        </svg>
    );
}
