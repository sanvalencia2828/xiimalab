"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, FolderKanban, GraduationCap, Zap } from "lucide-react";
import { getTrackPracticesAction } from "@/app/actions/applications";
import { PracticeCard } from "@/components/learning/PracticeCard";
import { type PhaseResource, ResourceList } from "@/components/learning/ResourceList";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { useMilestoneEvidence } from "@/hooks/useMilestoneEvidence";
import { closesIn, type PhaseHackathon } from "@/lib/learning/connect";
import { resolvedProjects } from "@/lib/learning/impact";
import { demonstratedIn, phasePractices } from "@/lib/learning/practices";
import { isTrackActive, phaseProgress, phaseStatus, type PhaseStatus, trackProgress } from "@/lib/learning/progress";
import type { Practice, Track } from "@/lib/learning/tracks";
import { PROJECTS } from "@/lib/projects/data";

export interface PhaseExtras {
    hackathons: PhaseHackathon[];
    resources: PhaseResource[];
}

interface TrackTimelineProps {
    track: Track;
    /** Hackatones abiertas y recursos reconocidos por id de fase */
    extras: Record<string, PhaseExtras>;
}

const STATUS_STYLE: Record<PhaseStatus, { label: string; chip: string; dot: string }> = {
    pendiente: { label: "Pendiente", chip: "bg-slate-700/30 text-slate-400 border-slate-600/30", dot: "bg-slate-700 border-slate-600" },
    "en curso": { label: "En curso", chip: "bg-accent/10 text-accent border-accent/30", dot: "bg-accent/30 border-accent" },
    hecho: { label: "Hecho", chip: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500 border-emerald-400" },
};

/** Fases del track como timeline vertical, con hitos marcables y un proyecto práctico por cada proyecto que toca la fase. */
export function TrackTimeline({ track, extras }: TrackTimelineProps) {
    const { state, loaded, toggleMilestone, startTrack } = useLearningProgress();
    const progress = trackProgress(track, state.done);
    const active = isTrackActive(track, state);
    const { evidence, record, remove } = useMilestoneEvidence();
    // Las prácticas manuales y generales se calculan aquí; el servidor las devuelve con las de la IA donde existan
    const [fromServer, setFromServer] = useState<Record<string, Practice[]>>({});
    /** Hito recién marcado por el que se pregunta en qué proyecto se demostró */
    const [asking, setAsking] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getTrackPracticesAction(track.id)
            .then((practices) => { if (!cancelled) setFromServer(practices); })
            .catch(() => { /* se quedan las prácticas calculadas en el navegador */ });
        return () => { cancelled = true; };
    }, [track.id]);

    const onToggle = (milestoneId: string, hasPractices: boolean) => {
        const marking = !state.done[milestoneId];
        toggleMilestone(track.id, milestoneId);
        if (!marking) remove(milestoneId);
        setAsking(marking && hasPractices ? milestoneId : null);
    };

    return (
        <div>
            {/* Avance del track */}
            <div className="card-premium p-5 mb-8">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <p className="text-sm text-slate-200">
                        {loaded ? `${progress.done} de ${progress.total} hitos` : `${progress.total} hitos`}
                        {track.phases.some((p) => p.optional) && <span className="text-muted-text"> · sin contar la fase opcional</span>}
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
                    const extra = extras[phase.id] ?? { hackathons: [], resources: [] };
                    const resolved = resolvedProjects(phase);
                    const practices = fromServer[phase.id] ?? phasePractices(track, phase, PROJECTS);
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
                                        {phase.optional && <span className="ml-2 text-xs font-normal text-muted-text">Opcional</span>}
                                    </h2>
                                    <span className={`px-2 py-0.5 text-[11px] rounded-md border ${style.chip}`}>
                                        {style.label}
                                        {loaded ? ` · ${pp.done}/${pp.total}` : ""}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-text mb-3">{phase.objective}</p>

                                {/* Impacto: proyectos con una necesidad real que la fase resuelve */}
                                {resolved.length > 0 && (
                                    <div className="mb-3">
                                        <span
                                            className="inline-block px-2 py-0.5 text-[11px] rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                            title={resolved.join(", ")}
                                        >
                                            Resuelve {resolved.length} de tus {PROJECTS.length} proyectos
                                        </span>
                                        <ul className="mt-1.5 space-y-0.5">
                                            {(phase.resuelve ?? []).map((need) => (
                                                <li key={need.need} className="text-xs text-muted-text">
                                                    <span className="text-slate-300">{need.need}:</span> {need.projects.join(", ")}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {phase.note && <p className="text-xs text-muted-text mb-3">{phase.note}</p>}

                                {/* Hitos */}
                                <ul className="space-y-2 mb-4">
                                    {phase.milestones.map((milestone) => {
                                        const doneAt = state.done[milestone.id];
                                        const usedIn = evidence[milestone.id];
                                        return (
                                            <li key={milestone.id} id={milestone.id} className="scroll-mt-24">
                                                <label className="flex items-start gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(doneAt)}
                                                        disabled={!loaded}
                                                        onChange={() => onToggle(milestone.id, practices.length > 0)}
                                                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 accent-sky-400 shrink-0"
                                                    />
                                                    <span className={`text-sm leading-snug ${doneAt ? "text-slate-500 line-through" : "text-slate-200 group-hover:text-white"}`}>
                                                        {milestone.text}
                                                    </span>
                                                </label>
                                                {milestone.appliesTo && !doneAt && (
                                                    <p className="ml-7 mt-0.5 text-[11px] text-muted-text">Aplica a {milestone.appliesTo.join(", ")}</p>
                                                )}
                                                {doneAt && usedIn && asking !== milestone.id && (
                                                    <p className="ml-7 mt-1 text-xs text-emerald-400">
                                                        Demostrado en {usedIn}
                                                        <button type="button" onClick={() => setAsking(milestone.id)} className="ml-2 text-muted-text hover:text-accent">
                                                            Cambiar
                                                        </button>
                                                    </p>
                                                )}
                                                {doneAt && asking === milestone.id && (
                                                    <p className="ml-7 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                                                        <span>¿En qué proyecto lo demostraste?</span>
                                                        {practices.map((practice) => (
                                                            <button
                                                                key={practice.project}
                                                                type="button"
                                                                onClick={() => { record(milestone.id, practice.project); setAsking(null); }}
                                                                className="text-accent hover:underline"
                                                            >
                                                                {practice.project}
                                                            </button>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => { remove(milestone.id); setAsking(null); }}
                                                            className="text-muted-text hover:text-slate-200"
                                                        >
                                                            En ninguno
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

                                {/* Proyectos prácticos: uno por cada proyecto que toca la fase */}
                                <div className="mb-4">
                                    <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                                        <FolderKanban className="w-3 h-3" />
                                        Proyectos prácticos
                                    </p>
                                    {practices.length === 0 ? (
                                        <p className="text-xs text-muted-text">
                                            Ningún proyecto de tu portafolio toca esta fase todavía. Idea para empezar de cero: {phase.practicaGeneral.idea}
                                        </p>
                                    ) : (
                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {practices.map((practice) => (
                                                <li key={practice.project}>
                                                    <PracticeCard
                                                        practice={practice}
                                                        trackId={track.id}
                                                        trackTitle={track.title}
                                                        phaseTitle={phase.title}
                                                        heading={practice.project}
                                                        progress={{
                                                            done: demonstratedIn(phase, practice.project, evidence, state.done),
                                                            total: phase.milestones.length,
                                                        }}
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

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

                                {/* Hackatones abiertas */}
                                <div className="pt-4 border-t border-border">
                                    <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                                        <Zap className="w-3 h-3" />
                                        Hackatones abiertas para practicar
                                    </p>
                                    {extra.hackathons.length === 0 ? (
                                        <p className="text-xs text-muted-text">Ninguna hackatón abierta coincide con estas skills ahora mismo.</p>
                                    ) : (
                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                            </div>
                        </motion.li>
                    );
                })}
            </ol>
        </div>
    );
}
