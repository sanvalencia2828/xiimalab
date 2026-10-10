"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronDown, Circle, ListChecks } from "lucide-react";
import type { ProjectProgress } from "@/lib/projects/progress";

interface Props {
    progress?: ProjectProgress | null;
    loading?: boolean;
    accentColor?: string;
}

function barColor(p: ProjectProgress): string {
    if (p.complete) return "#4ac07b";       // success
    if (p.percent >= 60) return "#5ea5ff";  // accent
    if (p.percent >= 30) return "#e2a747";  // warning
    return "#e05f5f";                       // danger
}

export default function ProjectProgressPanel({ progress, loading }: Props) {
    const [open, setOpen] = useState(false);

    if (loading) {
        return (
            <div className="pt-4 border-t border-white/[0.06] mb-4">
                <div className="h-3 w-28 rounded skeleton mb-2" />
                <div className="h-1.5 w-full rounded skeleton" />
            </div>
        );
    }
    if (!progress) return null;

    if (progress.error) {
        return (
            <div className="pt-4 border-t border-white/[0.06] mb-4 flex items-center gap-2 text-xs text-muted-text">
                <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />
                No se pudo medir el avance: {progress.error}
            </div>
        );
    }

    const color = barColor(progress);
    const methodLabel =
        progress.method === "roadmap"
            ? `${progress.roadmap.done}/${progress.roadmap.total} tareas de ${progress.roadmap.file}`
            : "según preparación del repo";

    return (
        <div className="pt-4 border-t border-white/[0.06] mb-4">
            <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs text-muted-text">
                    Avance · <span className="text-slate-400">{methodLabel}</span>
                </span>
                <span className="text-sm font-bold font-mono" style={{ color }}>
                    {progress.percent}%
                </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.percent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </div>

            {progress.pending.length > 0 && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
                    className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
                    aria-expanded={open}
                >
                    <ListChecks className="w-3.5 h-3.5" />
                    Qué falta ({progress.pending.length})
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
            )}

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ul className="mt-2 space-y-1.5">
                            {progress.checks.map((c) => (
                                <li key={c.id} className="flex items-start gap-2 text-xs">
                                    {c.passed
                                        ? <CheckCircle2 className="w-3.5 h-3.5 mt-px text-success shrink-0" />
                                        : <Circle className="w-3.5 h-3.5 mt-px text-muted-text shrink-0" />}
                                    <span className={c.passed ? "text-slate-500 line-through decoration-slate-600" : "text-slate-300"}>
                                        {c.passed ? c.label : c.todo}
                                        <span className="text-muted-text"> · {c.weight} pts</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {progress.roadmap.pending.length > 0 && (
                            <>
                                <p className="mt-3 mb-1 text-[10px] uppercase tracking-widest text-muted-text">
                                    Tareas pendientes del roadmap
                                </p>
                                <ul className="space-y-1">
                                    {progress.roadmap.pending.slice(0, 12).map((t, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                            <Circle className="w-3 h-3 mt-0.5 text-muted-text shrink-0" />
                                            {t.text}
                                        </li>
                                    ))}
                                    {progress.roadmap.pending.length > 12 && (
                                        <li className="text-xs text-muted-text pl-5">
                                            y {progress.roadmap.pending.length - 12} más…
                                        </li>
                                    )}
                                </ul>
                            </>
                        )}
                        {progress.days_since_push !== null && (
                            <p className="mt-3 text-[10px] text-muted-text">
                                Último push hace {progress.days_since_push} día(s)
                            </p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
