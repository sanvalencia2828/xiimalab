"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FolderKanban, Lightbulb, X, Zap } from "lucide-react";
import { getIdeasFitAction } from "@/app/actions/ideas";
import { IDEAS, IDEA_KIND_LABELS, IDEA_STATUS_LABELS, type Idea, type IdeaStatus } from "@/lib/ideas/data";

const STATUS_STYLE: Record<IdeaStatus, string> = {
    pensando: "bg-slate-700/30 text-slate-300 border-slate-600/30",
    investigando: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    prototipo: "bg-accent/10 text-accent border-accent/30",
    convertida: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    descartada: "bg-rose-500/10 text-rose-400 border-rose-500/30",
};

const STATUSES = Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[];
const chipClass = "px-2 py-0.5 bg-sky-500/10 text-sky-300 text-xs rounded-md border border-sky-500/20";

/** undefined = calculando · null = agregador no disponible */
type Fit = Record<string, number> | null | undefined;

function formatDate(day: string): string {
    return new Date(`${day}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function fitLabel(fit: Fit, id: string): string {
    if (fit === undefined) return "Calculando encaje con hackatones…";
    if (fit === null) return "Encaje con hackatones no disponible ahora";
    const n = fit[id] ?? 0;
    return n === 1 ? "Encaja con 1 hackatón abierta" : `Encaja con ${n} hackatones abiertas`;
}

function StatusChip({ status }: { status: IdeaStatus }) {
    return (
        <span className={`shrink-0 px-2 py-0.5 text-[11px] rounded-md border ${STATUS_STYLE[status]}`}>
            {IDEA_STATUS_LABELS[status]}
        </span>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="section-label mb-1.5">{label}</p>
            {children}
        </div>
    );
}

function IdeaDetail({ idea, fit, onClose }: { idea: Idea; fit: Fit; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center sm:p-4 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={idea.title}
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-card border border-border sm:rounded-2xl shadow-2xl overflow-hidden"
            >
                <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-border shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold text-slate-200 mb-2">{idea.title}</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusChip status={idea.status} />
                            <span className="text-xs text-muted-text">{IDEA_KIND_LABELS[idea.kind]}</span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-white/5">
                        <X className="w-5 h-5 text-muted-text" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                    <p className="text-sm text-slate-200 leading-relaxed">{idea.summary}</p>

                    <Field label="Problema que resuelve">
                        <p className="text-sm text-slate-300 leading-relaxed">{idea.problem}</p>
                    </Field>

                    <Field label="Cómo funcionaría">
                        <ol className="space-y-2 list-decimal list-inside marker:text-accent marker:font-mono">
                            {idea.steps.map((step) => (
                                <li key={step} className="text-sm text-slate-300 leading-relaxed">{step}</li>
                            ))}
                        </ol>
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Field label="Tipo">
                            <p className="text-sm text-slate-300">{IDEA_KIND_LABELS[idea.kind]}</p>
                            {idea.kindNote && <p className="text-xs text-muted-text mt-0.5">{idea.kindNote}</p>}
                        </Field>
                        <Field label="Proyecto relacionado">
                            {idea.relatedProject ? (
                                <Link href="/projects" className="text-sm text-slate-300 hover:text-accent inline-flex items-center gap-1.5">
                                    <FolderKanban className="w-3.5 h-3.5" />
                                    {idea.relatedProject}
                                </Link>
                            ) : (
                                <p className="text-sm text-muted-text">Ninguno</p>
                            )}
                        </Field>
                    </div>

                    <Field label="Skills que requiere">
                        <div className="flex flex-wrap gap-1.5">
                            {idea.skills.map((skill) => (
                                <span key={skill} className={chipClass}>{skill}</span>
                            ))}
                        </div>
                        <Link href="/hackathons" className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
                            <Zap className="w-3 h-3" />
                            {fitLabel(fit, idea.id)}
                        </Link>
                    </Field>

                    <Field label="Riesgos y dudas abiertas">
                        <ul className="space-y-1.5 list-disc list-inside marker:text-amber-400">
                            {idea.risks.map((risk) => (
                                <li key={risk} className="text-sm text-slate-300 leading-relaxed">{risk}</li>
                            ))}
                        </ul>
                    </Field>

                    <p className="text-xs text-muted-text">
                        Creada el {formatDate(idea.createdAt)} · Última actualización: {formatDate(idea.updatedAt)}
                    </p>
                </div>

                <div className="flex items-center justify-between gap-3 p-4 sm:px-6 border-t border-border shrink-0">
                    <span className="text-xs text-muted-text">Próximamente</span>
                    <button type="button" disabled className="btn-primary opacity-50 cursor-not-allowed">
                        Convertir en proyecto
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

/** Ideas en exploración de Mi Perfil: tarjetas con filtro por estado y detalle al hacer clic. */
export function IdeasSection() {
    const [filter, setFilter] = useState<IdeaStatus | "todas">("todas");
    const [selected, setSelected] = useState<Idea | null>(null);
    const [fit, setFit] = useState<Fit>(undefined);

    useEffect(() => {
        let cancelled = false;
        getIdeasFitAction()
            .then((next) => { if (!cancelled) setFit(next); })
            .catch(() => { if (!cancelled) setFit(null); });
        return () => { cancelled = true; };
    }, []);

    const visible = filter === "todas" ? IDEAS : IDEAS.filter((idea) => idea.status === filter);
    const filters: { key: IdeaStatus | "todas"; label: string; count: number }[] = [
        { key: "todas", label: "Todas", count: IDEAS.length },
        ...STATUSES.map((status) => ({
            key: status,
            label: IDEA_STATUS_LABELS[status],
            count: IDEAS.filter((idea) => idea.status === status).length,
        })),
    ];

    return (
        <section className="card-premium p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-accent" />
                    Ideas en exploración
                </h2>
                <span className="text-xs text-muted-text">{IDEAS.length} {IDEAS.length === 1 ? "idea" : "ideas"}</span>
            </div>
            <p className="text-xs text-muted-text mb-4">Lo que estás valorando construir y todavía no es un proyecto.</p>

            <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filtrar por estado">
                {filters.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        aria-pressed={filter === f.key}
                        onClick={() => setFilter(f.key)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                            filter === f.key
                                ? "bg-accent/15 text-accent border-accent/40"
                                : "text-slate-400 border-border hover:text-slate-200"
                        }`}
                    >
                        {f.label}
                        <span className="ml-1.5 font-mono text-muted-text">{f.count}</span>
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <p className="text-sm text-muted-text py-6 text-center">No hay ideas en este estado.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visible.map((idea, index) => (
                        <motion.button
                            key={idea.id}
                            type="button"
                            onClick={() => setSelected(idea)}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
                            className="text-left p-4 rounded-lg border border-border hover:border-accent/40 transition-colors flex flex-col"
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <h3 className="text-sm font-semibold text-slate-200">{idea.title}</h3>
                                <StatusChip status={idea.status} />
                            </div>
                            <p className="text-xs text-muted-text mb-3">{IDEA_KIND_LABELS[idea.kind]}</p>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {idea.skills.map((skill) => (
                                    <span key={skill} className={chipClass}>{skill}</span>
                                ))}
                            </div>
                            <p className="text-xs text-accent mt-auto flex items-center gap-1.5">
                                <Zap className="w-3 h-3" />
                                {fitLabel(fit, idea.id)}
                            </p>
                        </motion.button>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {selected && <IdeaDetail idea={selected} fit={fit} onClose={() => setSelected(null)} />}
            </AnimatePresence>
        </section>
    );
}
