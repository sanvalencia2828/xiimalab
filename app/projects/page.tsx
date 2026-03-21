"use client";

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { FolderKanban } from "lucide-react";
import ProjectCard, { type ProjectCardProps } from "@/components/ProjectCard";
import ProjectHackathonPanel from "@/components/ProjectHackathonPanel";

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
];

export default function ProjectsPage() {
    const [selectedProject, setSelectedProject] = useState<ProjectCardProps | null>(null);

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

            <div className="flex gap-6 items-start">
                {/* Project grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-w-0"
                >
                    {PROJECTS.map((project) => (
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
                                <ProjectCard {...project} />
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
