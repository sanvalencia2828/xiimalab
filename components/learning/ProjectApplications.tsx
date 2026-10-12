"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Map as MapIcon } from "lucide-react";
import { getProjectPracticesAction } from "@/app/actions/applications";
import { PracticeCard } from "@/components/learning/PracticeCard";
import { applicationsForProject, type ProjectLike } from "@/lib/learning/applications";
import { practiceFor } from "@/lib/learning/practices";
import { TRACKS, getTrack, type Practice } from "@/lib/learning/tracks";

function phaseKey(application: { trackId: string; phaseId: string }): string {
    return `${application.trackId}:${application.phaseId}`;
}

/**
 * "Cómo mejorarlo con los tracks": las fases que aplican al proyecto y su
 * práctica en cada una, las mismas que se ven en /roadmap/[track]. Plegado por defecto.
 */
export default function ProjectApplications({ project }: { project: ProjectLike }) {
    // Fases y prácticas manuales o generales se calculan aquí; las de la IA llegan al desplegar
    const applications = applicationsForProject(project, TRACKS);
    const [open, setOpen] = useState(false);
    const [fromServer, setFromServer] = useState<Record<string, Practice> | null>(null);

    if (applications.length === 0) return null;

    const toggle = () => {
        if (!open && !fromServer) {
            getProjectPracticesAction(project.title)
                .then((list) => setFromServer(Object.fromEntries(list.map((a) => [phaseKey(a), a.practica]))))
                .catch(() => { /* se quedan las prácticas calculadas en el navegador */ });
        }
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
                        <ul className="mt-3 space-y-2">
                            {applications.map((application) => {
                                const track = getTrack(application.trackId);
                                const phase = track?.phases.find((p) => p.id === application.phaseId);
                                const practice =
                                    fromServer?.[phaseKey(application)] ?? (track && phase ? practiceFor(project, track, phase) : null);
                                if (!practice) return null;
                                return (
                                    <li key={phaseKey(application)}>
                                        <PracticeCard
                                            practice={practice}
                                            trackId={application.trackId}
                                            trackTitle={application.trackTitle}
                                            phaseTitle={application.phaseTitle}
                                            heading={
                                                <Link href={`/roadmap/${application.trackId}`} className="hover:text-accent">
                                                    {application.trackTitle} · {application.phaseTitle}
                                                </Link>
                                            }
                                        />
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
