"use client";

<<<<<<< HEAD
import { motion, type Variants } from "framer-motion";
import { FolderKanban } from "lucide-react";
import ProjectCard, { type ProjectCardProps } from "@/components/ProjectCard";

// -------------------------------------------------------
// ANIMATION VARIANTS — same pattern as app/page.tsx
// -------------------------------------------------------
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
};

const itemVariants: Variants = {
=======
import { motion } from "framer-motion";
import { FolderKanban, Layers } from "lucide-react";
import ProjectCard, { type ProjectCardProps } from "@/components/ProjectCard";
import AgentInsights from "@/components/AgentInsights";

// ─────────────────────────────────────────────
// Datos estáticos de proyectos
// ─────────────────────────────────────────────
const projects: ProjectCardProps[] = [
    {
        title: "AURA",
        description:
            "Motor de resize de imágenes con IA. Redimensiona y optimiza automáticamente para múltiples plataformas sociales aplicando neural style transfer y content-awareness.",
        status: "active" as const,
        stack: ["Python", "Docker", "FastAPI", "OpenCV", "AI Model Parameters"],
        dockerActive: true,
        metrics: { accuracy: "94%", latency: "< 80ms", platforms: 6 },
        accentColor: "#7dd3fc",
        githubUrl: "https://github.com/sanvalencia2828/Aura",
    },
    {
        title: "RedimensionAI",
        description:
            "Optimizador de imágenes para redes sociales. Detecta el contenido principal y genera versiones optimizadas para cada formato con reducción de peso de hasta 70%.",
        status: "completed" as const,
        stack: ["Python", "Next.js", "TypeScript", "Docker"],
        dockerActive: false,
        metrics: { formats: 8, reduction: "70%", speed: "2x" },
        accentColor: "#38bdf8",
        githubUrl: "https://github.com/sanvalencia2828/RedimensionAI",
    },
    {
        title: "Xiimalab",
        description:
            "Hub de inteligencia personal IA + Blockchain. Centraliza proyectos, detecta hackatones en tiempo real con scrapers de DoraHacks y Devfolio, y analiza el match con el mercado.",
        status: "in-development" as const,
        stack: ["Next.js", "TypeScript", "FastAPI", "Blockchain", "Stellar"],
        dockerActive: false,
        metrics: { pages: 5, scrapers: 3, integrations: "MCP" },
        accentColor: "#a78bfa",
        githubUrl: "https://github.com/sanvalencia2828/xiimalab",
        liveUrl: "https://xiimalab.vercel.app",
    },
];

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.2 },
    },
};

const itemVariants = {
>>>>>>> 818308f5dd3f39122c8e46bc57ee372d2f05d9ba
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

<<<<<<< HEAD
// -------------------------------------------------------
// PROJECT DATA
// -------------------------------------------------------
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

// -------------------------------------------------------
// PAGE
// -------------------------------------------------------
export default function ProjectsPage() {
    return (
        <div className="p-6 min-h-screen">
            {/* Header — same motion pattern as app/page.tsx */}
=======
// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function ProjectsPage() {
    const activeCount = projects.filter((p) => p.status === "active").length;
    const completedCount = projects.filter((p) => p.status === "completed").length;
    const inDevCount = projects.filter((p) => p.status === "in-development").length;

    return (
        <div className="p-6 min-h-screen">
            {/* Header */}
>>>>>>> 818308f5dd3f39122c8e46bc57ee372d2f05d9ba
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
<<<<<<< HEAD
                <h1 className="text-3xl font-bold text-white mb-1">
                    Mis <span className="gradient-text">Proyectos</span>
                </h1>
                <p className="text-slate-400 text-sm">
                    Proyectos activos · Stack de IA, DevOps y Blockchain
                </p>
            </motion.div>

            {/* Cards grid — 1 col mobile, 2 cols xl */}
=======
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">
                            Mis{" "}
                            <span className="gradient-text">Proyectos</span>
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Proyectos activos · Completados · En desarrollo
                        </p>
                    </div>

                    {/* Stats pills */}
                    <div className="flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {activeCount} activo{activeCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            {completedCount} completado{completedCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {inDevCount} en desarrollo
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* Section label */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 mb-4"
            >
                <div className="p-1.5 rounded-lg bg-accent/10">
                    <Layers className="w-4 h-4 text-accent" />
                </div>
                <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    Todos los proyectos
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                    {projects.length}
                </span>
            </motion.div>

            {/* Grid */}
>>>>>>> 818308f5dd3f39122c8e46bc57ee372d2f05d9ba
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
<<<<<<< HEAD
                className="grid grid-cols-1 xl:grid-cols-2 gap-6"
            >
                {PROJECTS.map((project) => (
=======
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
            >
                {projects.map((project) => (
>>>>>>> 818308f5dd3f39122c8e46bc57ee372d2f05d9ba
                    <motion.div key={project.title} variants={itemVariants}>
                        <ProjectCard {...project} />
                    </motion.div>
                ))}
            </motion.div>
<<<<<<< HEAD
=======

            {/* Footer hint */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"
            >
                <FolderKanban className="w-3.5 h-3.5" />
                <span>Más proyectos en camino — conecta GitHub para importarlos automáticamente</span>
            </motion.div>

            {/* Agent Crew — oportunidades detectadas */}
            <AgentInsights />
>>>>>>> 818308f5dd3f39122c8e46bc57ee372d2f05d9ba
        </div>
    );
}
