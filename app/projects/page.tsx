"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { FolderKanban } from "lucide-react";
import ProjectCard, { type ProjectCardProps } from "@/components/ProjectCard";
import ProjectHackathonPanel from "@/components/ProjectHackathonPanel";
import { getProjectsProgressAction } from "@/app/actions/projectProgress";
import type { ProjectProgress } from "@/lib/projects/progress";

type ProgressFilter = "all" | "complete" | "pending";
const FILTERS: { key: ProgressFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Pendientes" },
    { key: "complete", label: "Completos" },
];

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const PROJECTS: ProjectCardProps[] = [
    {
        title: "Xiimalab",
        description: "AI & Blockchain Intelligence Hub — hackathon matching, ML recommendations y staking de habilidades",
        status: "in-development",
        stack: ["Next.js", "TypeScript", "FastAPI", "Docker", "Supabase", "Python"],
        metrics: { pages: 12, apis: "20+", score: "84%" },
        accentColor: "#34d399",
        liveUrl: "https://xiimalab.vercel.app",
        githubUrl: "https://github.com/sanvalencia2828/xiimalab",
    },
    {
        title: "AURA",
        description: "Motor de resize de imágenes con IA — optimiza y redimensiona para redes sociales con engagement analytics",
        status: "active",
        stack: ["TypeScript", "Next.js", "AI/ML", "OpenCV"],
        metrics: { accuracy: "94%", latency: "<80ms", platforms: 6 },
        accentColor: "#7dd3fc",
        githubUrl: "https://github.com/sanvalencia2828/Aura",
    },
    {
        title: "RedimensionAI",
        description: "Social Media Image Optimizer — vibecoding, redimensionado inteligente para múltiples plataformas",
        status: "completed",
        stack: ["TypeScript", "Next.js", "Vercel", "AI"],
        metrics: { uptime: "99.9%", boost: "3x", plataformas: 8 },
        accentColor: "#a78bfa",
        liveUrl: "https://redimension-ai-rho.vercel.app",
        githubUrl: "https://github.com/sanvalencia2828/RedimensionAI",
    },
    {
        title: "Regen-Buddy",
        description: "Fruterito — mascota virtual AI estilo Regenmon con chat inteligente y modo 8-bit",
        status: "active",
        stack: ["HTML5", "JavaScript", "CSS3", "OpenAI"],
        metrics: { tipo: "Virtual Pet", modo: "8-bit", vibe: "regen" },
        accentColor: "#f59e0b",
        liveUrl: "https://regenmon-chat.vercel.app",
        githubUrl: "https://github.com/sanvalencia2828/regen-buddy",
    },
    {
        title: "Pulsar Radar",
        description: "Radar de memecoins de Solana en tiempo real — puntúa potencial y riesgo de cada token desde sus primeros minutos, con mapa visual y alertas",
        status: "active",
        stack: ["Next.js", "TypeScript", "Tailwind", "FastAPI", "DexScreener API", "Solana"],
        metrics: { scores: "2 (0–100)", etapas: 4, refresh: "5s" },
        accentColor: "#ff4524",
        liveUrl: "https://miguelangel213.github.io/pulsar-radar/",
        githubUrl: "https://github.com/miguelangel213/pulsar-radar",
        author: {
            name: "Miguel Ángel",
            handle: "miguelangel213",
            profileUrl: "https://github.com/miguelangel213",
            role: "Creado por",
        },
        license: "MIT",
    },
    {
        title: "Rastreador · Londrina Radar Comercial",
        description: "Plataforma geoespacial open source que rastrea comercios y polos emergentes en Londrina (PR) — heatmap de densidad, clustering de polos y ETL de datos CNPJ, sin APIs comerciales",
        status: "active",
        stack: ["Next.js", "React", "MapLibre GL", "FastAPI", "PostGIS", "Python", "Docker"],
        metrics: { comercios: "2.7k", polos: 5, "apis pagas": 0 },
        accentColor: "#22d3ee",
        githubUrl: "https://github.com/sanvalencia2828/Rastreador",
    },
];

