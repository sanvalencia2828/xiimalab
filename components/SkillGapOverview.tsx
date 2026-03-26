"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    AlertCircle, 
    TrendingUp, 
    BookOpen, 
    Zap, 
    ChevronDown,
    Award,
    Clock,
    Target,
    Lightbulb,
    ExternalLink,
    Loader2,
    Brain,
} from "lucide-react";
import { getLearningResourcesAction } from "@/app/actions/learning";
import type { LearningResourcesResponse } from "@/app/actions/learning";

interface SkillGapOverviewProps {
    missingSkills: string[];
    hackathonTags?: string[];
    matchScore?: number;
    isExpanded?: boolean;
}

// Mapeo de skills a dificultad y recurso
const SKILL_METADATA: Record<string, { difficulty: "Foundation" | "Intermediate" | "Advanced"; category: string; timeToDays: number }> = {
    // Foundation - 5-7 días
    "HTML/CSS": { difficulty: "Foundation", category: "Frontend", timeToDays: 5 },
    "JavaScript": { difficulty: "Foundation", category: "Frontend", timeToDays: 7 },
    "Python": { difficulty: "Foundation", category: "Backend", timeToDays: 7 },
    "Git": { difficulty: "Foundation", category: "DevOps", timeToDays: 3 },
    "REST API": { difficulty: "Foundation", category: "Backend", timeToDays: 5 },
    "SQL": { difficulty: "Foundation", category: "Database", timeToDays: 5 },
    
    // Intermediate - 14-21 días
    "React": { difficulty: "Intermediate", category: "Frontend", timeToDays: 14 },
    "TypeScript": { difficulty: "Intermediate", category: "Frontend", timeToDays: 14 },
    "Node.js": { difficulty: "Intermediate", category: "Backend", timeToDays: 14 },
    "Express": { difficulty: "Intermediate", category: "Backend", timeToDays: 10 },
    "PostgreSQL": { difficulty: "Intermediate", category: "Database", timeToDays: 12 },
    "Docker": { difficulty: "Intermediate", category: "DevOps", timeToDays: 10 },
    "API Design": { difficulty: "Intermediate", category: "Backend", timeToDays: 7 },
    
    // Advanced - 21+ días
    "Solidity": { difficulty: "Advanced", category: "Blockchain", timeToDays: 21 },
    "Smart Contracts": { difficulty: "Advanced", category: "Blockchain", timeToDays: 21 },
    "IPFS": { difficulty: "Advanced", category: "Web3", timeToDays: 14 },
    "Hardhat": { difficulty: "Advanced", category: "Blockchain", timeToDays: 14 },
    "Web3.js": { difficulty: "Advanced", category: "Web3", timeToDays: 14 },
    "Stellar": { difficulty: "Advanced", category: "Blockchain", timeToDays: 14 },
    "Machine Learning": { difficulty: "Advanced", category: "AI/ML", timeToDays: 21 },
    "TensorFlow": { difficulty: "Advanced", category: "AI/ML", timeToDays: 21 },
    "Kubernetes": { difficulty: "Advanced", category: "DevOps", timeToDays: 21 },
};

const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
        case "Foundation":
            return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
        case "Intermediate":
            return "bg-amber-500/10 text-amber-300 border-amber-500/20";
        case "Advanced":
            return "bg-red-500/10 text-red-300 border-red-500/20";
        default:
            return "bg-slate-500/10 text-slate-300 border-slate-500/20";
    }
};

// Componente pequeño de brain para imports
const BrainCircuit = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
        <circle cx="12" cy="12" r="1" />
        <path d="M12 2v2m7.07 7.07h-2" />
        <path d="M18.36 5.64l-1.414 1.414" />
        <path d="M20 12h2M2 12h2" />
        <path d="M5.64 5.64l1.414 1.414" />
        <path d="M12 20v2m-7.07-7.07h-2" />
        <path d="M5.64 18.36l1.414-1.414" />
        <path d="M18.36 18.36l-1.414-1.414" />
    </svg>
);

const getCategoryIcon = (category: string) => {
    const icons: Record<string, typeof BookOpen> = {
        Frontend: Lightbulb,
        Backend: Zap,
        DevOps: TrendingUp,
        Database: Award,
        Blockchain: Target,
        Web3: Target,
        "AI/ML": Brain,
    };
    return icons[category] || BookOpen;
};

