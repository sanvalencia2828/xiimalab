"use client";

import { Suspense } from "react";
import AuraShowcase from "@/components/AuraShowcase";
import DoraHacksFeed, { type Hackathon } from "@/components/DoraHacksFeed";
import MarketMatch from "@/components/MarketMatch";
import EcommerceBridge from "@/components/EcommerceBridge";
import { motion, type Variants } from "framer-motion";
import { Zap, Globe, BarChart3, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

// --- Static data (AURA project — not from DB yet) ---
const auraProject = {
    title: "AURA",
    subtitle: "Intelligent Image Resizing Engine",
    description:
        "AI-powered platform that automatically resizes and optimizes images for multiple social media platforms, applying neural style transfer and smart content-awareness.",
    dockerActive: true,
    stack: ["Python", "AI Model Parameters", "Docker", "FastAPI", "OpenCV"],
    metrics: { accuracy: 94, latency: "< 80ms", platforms: 6 },
};

const stats = [
    { icon: Zap, label: "Active Projects", value: "4", color: "text-accent" },
    { icon: Globe, label: "Hackathons Tracked", value: "18", color: "text-purple-400" },
    { icon: BarChart3, label: "Match Score Avg", value: "84%", color: "text-emerald-400" },
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

// ─────────────────────────────────────────────
// Skeleton loader — used while hackathons fetch
// ─────────────────────────────────────────────
function HackathonSkeleton() {
    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-muted" />
                <div className="h-4 w-40 rounded bg-muted" />
            </div>
            {[1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-4 border-b border-border last:border-0">
                    <div className="h-4 w-3/4 rounded bg-muted mb-3" />
                    <div className="flex gap-3 mb-2">
                        <div className="h-3 w-20 rounded bg-muted" />
                        <div className="h-3 w-16 rounded bg-muted" />
                    </div>
                    <div className="flex gap-2">
                        <div className="h-5 w-16 rounded-md bg-muted" />
                        <div className="h-5 w-12 rounded-md bg-muted" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────
// Async hackathon feed — fetches from /api/hackathons
// ─────────────────────────────────────────────
function LiveHackathonFeed() {
    const [hackathons, setHackathons] = useState<Hackathon[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/hackathons")
            .then((r) => r.json())
            .then((data: Hackathon[]) => {
                // API returns snake_case; map to camelCase for the component
                setHackathons(
                    data.map((h: any) => ({
                        id: h.id,
                        title: h.title,
                        prizePool: h.prize_pool ?? h.prizePool,
                        tags: h.tags,
                        deadline: h.deadline,
                        matchScore: h.match_score ?? h.matchScore,
                    }))
                );
            })
            .catch(() => {
                // Silently fall back — the route handler already has a fallback
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <HackathonSkeleton />;
    return <DoraHacksFeed hackathons={hackathons} />;
}

// ─────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────
export default function DashboardPage() {
    return (
        <div className="p-6 min-h-screen">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-xs font-medium text-accent uppercase tracking-widest">
                        Sistema activo
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-1">
                    Intelligence{" "}
                    <span className="gradient-text">Dashboard</span>
                </h1>
                <p className="text-slate-400 text-sm">
                    Centralizando proyectos · Detectando oportunidades · Acelerando el match
                </p>
            </motion.div>

            {/* Quick Stats bar */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-3 gap-4 mb-8"
            >
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            variants={itemVariants}
                            className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 glow-accent"
                        >
                            <div className="p-2 rounded-lg bg-muted">
                                <Icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stat.value}</p>
                                <p className="text-xs text-muted-text">{stat.label}</p>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* 2-column grid */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
                {/* Central Feed */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    <motion.section variants={itemVariants}>
                        <SectionHeader
                            label="Proyecto Destacado"
                            badge="AURA"
                            badgeColor="bg-accent/10 text-accent border border-accent/20"
                        />
                        <AuraShowcase project={auraProject} />
                    </motion.section>

                    <motion.section variants={itemVariants}>
                        <SectionHeader
                            label="Hackatones DoraHacks"
                            badge="Bot activo"
                            badgeColor="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        />
                        {/* LiveHackathonFeed handles its own loading state */}
                        <LiveHackathonFeed />
                    </motion.section>
                </motion.div>

                {/* Right Intelligence Panel */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    <motion.section variants={itemVariants}>
                        <SectionHeader
                            label="Market Match"
                            badge="Analítica"
                            badgeColor="bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        />
                        <MarketMatch />
                    </motion.section>

                    <motion.section variants={itemVariants}>
                        <SectionHeader
                            label="Xiima Ecommerce"
                            badge="Próximamente"
                            badgeColor="bg-warning/10 text-warning border border-warning/20"
                        />
                        <EcommerceBridge />
                    </motion.section>
                </motion.div>
            </div>
        </div>
    );
}

// Helper component
function SectionHeader({
    label,
    badge,
    badgeColor,
}: {
    label: string;
    badge: string;
    badgeColor: string;
}) {
    return (
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                {label}
            </h2>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeColor}`}>
                {badge}
            </span>
        </div>
    );
}
