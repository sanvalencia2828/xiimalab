"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { currentPhase, isTrackActive, trackProgress } from "@/lib/learning/progress";
import type { Track } from "@/lib/learning/tracks";

/** Lista de tracks con su barra de avance (hitos hechos / total). */
export function TrackList({ tracks }: { tracks: Track[] }) {
    const { state, loaded } = useLearningProgress();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tracks.map((track, index) => {
                const progress = trackProgress(track, state.done);
                const active = isTrackActive(track, state);
                const phase = currentPhase(track, state.done);

                return (
                    <motion.div
                        key={track.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
                        className="card-premium p-5 flex flex-col hover:!border-accent/30 transition-all duration-300"
                    >
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <h2 className="text-base font-semibold text-slate-200">{track.title}</h2>
                            {loaded && active && (
                                <span className="shrink-0 px-2 py-0.5 text-[11px] rounded-md border bg-accent/10 text-accent border-accent/30">
                                    {progress.done === progress.total ? "Completado" : "En curso"}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-muted-text leading-relaxed mb-4">{track.description}</p>

                        {/* Avance */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="text-slate-300">
                                    {loaded ? `${progress.done} de ${progress.total} hitos` : `${progress.total} hitos`}
                                </span>
                                <span className="font-mono text-slate-400">{loaded ? `${progress.percent}%` : "…"}</span>
                            </div>
                            <div
                                className="h-1.5 rounded-full bg-slate-800 overflow-hidden"
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
                            <p className="text-xs text-muted-text mt-2">
                                {track.phases.length} fases
                                {loaded && active && phase ? ` · Fase actual: ${phase.title}` : ""}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-4 mt-auto border-t border-border">
                            <Link
                                href={`/roadmap/${track.id}`}
                                className="btn-primary flex items-center justify-center gap-2 text-sm flex-1"
                            >
                                {loaded && active ? "Continuar" : "Abrir track"}
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                            <a
                                href={track.referenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-ghost flex items-center justify-center gap-1.5 text-xs"
                            >
                                Ver referencia en roadmap.sh
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
