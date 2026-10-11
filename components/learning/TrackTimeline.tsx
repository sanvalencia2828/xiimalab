"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Clock, ExternalLink, FolderKanban, GraduationCap, Lightbulb, Wrench, Zap } from "lucide-react";
import { type AppliedPhase, getTrackApplicationsAction } from "@/app/actions/applications";
import { type PhaseResource, ResourceList } from "@/components/learning/ResourceList";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { useMilestoneEvidence } from "@/hooks/useMilestoneEvidence";
import { applicationsForTrack } from "@/lib/learning/applications";
import { closesIn, type PhaseHackathon, type PhaseProject } from "@/lib/learning/connect";
import { isTrackActive, phaseProgress, phaseStatus, type PhaseStatus, trackProgress } from "@/lib/learning/progress";
import { TRACKS, type Track } from "@/lib/learning/tracks";
import { PROJECTS } from "@/lib/projects/data";

export interface PhaseExtras {
    hackathons: PhaseHackathon[];
    projects: PhaseProject[];
    resources: PhaseResource[];
}

interface TrackTimelineProps {
    track: Track;
    /** Hackatones abiertas, proyectos del portafolio y recursos reconocidos por id de fase */
    extras: Record<string, PhaseExtras>;
}

const STATUS_STYLE: Record<PhaseStatus, { label: string; chip: string; dot: string }> = {
    pendiente: { label: "Pendiente", chip: "bg-slate-700/30 text-slate-400 border-slate-600/30", dot: "bg-slate-700 border-slate-600" },
    "en curso": { label: "En curso", chip: "bg-accent/10 text-accent border-accent/30", dot: "bg-accent/30 border-accent" },
    hecho: { label: "Hecho", chip: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500 border-emerald-400" },
};

/** Fases del track como timeline vertical, con hitos marcables. */
export function TrackTimeline({ track, extras }: TrackTimelineProps) {
    const { state, loaded, toggleMilestone, startTrack } = useLearningProgress();
    const progress = trackProgress(track, state.done);
    const active = isTrackActive(track, state);
    const { evidence, record, remove } = useMilestoneEvidence();
    // Proyectos a los que aplica cada fase (sin IA); la mejora concreta de cada uno llega después
    const applications = applicationsForTrack(track, PROJECTS, TRACKS);
    const [applied, setApplied] = useState<AppliedPhase[]>([]);
    /** Hito recién marcado por el que se pregunta si se aplicó en un proyecto */
    const [asking, setAsking] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getTrackApplicationsAction(track.id)
            .then((list) => { if (!cancelled) setApplied(list); })
            .catch(() => { /* las fases siguen mostrando los proyectos, sin la mejora */ });
        return () => { cancelled = true; };
    }, [track.id]);

    /** Proyectos cuya mejora en esta fase cubre el hito (o es la sugerencia general de la fase). */
    const projectsFor = (phaseId: string, milestoneId: string): string[] =>
        applied
            .filter((a) => a.phaseId === phaseId && (a.example.general || a.example.milestones.some((m) => m.id === milestoneId)))
            .map((a) => a.projectName);

    const onToggle = (phaseId: string, milestoneId: string) => {
        const marking = !state.done[milestoneId];
        toggleMilestone(track.id, milestoneId);
        if (!marking) remove(milestoneId);
        setAsking(marking && projectsFor(phaseId, milestoneId).length > 0 ? milestoneId : null);
    };

    return (
        <div>
            {/* Avance del track */}
            <div className="card-premium p-5 mb-8">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <p className="text-sm text-slate-200">
                        {loaded ? `${progress.done} de ${progress.total} hitos` : `${progress.total} hitos`}
                        <span className="ml-2 font-mono text-slate-400">{loaded ? `${progress.percent}%` : ""}</span>
                    </p>
                    {loaded && !active && (
                        <button type="button" onClick={() => startTrack(track.id)} className="btn-primary text-sm px-4 py-1.5">
                            Empezar este track
                        </button>
                    )}
                </div>
                <div
                    className="h-2 rounded-full bg-slate-800 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Avance de ${track.title}`}
                >
                    <motion.div
                        className="h-full rounded-full bg-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${loaded ? progress.percent : 0}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                </div>
                <p className="text-xs text-muted-text mt-3">
                    El avance se guarda en este navegador. Marca un hito cuando puedas demostrarlo con un repo, una demo o un despliegue.
                </p>
            </div>

            {/* Timeline */}
            <ol className="relative">
                {track.phases.map((phase, index) => {
                    const status = phaseStatus(phase, state.done);
                    const style = STATUS_STYLE[loaded ? status : "pendiente"];
                    const pp = phaseProgress(phase, state.done);
                    const extra = extras[phase.id] ?? { hackathons: [], projects: [], resources: [] };
                    const isLast = index === track.phases.length - 1;

                    return (
                        <motion.li
                            key={phase.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.06, duration: 0.3, ease: "easeOut" }}
                            className="relative pl-10 pb-8"
                        >
                            {/* Línea y punto */}
                            {!isLast && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-border" aria-hidden="true" />}
                            <span
                                className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${style.dot}`}
                                aria-hidden="true"
                            >
                                {loaded && status === "hecho" ? (
                                    <Check className="w-3.5 h-3.5 text-white" />
                                ) : (
                                    <span className="text-[10px] font-bold text-slate-200">{index + 1}</span>
                                )}
                            </span>

                            <div className="card-premium p-5">
                                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                                    <h2 className="text-base font-semibold text-slate-200">
                                        Fase {index + 1} · {phase.title}
                                    </h2>
                                    <span className={`px-2 py-0.5 text-[11px] rounded-md border ${style.chip}`}>
                                        {style.label}
                                        {loaded ? ` · ${pp.done}/${pp.total}` : ""}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-text mb-4">{phase.objective}</p>

                                {/* Hitos */}
                                <ul className="space-y-2 mb-4">
                                    {phase.milestones.map((milestone) => {
                                        const doneAt = state.done[milestone.id];
                                        const usedIn = evidence[milestone.id];
                                        const candidates = asking === milestone.id ? projectsFor(phase.id, milestone.id) : [];
                                        return (
                                            <li key={milestone.id} id={milestone.id} className="scroll-mt-24">
                                                <label className="flex items-start gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(doneAt)}
                                                        disabled={!loaded}
                                                        onChange={() => onToggle(phase.id, milestone.id)}
                                                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 accent-sky-400 shrink-0"
                                                    />
                                                    <span className={`text-sm leading-snug ${doneAt ? "text-slate-500 line-through" : "text-slate-200 group-hover:text-white"}`}>
                                                        {milestone.text}
                                                    </span>
                                                </label>
                                                {doneAt && usedIn && (
                                                    <p className="ml-7 mt-1 text-xs text-emerald-400">
                                                        Evidencia: {usedIn}
                                                        <button type="button" onClick={() => remove(milestone.id)} className="ml-2 text-muted-text hover:text-accent">
                                                            Quitar
                                                        </button>
                                                    </p>
                                                )}
                                                {doneAt && !usedIn && candidates.length > 0 && (
                                                    <p className="ml-7 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                                                        <span>¿Lo aplicaste en {candidates.join(" o ")}?</span>
                                                        {candidates.map((name) => (
                                                            <button
                                                                key={name}
                                                                type="button"
                                                                onClick={() => { record(milestone.id, name); setAsking(null); }}
                                                                className="text-accent hover:underline"
                                                            >
                                                                {candidates.length === 1 ? "Sí, registrar como evidencia" : `Sí, en ${name}`}
                                                            </button>
                                                        ))}
                                                        <button type="button" onClick={() => setAsking(null)} className="text-muted-text hover:text-slate-200">
                                                            No
                                                        </button>
                                                    </p>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>

                                {/* Skills */}
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {phase.skills.map((skill) => (
                                        <span key={skill} className="px-2 py-0.5 bg-sky-500/10 text-sky-300 text-xs rounded-md border border-sky-500/20">
                                            {skill}
                                        </span>
                                    ))}
                                </div>

                                {/* Proyecto práctico */}
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/15 mb-4">
                                    <Lightbulb className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        <span className="font-semibold text-slate-200">Proyecto práctico: </span>
                                        {phase.practiceProject.idea}
                                    </p>
                                </div>

                                {/* Aplícalo a tus proyectos */}
                                {applications.some((a) => a.phaseId === phase.id) && (
                                    <div className="mb-4">
                                        <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                                            <Wrench className="w-3 h-3" />
                                            Aplícalo a tus proyectos
                                        </p>
                                        <ul className="space-y-2">
                                            {applications.filter((a) => a.phaseId === phase.id).map((application) => {
                                                const example = applied.find(
                                                    (a) => a.phaseId === phase.id && a.projectTitle === application.projectTitle,
                                                )?.example;
                                                return (
                                                    <li key={application.projectTitle} className="text-xs">
                                                        <span className="font-medium text-slate-200">{application.projectName}</span>
                                                        <span className="text-slate-300">
                                                            {" · "}
                                                            {example && !example.general ? example.title : application.reason}
                                                        </span>
                                                        {example?.general && <span className="text-muted-text"> · Sugerencia general</span>}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        <p className="text-[11px] text-muted-text mt-2">
                                            El detalle de cada mejora está en la tarjeta del proyecto, en{" "}
                                            <Link href="/projects" className="text-accent hover:underline">Proyectos</Link>.
                                        </p>
                                    </div>
                                )}

                                {/* Recursos reconocidos */}
                                {extra.resources.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                                            <GraduationCap className="w-3 h-3" />
                                            Recursos reconocidos
                                        </p>
                                        <ResourceList resources={extra.resources} />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
                                    {/* Hackatones abiertas */}
                                    <div>
                                        <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                                            <Zap className="w-3 h-3" />
                                            Hackatones abiertas para practicar
                                        </p>
                                        {extra.hackathons.length === 0 ? (
                                            <p className="text-xs text-muted-text">Ninguna hackatón abierta coincide con estas skills ahora mismo.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {extra.hackathons.map((h) => {
                                                    const closing = closesIn(h.deadline);
                                                    const body = (
                                                        <>
                                                            <span className="block text-xs text-slate-200 truncate">{h.title}</span>
                                                            <span className={`flex items-center gap-1 text-[11px] ${closing.urgent ? "text-red-400" : "text-muted-text"}`} suppressHydrationWarning>
                                                                <Clock className="w-3 h-3" />
                                                                {closing.label} · {h.matchedSkills.join(", ")}
                                                            </span>
                                                        </>
                                                    );
                                                    return (
                                                        <li key={h.id}>
                                                            {h.url ? (
                                                                <a href={h.url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80 transition-opacity">
                                                                    {body}
                                                                </a>
                                                            ) : (
                                                                body
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>

                                    {/* Proyectos del portafolio */}
                                    <div>
                                        <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                                            <FolderKanban className="w-3 h-3" />
                                            Proyectos tuyos que tocan esta fase
                                        </p>
                                        {extra.projects.length === 0 ? (
                                            <p className="text-xs text-muted-text">Ningún proyecto del portafolio usa todavía estas skills.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {extra.projects.slice(0, 3).map((p) => (
                                                    <li key={p.title} className="text-xs">
                                                        {p.url ? (
                                                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-slate-200 hover:text-accent inline-flex items-center gap-1">
                                                                {p.title}
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-slate-200">{p.title}</span>
                                                        )}
                                                        <span className="block text-[11px] text-muted-text">{p.matchedSkills.join(", ")}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {extra.projects.length > 0 && (
                                            <p className="text-[11px] text-muted-text mt-2">Úsalos como evidencia al marcar un hito.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.li>
                    );
                })}
            </ol>
        </div>
    );
}
