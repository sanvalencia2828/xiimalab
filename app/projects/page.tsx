"use client";

import { motion, type Variants } from "framer-motion";
import { FolderKanban } from "lucide-react";
import ProjectCard, { type ProjectCardProps } from "@/components/ProjectCard";

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
        title: "AURA",
        description: "Intelligent Image Resizing Engine",
        status: "active",
        dockerActive: true,
        stack: ["Python", "Docker", "FastAPI", "OpenCV", "AI Model Parameters"],
        metrics: { accuracy: "94%", latency: "<80ms", platforms: 6 },
        accentColor: "#7dd3fc",
        url: "http://localhost:8001",
        repo: "https://github.com/sanvalencia2828/redimension-ai",
    },
    {
        title: "RedimensionAI",
        description: "Social Media Image Optimizer",
        status: "completed",
        stack: ["Python", "AI Model Parameters", "Docker"],
        metrics: { users: "2K+", uptime: "99.9%", boost: "3x" },
        accentColor: "#a78bfa",
        url: "https://redimension-ai.vercel.app",
        repo: "https://github.com/sanvalencia2828/redimension-ai",
    },
    {
        title: "Xiimalab",
        description: "AI & Blockchain Intelligence Hub",
        status: "in-development",
        stack: ["Next.js", "TypeScript", "Docker", "FastAPI"],
        metrics: { projects: 4, matches: 18, score: "84%" },
        accentColor: "#34d399",
        url: "https://xiimalab.vercel.app",
        repo: "https://github.com/sanvalencia2828/xiimalab",
    },
    {
        title: "Regen-Buddy",
        description: "Virtual Pet AI - Fruterito",
        status: "active",
        stack: ["JavaScript", "HTML5", "CSS3", "OpenAI"],
        metrics: { type: "Virtual Pet", mode: "8-bit" },
        accentColor: "#f59e0b",
        url: "https://regen-buddy.vercel.app",
        repo: "https://github.com/sanvalencia2828/regen-buddy",
    },
];

export default function ProjectsPage() {
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
                </p>
            </motion.div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 xl:grid-cols-2 gap-6"
            >
                {PROJECTS.map((project) => (
                    <motion.div key={project.title} variants={itemVariants}>
                        <ProjectCard {...project} />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