export default function SkillGapOverview({
    missingSkills,
    hackathonTags = [],
    matchScore = 0,
    isExpanded: initialExpanded = false,
}: SkillGapOverviewProps) {
    const [isExpanded, setIsExpanded] = useState(initialExpanded);
    const [selectedDifficulty, setSelectedDifficulty] = useState<"All" | "Foundation" | "Intermediate" | "Advanced">("All");
    const [showResources, setShowResources] = useState(false);
    const [resources, setResources] = useState<LearningResourcesResponse | null>(null);
    const [loadingResources, setLoadingResources] = useState(false);

    const handleLoadResources = async () => {
        if (resources) {
            setShowResources(!showResources);
            return;
        }

        setLoadingResources(true);
        try {
            const data = await getLearningResourcesAction(missingSkills);
            setResources(data);
            setShowResources(true);
        } catch (err) {
            console.error("Error loading resources:", err);
        } finally {
            setLoadingResources(false);
        }
    };

    // Enriquecer skills con metadata
    const enrichedSkills = missingSkills.map((skill) => ({
        name: skill,
        ...SKILL_METADATA[skill] || { difficulty: "Intermediate", category: "General", timeToDays: 14 },
    }));

    // Agrupar por dificultad
    const groupedByDifficulty = enrichedSkills.reduce(
        (acc, skill) => {
            if (!acc[skill.difficulty]) acc[skill.difficulty] = [];
            acc[skill.difficulty].push(skill);
            return acc;
        },
        {} as Record<string, typeof enrichedSkills>
    );

    // Filtrar si hay selección
    const filteredSkills = selectedDifficulty === "All" 
        ? enrichedSkills 
        : (groupedByDifficulty[selectedDifficulty] || []);

    // Calcular días totales estimados
    const totalDays = filteredSkills.reduce((sum, skill) => sum + skill.timeToDays, 0);
    const hoursPerDay = 3; // asumiendo 3 horas/día de estudio
    const weeksToCover = Math.ceil((totalDays * hoursPerDay) / (5 * 4)); // 5 horas/día, 5 días/semana

    if (!missingSkills || missingSkills.length === 0) {
        return (
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-emerald-300">¡Excelente Match!</p>
                        <p className="text-xs text-emerald-200/80 mt-1">
                            Tienes todas las skills necesarias para este hackathon.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            className="bg-slate-900/40 border border-slate-700/40 rounded-xl overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {/* Header - siempre visible */}
            <motion.button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-white">
                            Skills para aprender
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {missingSkills.length} skill{missingSkills.length !== 1 ? "s" : ""} identificada{missingSkills.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                </motion.div>
            </motion.button>

            {/* Contenido expandible */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-slate-700/40 overflow-hidden"
                    >
                        <div className="p-4 space-y-4">
                            {/* Estimación de tiempo */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        <span className="text-xs font-semibold text-blue-300">Tiempo estimado</span>
                                    </div>
                                    <p className="text-sm font-bold text-white">{weeksToCover} semanas</p>
                                    <p className="text-xs text-blue-200/60">{totalDays} días (3h/día)</p>
                                </div>
                                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp className="w-4 h-4 text-purple-400" />
                                        <span className="text-xs font-semibold text-purple-300">Impacto potencial</span>
                                    </div>
                                    <p className="text-sm font-bold text-white">+{Math.round((missingSkills.length * 3))}%</p>
                                    <p className="text-xs text-purple-200/60">en tu match score</p>
                                </div>
                            </div>

                            {/* Filtros por dificultad */}
                            <div className="flex gap-2 flex-wrap">
                                {["All", "Foundation", "Intermediate", "Advanced"].map((diff) => (
                                    <motion.button
                                        key={diff}
                                        onClick={() => setSelectedDifficulty(diff as any)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            selectedDifficulty === diff
                                                ? "bg-accent text-white border border-accent/50"
                                                : "bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:border-slate-600"
                                        }`}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {diff}
                                    </motion.button>
                                ))}
                            </div>

                            {/* Lista de skills */}
                            <div className="space-y-2">
                                {filteredSkills.length > 0 ? (
                                    filteredSkills.map((skill, idx) => (
                                        <motion.div
                                            key={skill.name}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/40 hover:border-slate-600/60 transition-all group"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-white text-sm group-hover:text-accent transition-colors">
                                                            {skill.name}
                                                        </span>
                                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${getDifficultyColor(skill.difficulty)}`}>
                                                            {skill.difficulty}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                                        <span className="flex items-center gap-1">
                                                            📚 {skill.category}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            ⏱ {skill.timeToDays}d
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <p className="text-center text-sm text-slate-400 py-4">
                                        No hay skills en esta categoría
                                    </p>
                                )}
                            </div>

                            {/* Learning path recomendado */}
                            <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                                <div className="flex items-start gap-2">
                                    <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-accent mb-1">Ruta de aprendizaje recomendada</p>
                                        <ol className="text-xs text-slate-300 space-y-1">
                                            <li>
                                                <span className="text-accent font-semibold">1.</span> Domina las skills <span className="text-emerald-400 font-medium">Foundation</span> primero
                                            </li>
                                            <li>
                                                <span className="text-accent font-semibold">2.</span> Después practica con <span className="text-amber-400 font-medium">Intermediate</span>
                                            </li>
                                            <li>
                                                <span className="text-accent font-semibold">3.</span> Finaliza con desafíos <span className="text-red-400 font-medium">Advanced</span>
                                            </li>
                                            <li>
                                                <span className="text-accent font-semibold">4.</span> Aplica todo en el hackathon 🚀
                                            </li>
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            {/* CTA */}
                            <motion.button
                                onClick={handleLoadResources}
                                disabled={loadingResources}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent font-semibold text-sm hover:bg-accent/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loadingResources ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Cargando recursos...
                                    </>
                                ) : (
                                    <>
                                        Ver recursos de aprendizaje →
                                    </>
                                )}
                            </motion.button>

                            {/* Learning Resources Section */}
                            <AnimatePresence>
                                {showResources && resources && resources.resources.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="border-t border-slate-700/40 mt-4 pt-4"
                                    >
                                        <h4 className="text-sm font-bold text-white mb-3">📚 Recursos Recomendados</h4>
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                            {resources.resources.map((skillRes, idx) => (
                                                <motion.div
                                                    key={skillRes.skill}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/40"
                                                >
                                                    <h5 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
                                                        <span>{skillRes.skill}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-md border ${getDifficultyColor(skillRes.difficulty)}`}>
                                                            {skillRes.difficulty}
                                                        </span>
                                                    </h5>

                                                    {/* Courses */}
                                                    {skillRes.resources.courses && skillRes.resources.courses.length > 0 && (
                                                        <div className="mb-2">
                                                            <p className="text-xs text-accent font-semibold mb-1">Cursos:</p>
                                                            <div className="space-y-1">
                                                                {skillRes.resources.courses.slice(0, 2).map((course, i) => (
                                                                    <a
                                                                        key={i}
                                                                        href={course.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                        {course.name} ({course.duration || course.type})
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Tutorials */}
                                                    {skillRes.resources.tutorials && skillRes.resources.tutorials.length > 0 && (
                                                        <div className="mb-2">
                                                            <p className="text-xs text-accent font-semibold mb-1">Tutoriales:</p>
                                                            <div className="space-y-1">
                                                                {skillRes.resources.tutorials.slice(0, 2).map((tutorial, i) => (
                                                                    <a
                                                                        key={i}
                                                                        href={tutorial.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                        {tutorial.name}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Projects */}
                                                    {skillRes.resources.projects && skillRes.resources.projects.length > 0 && (
                                                        <div>
                                                            <p className="text-xs text-accent font-semibold mb-1">Proyectos:</p>
                                                            <ul className="text-xs text-slate-400 list-disc list-inside space-y-0.5">
                                                                {skillRes.resources.projects.slice(0, 2).map((project, i) => (
                                                                    <li key={i}>{project}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            ))}
                                        </div>

                                        {/* Summary Stats */}
                                        {resources.total_estimated_hours > 0 && (
                                            <div className="mt-3 p-2 rounded-lg bg-purple-500/5 border border-purple-500/20 text-xs text-purple-200">
                                                ⏱ <strong>{resources.total_estimated_hours}h totales</strong> de estudio estimadas
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
