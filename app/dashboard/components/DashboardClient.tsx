"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { CalendarCheck, Layers, Loader2, Sparkles, Target } from "lucide-react";
import { getDashboardAction } from "@/app/actions/dashboard";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import type { DashboardData } from "@/lib/dashboard/types";
import { readHackathonAction } from "@/lib/hackathons/actions";
import {
    AchievementsSection, DemandRanking, PracticeSection, ProjectsSection, SkillsMap, TracksSection, WalletCard,
} from "./Sections";

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

function SummaryCards({ data }: { data: DashboardData }) {
    const { summary } = data;
    const noTracks = summary.activeTracks === 0;
    const cards = [
        {
            title: "Avance global",
            value: noTracks ? "—" : `${summary.percent} %`,
            description: noTracks ? "Sin tracks activos" : `${summary.done} de ${summary.total} hitos de tus tracks activos`,
            icon: Target,
        },
        {
            title: "Tracks activos",
            value: String(summary.activeTracks),
            description: noTracks ? "Elige uno en el roadmap" : "Elegidos o con hitos hechos",
            icon: Layers,
        },
        {
            title: "Hitos esta semana",
            value: String(summary.milestonesThisWeek),
            description: "Completados en los últimos 7 días",
            icon: CalendarCheck,
        },
        {
            title: "Skills demostradas",
            value: String(summary.demonstratedSkills),
            description: "Con evidencia en tus proyectos",
            icon: Sparkles,
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(({ title, value, description, icon: Icon }) => (
                <motion.div key={title} variants={itemVariants} className="card-premium p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Icon className="w-4 h-4 text-accent" />
                        <span className="text-xs text-muted-text font-medium">{title}</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-200 font-mono">{value}</p>
                    <p className="text-xs text-muted-text mt-1">{description}</p>
                </motion.div>
            ))}
        </div>
    );
}

export default function DashboardClient() {
    const { state, loaded, toggleMilestone } = useLearningProgress();
    const [data, setData] = useState<DashboardData | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    // El avance y la acción sobre una hackatón viven en el navegador: se envían al servidor, que devuelve el dashboard ya calculado
    useEffect(() => {
        if (!loaded) return;
        let cancelled = false;
        getDashboardAction(state, readHackathonAction())
            .then((next) => {
                if (cancelled) return;
                setData(next);
                setFailed(false);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [loaded, state, attempt]);

    if (!data) {
        return failed ? (
            <div className="card-premium p-8 text-center">
                <p className="text-sm text-slate-200 mb-1">No se pudo calcular el dashboard.</p>
                <p className="text-xs text-muted-text mb-4">Tu avance sigue guardado en este navegador.</p>
                <button type="button" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }} className="btn-primary">
                    Reintentar
                </button>
            </div>
        ) : (
            <div className="card-premium p-12 flex flex-col items-center justify-center" role="status">
                <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
                <p className="text-sm text-muted-text">Calculando tu avance con datos de GitHub y de las hackatones abiertas…</p>
            </div>
        );
    }

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            <SummaryCards data={data} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <motion.div variants={itemVariants}>
                        <TracksSection data={data} onMarkMilestone={toggleMilestone} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <ProjectsSection projects={data.projects} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <SkillsMap data={data} />
                    </motion.div>
                </div>

                <div className="space-y-6">
                    <motion.div variants={itemVariants}>
                        <DemandRanking ranking={data.ranking} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <PracticeSection data={data} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <WalletCard />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <AchievementsSection achievements={data.achievements} />
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
}
