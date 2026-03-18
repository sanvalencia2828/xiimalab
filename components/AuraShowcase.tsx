"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, ExternalLink, GitBranch, Terminal, Star, GitCommit, TrendingUp } from "lucide-react";
import ProjectCard from "@/components/ProjectCard";

// -------------------------------------------------------
// GITHUB REPO CONFIG
// -------------------------------------------------------
const GITHUB_REPO = "sanvalencia2828/RedimensionAI";
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}`;

// -------------------------------------------------------
// TYPES
// -------------------------------------------------------
interface AuraProject {
    title: string;
    subtitle: string;
    description: string;
    dockerActive: boolean;
    stack: string[];
    metrics: Record<string, string | number>;
}

interface AuraShowcaseProps {
    project: AuraProject;
}

interface GitHubStats {
    stars: number;
    forks: number;
    language: string | null;
}

interface SkillDemand {
    id: number;
    label: string;
    sublabel: string | null;
    user_score: number;
    market_demand: number;
    color: string;
}

// -------------------------------------------------------
// SKILLS HOOK — fetches from /api/skills → FastAPI
// -------------------------------------------------------
function useSkillDemands(): SkillDemand[] {
    const [skills, setSkills] = useState<SkillDemand[]>([]);

    useEffect(() => {
        fetch("/api/skills")
            .then((r) => r.json())
            .then((data: SkillDemand[]) => setSkills(data.slice(0, 6)))
            .catch(() => null);
    }, []);

    return skills;
}

// -------------------------------------------------------
// GITHUB STATS HOOK
// -------------------------------------------------------
function useGitHubStats(): GitHubStats | null {
    const [stats, setStats] = useState<GitHubStats | null>(null);

    useEffect(() => {
        fetch(GITHUB_API, {
            headers: { Accept: "application/vnd.github+json" },
            cache: "force-cache",
        })
            .then((r) => r.json())
            .then((data) =>
                setStats({
                    stars: data.stargazers_count ?? 0,
                    forks: data.forks_count ?? 0,
                    language: data.language ?? null,
                })
            )
            .catch(() => null);
    }, []);

    return stats;
}

// -------------------------------------------------------
// COMPONENT
// -------------------------------------------------------
export default function AuraShowcase({ project }: AuraShowcaseProps) {
    const ghStats = useGitHubStats();
    const skills = useSkillDemands();

    return (
        <div className="relative">
            {/* Ambient glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 via-sky-400/10 to-transparent rounded-2xl blur-xl opacity-60 pointer-events-none" />

            <div className="relative">
                {/* Hero banner */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-gradient-to-br from-card via-[#0d1a2b] to-card border border-accent/20 rounded-2xl p-6 mb-4 overflow-hidden relative"
                >
                    {/* Background grid */}
                    <div
                        className="absolute inset-0 opacity-5"
                        style={{
                            backgroundImage: `linear-gradient(rgba(125,211,252,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.3) 1px, transparent 1px)`,
                            backgroundSize: "32px 32px",
                        }}
                    />
                    {/* Floating brain */}
                    <div className="absolute -right-4 -top-4 opacity-5">
                        <Brain className="w-40 h-40 text-accent" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <Brain className="w-5 h-5 text-accent" />
                            <span className="text-xs font-semibold text-accent uppercase tracking-widest">
                                Proyecto Insignia
                            </span>
                        </div>

                        <h2 className="text-2xl font-extrabold gradient-text mb-1">{project.title}</h2>
                        <p className="text-sm text-accent-dim font-medium mb-3">{project.subtitle}</p>
                        <p className="text-sm text-slate-400 leading-relaxed max-w-lg">{project.description}</p>

                        {/* Live GitHub stats */}
                        {ghStats && (
                            <div className="flex items-center gap-4 mt-3">
                                <span className="flex items-center gap-1.5 text-xs text-yellow-400 font-medium">
                                    <Star className="w-3.5 h-3.5" />
                                    {ghStats.stars.toLocaleString()} stars
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                    <GitCommit className="w-3.5 h-3.5" />
                                    {ghStats.forks} forks
                                </span>
                                {ghStats.language && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
                                        {ghStats.language}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Action row */}
                        <div className="flex items-center gap-3 mt-5">
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-background text-xs font-bold shadow-glow hover:shadow-glow-strong transition-shadow"
                            >
                                <Terminal className="w-3.5 h-3.5" />
                                Abrir consola
                            </motion.button>

                            {/* LIVE GitHub link */}
                            <motion.a
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-slate-200 text-xs font-medium hover:bg-card-hover transition-colors"
                            >
                                <GitBranch className="w-3.5 h-3.5" />
                                Ver en GitHub
                            </motion.a>

                            <motion.a
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.97 }}
                                className="ml-auto flex items-center gap-1.5 text-xs text-accent hover:text-accent-bright transition-colors"
                            >
                                Demo en vivo
                                <ExternalLink className="w-3 h-3" />
                            </motion.a>
                        </div>
                    </div>
                </motion.div>

                {/* Real-time Skills from DB */}
                {skills.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="bg-card border border-border rounded-2xl p-5 mb-4"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-accent" />
                            <span className="text-xs font-semibold text-accent uppercase tracking-widest">
                                Habilidades en Tiempo Real
                            </span>
                        </div>
                        <div className="space-y-3">
                            {skills.map((skill) => (
                                <div key={skill.id}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-medium text-slate-300">{skill.label}</span>
                                        <span className="text-xs text-muted-text">
                                            {skill.user_score}% · demanda {skill.market_demand}%
                                        </span>
                                    </div>
                                    <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                                        <motion.div
                                            className="absolute inset-y-0 left-0 rounded-full"
                                            style={{ backgroundColor: skill.color }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${skill.user_score}%` }}
                                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                                        />
                                        <motion.div
                                            className="absolute inset-y-0 left-0 rounded-full opacity-30"
                                            style={{ backgroundColor: skill.color }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${skill.market_demand}%` }}
                                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Project Card underneath */}
                <ProjectCard
                    title={project.title}
                    description={project.description}
                    status="active"
                    stack={project.stack}
                    dockerActive={project.dockerActive}
                    metrics={project.metrics}
                    accentColor="#7dd3fc"
                />
            </div>
        </div>
    );
}
