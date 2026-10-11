"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ClipboardCopy, Loader2, Map as MapIcon } from "lucide-react";
import { type AppliedPhase, getProjectApplicationsAction } from "@/app/actions/applications";
import { applicationsForProject, asRoadmapTask, type ProjectLike } from "@/lib/learning/applications";
import type { Effort } from "@/lib/learning/examples";
import { TRACKS } from "@/lib/learning/tracks";

const EFFORT_LABELS: Record<Effort, string> = { S: "S · una tarde", M: "M · un fin de semana", L: "L · más de una semana" };
const chipClass = "px-1.5 py-0.5 text-[10px] rounded-md border";

function phaseKey(application: { trackId: string; phaseId: string }): string {
    return `${application.trackId}:${application.phaseId}`;
}

function Detail({ applied }: { applied: AppliedPhase }) {
    const [copied, setCopied] = useState(false);
    const { example } = applied;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(asRoadmapTask(example.general ? example.what : example.title, applied));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* sin permiso de portapapeles: el botón no cambia */ }
    };

    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
        >
            <div className="pt-3 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">{example.what}</p>

                <div>
                    <p className="section-label mb-1.5">Primeros pasos</p>
                    <ol className="space-y-1 list-decimal list-inside">
                        {example.steps.map((step) => (
                            <li key={step} className="text-xs text-slate-300 leading-relaxed">{step}</li>
                        ))}
                    </ol>
                </div>

                {example.milestones.length > 0 && (
                    <div>
                        <p className="section-label mb-1.5">Hitos que demostraría</p>
                        <ul className="space-y-1">
                            {example.milestones.map((milestone) => (
                                <li key={milestone.id}>
                                    <Link href={`/roadmap/${applied.trackId}#${milestone.id}`} className="text-xs text-accent hover:underline leading-relaxed">
                                        {milestone.text}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <p className="text-[11px] text-muted-text">Por qué aplica: {applied.reason}.</p>

                <button type="button" onClick={copy} className="btn-ghost inline-flex items-center gap-1.5 text-xs">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                    {copied ? "Copiada" : "Copiar como tarea"}
                </button>
            </div>
        </motion.div>
    );
}

/** "Cómo mejorarlo con los tracks": fases aplicables al proyecto y la mejora concreta de cada una. Plegado por defecto. */
export default function ProjectApplications({ project }: { project: ProjectLike }) {
    // Las fases se calculan aquí (sin IA); los ejemplos se piden al desplegar
    const applications = applicationsForProject(project, TRACKS);
    const [open, setOpen] = useState(false);
    const [applied, setApplied] = useState<Record<string, AppliedPhase> | null>(null);
    const [failed, setFailed] = useState(false);
    const [detail, setDetail] = useState<string | null>(null);

    if (applications.length === 0) return null;

    const load = () => {
        setFailed(false);
        getProjectApplicationsAction(project.title)
            .then((list) => setApplied(Object.fromEntries(list.map((a) => [phaseKey(a), a]))))
            .catch(() => setFailed(true));
    };

    const toggle = () => {
        if (!open && !applied) load();
        setOpen((o) => !o);
    };

    return (
        // La tarjeta entera es clicable en /projects: los clics de este bloque no la seleccionan
        <div className="pt-4 border-t border-white/[0.06] mb-4" onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
            >
                <MapIcon className="w-3.5 h-3.5" />
                Cómo mejorarlo con los tracks ({applications.length})
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        {failed && (
                            <p className="text-xs text-muted-text mt-3" role="alert">
                                No se pudieron cargar las mejoras.{" "}
                                <button type="button" onClick={load} className="text-accent hover:underline">Reintentar</button>
                            </p>
                        )}
                        <ul className="mt-3 space-y-2">
                            {applications.map((application) => {
                                const key = phaseKey(application);
                                const item = applied?.[key];
                                const isOpen = detail === key;
                                return (
                                    <li key={key} className="p-3 rounded-lg border border-border">
                                        <p className="text-[11px] text-muted-text">
                                            <Link href={`/roadmap/${application.trackId}`} className="hover:text-accent">
                                                {application.trackTitle}
                                            </Link>
                                            {" · "}
                                            {application.phaseTitle}
                                        </p>
                                        {item ? (
                                            <>
                                                <p className="text-sm font-medium text-slate-200 mt-0.5 leading-snug">
                                                    {item.example.general ? item.example.what : item.example.title}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                    {item.example.general ? (
                                                        <span className={`${chipClass} bg-slate-700/30 text-slate-400 border-slate-600/30`}>Sugerencia general</span>
                                                    ) : (
                                                        item.example.effort && (
                                                            <span className={`${chipClass} bg-accent/10 text-accent border-accent/30`}>
                                                                Esfuerzo {EFFORT_LABELS[item.example.effort]}
                                                            </span>
                                                        )
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetail(isOpen ? null : key)}
                                                        aria-expanded={isOpen}
                                                        className="text-xs text-accent hover:underline"
                                                    >
                                                        {isOpen ? "Ocultar detalle" : "Ver detalle"}
                                                    </button>
                                                </div>
                                                <AnimatePresence initial={false}>{isOpen && <Detail applied={item} />}</AnimatePresence>
                                            </>
                                        ) : (
                                            !failed && (
                                                <p className="flex items-center gap-1.5 text-xs text-muted-text mt-1" role="status">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Pensando una mejora concreta…
                                                </p>
                                            )
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