export default function ProjectsPage() {
    const [selectedProject, setSelectedProject] = useState<ProjectCardProps | null>(null);
    const [progress, setProgress] = useState<Record<string, ProjectProgress>>({});
    const [progressLoading, setProgressLoading] = useState(true);
    const [filter, setFilter] = useState<ProgressFilter>("all");
    const [sortByProgress, setSortByProgress] = useState(false);

    // Avance calculado desde GitHub (README, demo, tests, CI, roadmap…)
    useEffect(() => {
        let cancelled = false;
        getProjectsProgressAction(
            PROJECTS.map((p) => ({ title: p.title, githubUrl: p.githubUrl, liveUrl: p.liveUrl })),
        )
            .then((res) => { if (!cancelled) setProgress(res); })
            .catch(() => { /* las tarjetas siguen funcionando sin avance */ })
            .finally(() => { if (!cancelled) setProgressLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // Un proyecto es "completo" si su avance medido llega al umbral o, sin medición, si está marcado como completed
    const isComplete = (p: ProjectCardProps) => {
        const pr = progress[p.title];
        return pr && !pr.error ? pr.complete : p.status === "completed";
    };

    const counts = useMemo(() => {
        const complete = PROJECTS.filter(isComplete).length;
        return { all: PROJECTS.length, complete, pending: PROJECTS.length - complete };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [progress]);

    const avg = useMemo(() => {
        const vals = Object.values(progress).filter((p) => !p.error).map((p) => p.percent);
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    }, [progress]);

    const visible = useMemo(() => {
        let list = PROJECTS.filter((p) =>
            filter === "all" ? true : filter === "complete" ? isComplete(p) : !isComplete(p),
        );
        if (sortByProgress) {
            list = [...list].sort((a, b) => (progress[b.title]?.percent ?? -1) - (progress[a.title]?.percent ?? -1));
        }
        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, sortByProgress, progress]);

    return (
        <div className="p-6 min-h-screen">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-xs font-medium text-accent uppercase tracking-widest">
                        Portafolio
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-1">
                    Mis <span className="gradient-text">Proyectos</span>
                </h1>
                <p className="text-slate-400 text-sm">
                    Proyectos activos · Stack de IA, DevOps y Blockchain
                    {!selectedProject && (
                        <span className="ml-2 text-accent/70">— Click en un proyecto para ver hackatones recomendados ⚡</span>
                    )}
                </p>
            </motion.div>

            {/* Filtro por avance */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                            filter === f.key
                                ? "bg-accent/15 text-accent border-accent/40"
                                : "text-slate-400 border-border hover:text-slate-200 hover:border-muted"
                        }`}
                    >
                        {f.label}
                        <span className="ml-1.5 font-mono text-muted-text">{progressLoading && f.key !== "all" ? "…" : counts[f.key]}</span>
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setSortByProgress((v) => !v)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                        sortByProgress ? "bg-accent/15 text-accent border-accent/40" : "text-slate-400 border-border hover:text-slate-200"
                    }`}
                >
                    Ordenar por avance
                </button>
                {avg !== null && (
                    <span className="ml-auto text-xs text-muted-text">
                        Avance promedio <span className="font-mono text-slate-200">{avg}%</span>
                    </span>
                )}
            </div>

            <div className="flex gap-6 items-start">
                {/* Project grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-w-0"
                >
                    {visible.length === 0 && (
                        <p className="text-sm text-muted-text col-span-full py-10 text-center">
                            No hay proyectos en este filtro.
                        </p>
                    )}
                    {visible.map((project) => (
                        <motion.div
                            key={project.title}
                            variants={itemVariants}
                            onClick={() => setSelectedProject(
                                selectedProject?.title === project.title ? null : project
                            )}
                            className="cursor-pointer"
                        >
                            <div className={`rounded-2xl transition-all duration-200 ${
                                selectedProject?.title === project.title
                                    ? "ring-2 ring-offset-2 ring-offset-background"
                                    : "hover:ring-1 hover:ring-accent/30"
                            }`}
                            style={selectedProject?.title === project.title
                                ? { outline: `2px solid ${project.accentColor ?? "#7dd3fc"}40` }
                                : {}
                            }>
                                <ProjectCard
                                    {...project}
                                    progress={progress[project.title]}
                                    progressLoading={progressLoading && Boolean(project.githubUrl)}
                                />
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Hackathon panel */}
                <AnimatePresence>
                    {selectedProject && (
                        <div className="sticky top-6">
                            <ProjectHackathonPanel
                                projectTitle={selectedProject.title}
                                projectStack={selectedProject.stack}
                                accentColor={selectedProject.accentColor}
                                onClose={() => setSelectedProject(null)}
                            />
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
