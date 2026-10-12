"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ClipboardCopy } from "lucide-react";
import { asRoadmapTask } from "@/lib/learning/applications";
import type { Effort, Practice } from "@/lib/learning/tracks";

const EFFORT_LABELS: Record<Effort, string> = { S: "S · una tarde", M: "M · un fin de semana", L: "L · más de una semana" };
const chipClass = "px-1.5 py-0.5 text-[10px] rounded-md border";

interface PracticeCardProps {
    practice: Practice;
    trackId: string;
    trackTitle: string;
    phaseTitle: string;
    /** Línea sobre el título: el proyecto (en un track) o el track y la fase (en un proyecto) */
    heading: ReactNode;
    /** "2 de 4 hitos demostrados aquí", si se conoce */
    progress?: { done: number; total: number };
}

/** Proyecto práctico de una fase para un proyecto: tipo, esfuerzo, título y los pasos desplegables. */
export function PracticeCard({ practice, trackId, trackTitle, phaseTitle, heading, progress }: PracticeCardProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(asRoadmapTask(practice.title, { trackTitle, phaseTitle }));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* sin permiso de portapapeles: el botón no cambia */ }
    };

    return (
        <div className="p-3 rounded-lg border border-border h-full">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-200 mr-1">{heading}</span>
                <span
                    className={`${chipClass} ${
                        practice.type === "Mejora"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-violet-500/10 text-violet-300 border-violet-500/30"
                    }`}
                >
                    {practice.type}
                </span>
                {practice.effort && (
                    <span className={`${chipClass} bg-accent/10 text-accent border-accent/30`} title={EFFORT_LABELS[practice.effort]}>
                        Esfuerzo {practice.effort}
                    </span>
                )}
                {practice.origin !== "Manual" && (
                    <span className={`${chipClass} bg-slate-700/30 text-slate-400 border-slate-600/30`}>
                        {practice.origin === "IA" ? "Sugerida por IA" : "Sugerencia general"}
                    </span>
                )}
            </div>

            <p className="text-sm text-slate-200 mt-1.5 leading-snug">{practice.title}</p>
            {progress && progress.done > 0 && (
                <p className="text-[11px] text-emerald-400 mt-1">
                    {progress.done} de {progress.total} hitos demostrados aquí
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-2">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                    {open ? "Ocultar pasos" : "Ver pasos"}
                    <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-xs text-muted-text hover:text-accent">
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <ClipboardCopy className="w-3 h-3" />}
                    {copied ? "Copiada" : "Copiar como tarea"}
                </button>
            </div>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        <div className="pt-3 space-y-3">
                            <p className="text-xs text-slate-300 leading-relaxed">{practice.what}</p>
                            <div>
                                <p className="section-label mb-1.5">Primeros pasos</p>
                                <ol className="space-y-1 list-decimal list-inside">
                                    {practice.steps.map((step) => (
                                        <li key={step} className="text-xs text-slate-300 leading-relaxed">{step}</li>
                                    ))}
                                </ol>
                            </div>
                            {practice.milestones.length > 0 && (
                                <div>
                                    <p className="section-label mb-1.5">Hitos que demuestra</p>
                                    <ul className="space-y-1">
                                        {practice.milestones.map((milestone) => (
                                            <li key={milestone.id}>
                                                <Link href={`/roadmap/${trackId}#${milestone.id}`} className="text-xs text-accent hover:underline leading-relaxed">
                                                    {milestone.text}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
