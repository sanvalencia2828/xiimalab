"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, Clock, ExternalLink, Github } from "lucide-react";

export type ProjectStatus = "active" | "in-development" | "paused" | "completed";

export interface ProjectCardProps {
    title: string;
    description: string;
    status: ProjectStatus;
    stack: string[];
    dockerActive?: boolean;
    metrics?: Record<string, string | number>;
    url?: string;
    repo?: string;
    accentColor?: string;
    className?: string;
    githubUrl?: string;
    liveUrl?: string;
    onStatusChange?: (newStatus: ProjectStatus) => void;
}

const statusConfig: Record<
    ProjectStatus,
    { label: string; icon: React.ElementType; dotClass: string; textClass: string; borderClass: string }
> = {
    active: {
        label: "Active",
        icon: CheckCircle2,
        dotClass: "bg-emerald-400",
        textClass: "text-emerald-400",
        borderClass: "border-emerald-500/30",
    },
    "in-development": {
        label: "In Development",
        icon: Clock,
        dotClass: "bg-amber-400",
        textClass: "text-amber-400",
        borderClass: "border-amber-500/30",
    },
    paused: {
        label: "Paused",
        icon: Circle,
        dotClass: "bg-slate-400",
        textClass: "text-slate-400",
        borderClass: "border-slate-500/30",
    },
    completed: {
        label: "Completed",
        icon: CheckCircle2,
        dotClass: "bg-sky-400",
        textClass: "text-sky-400",
        borderClass: "border-sky-500/30",
    },
};

const stackColors: Record<string, string> = {
    Python: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    Docker: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    FastAPI: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    OpenCV: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    Blockchain: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    Stellar: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    Avalanche: "bg-red-500/15 text-red-300 border-red-500/30",
    TypeScript: "bg-blue-600/15 text-blue-300 border-blue-600/30",
    "Next.js": "bg-white/10 text-white border-white/20",
    "AI Model Parameters": "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

const defaultPillColor = "bg-slate-700/50 text-slate-300 border-slate-600/30";

export default function ProjectCard({
    title,
    description,
    status: initialStatus,
    stack,
    dockerActive = false,
    metrics,
    url,
    repo,
    accentColor = "#7dd3fc",
    className = "",
    githubUrl,
    liveUrl,
    onStatusChange,
}: ProjectCardProps) {
    const cfg = statusConfig[initialStatus];
    const StatusIcon = cfg.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{
                y: -4,
                boxShadow: `0 8px 40px rgba(125, 211, 252, 0.2)`,
                transition: { duration: 0.2, ease: "easeOut" },
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`card-premium p-6 cursor-default group relative overflow-hidden ${className}`}
            style={{ borderColor: `${accentColor}18` }}
        >
            <div
                className="absolute top-0 left-0 right-0 h-px opacity-60"
                style={{
                    background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)`,
                }}
            />

            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-white tracking-tight mb-0.5">{title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">{description}</p>
                </div>

                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.textClass} ${cfg.borderClass} bg-opacity-10`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass} ${initialStatus === "active" ? "animate-pulse" : ""}`} />
                    <StatusIcon className="w-3 h-3" />
                    <span>{cfg.label}</span>
                </div>
            </div>

            {dockerActive && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 glow-success"
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span className="text-xs font-semibold text-emerald-400 tracking-wide">
                        Docker Container: Active
                    </span>
                    <span className="ml-auto text-xs text-emerald-600">●●●</span>
                </motion.div>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
                {stack.map((tech) => (
                    <span
                        key={tech}
                        className={`text-xs px-2.5 py-1 rounded-md border font-medium ${stackColors[tech] ?? defaultPillColor
                            }`}
                    >
                        {tech}
                    </span>
                ))}
            </div>

            {metrics && (
                <div className="pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-2 mb-4">
                    {Object.entries(metrics).map(([key, value]) => (
                        <div key={key} className="text-center card-premium rounded-lg p-2">
                            <p className="text-sm font-bold text-white">{value}</p>
                            <p className="text-[10px] text-muted-text capitalize mt-0.5">{key}</p>
                        </div>
                    ))}
                </div>
            )}

            {(url || repo) && (
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                    {url && (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm group/link"
                        >
                            <span>Live Project</span>
                            <ExternalLink className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                        </a>
                    )}
                    {repo && (
                        <a
                            href={repo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost flex items-center justify-center p-2"
                            title="Ver Código"
                        >
                            <Github className="w-4 h-4" />
                        </a>
                    )}
                </div>
            )}
        </motion.div>
    );
}
