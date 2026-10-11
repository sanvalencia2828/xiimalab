"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Lightbulb, Loader2, TrendingUp } from "lucide-react";
import { getSkillInsightsAction } from "@/app/actions/skills";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { formatPrize } from "@/lib/hackathons/format";
import { EVIDENCE_LEVEL_LABELS, type EvidenceLevel, type SkillInsight, type SkillInsights } from "@/lib/skills/types";

const LEVEL_STYLE: Record<EvidenceLevel, string> = {
    none: "bg-slate-700/30 text-slate-400 border-slate-600/30",
    learning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    demonstrated: "bg-accent/10 text-accent border-accent/30",
    consolidated: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Devpost, DoraHacks y Devfolio" */
function joinNames(names: string[]): string {
    return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function updatedAgo(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (minutes < 1) return "actualizado hace menos de 1 min";
    return minutes < 60 ? `actualizado hace ${minutes} min` : `actualizado hace ${Math.round(minutes / 60)} h`;
}

/** En qué se apoya el nivel: proyectos e hitos. */
function evidenceText(skill: SkillInsight): string {
    const parts: string[] = [];
    if (skill.projects.length > 0) parts.push(`${plural(skill.projects.length, "proyecto", "proyectos")}: ${skill.projects.join(", ")}`);
    if (skill.milestonesDone > 0) parts.push(plural(skill.milestonesDone, "hito marcado", "hitos marcados"));
    return parts.length > 0 ? parts.join(" · ") : "Ningún proyecto ni hito la demuestra todavía";
}

function demandText(skill: SkillInsight): string {
    if (skill.demand === 0) return "Sin convocatorias abiertas";
    const prizes = skill.prizeUsd > 0 ? ` · ${formatPrize(skill.prizeUsd, "USD")} en premios` : "";
    return `${plural(skill.demand, "convocatoria", "convocatorias")}${prizes}`;
}

/** Pestaña "Mercado": nivel por evidencia de cada skill frente a su demanda en las hackatones abiertas. */
export function MarketTab() {
    const { state, loaded } = useLearningProgress();
    const [data, setData] = useState<SkillInsights | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!loaded) return;
        let cancelled = false;
        getSkillInsightsAction(state)
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
                <p className="text-sm text-slate-200 mb-4">No se pudo calcular la comparación con el mercado.</p>
                <button type="button" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }} className="btn-primary">
                    Reintentar
                </button>
            </div>
        ) : (
            <div className="card-premium p-12 flex flex-col items-center justify-center" role="status">
                <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
                <p className="text-sm text-muted-text">Cruzando tus proyectos e hitos con las hackatones abiertas…</p>
            </div>
        );
    }

    const maxDemand = Math.max(1, ...data.skills.map((s) => s.demand));

    return (
        <motion.div
            key="market"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            {!data.hackathonsAvailable && (
                <div className="card-premium p-4 text-xs text-muted-text">
                    No se pudo consultar el agregador de hackatones: se muestra tu evidencia, sin datos de demanda.
                </div>
            )}

            {/* Recomendación */}
            {data.recommendation && (
                <div className="card-premium p-5 flex items-start gap-3">
                    <Lightbulb className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <p className="section-label mb-1">Recomendación</p>
                        <p className="text-sm text-slate-200">{data.recommendation.text}</p>
                        <Link href={data.recommendation.href} className="mt-2 inline-flex items-start gap-1.5 text-xs text-accent hover:underline">
                            <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{data.recommendation.linkLabel}</span>
                        </Link>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Tu nivel vs. demanda */}
                <div className="lg:col-span-2 card-premium p-5">
                    <h3 className="text-sm font-bold text-slate-200 mb-1">Tu nivel frente a la demanda</h3>
                    <p className="text-xs text-muted-text mb-4">
                        El nivel sale de la evidencia (proyectos que usan la skill e hitos marcados), no de una autoevaluación.
                    </p>
                    {data.skills.length === 0 ? (
                        <p className="text-xs text-muted-text">Todavía no hay skills con demanda ni con evidencia.</p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {data.skills.map((skill, index) => (
                                <motion.li
                                    key={skill.key}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(index, 12) * 0.04, duration: 0.3, ease: "easeOut" }}
                                    className="py-3 first:pt-0 last:pb-0"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-200">{skill.label}</span>
                                            <span className={`px-2 py-0.5 text-[11px] rounded-md border ${LEVEL_STYLE[skill.level]}`}>
                                                {EVIDENCE_LEVEL_LABELS[skill.level]}
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-300">{demandText(skill)}</span>
                                    </div>
                                    <div
                                        className="h-1.5 rounded-full bg-slate-800 overflow-hidden"
                                        role="img"
                                        aria-label={`Demanda de ${skill.label}: ${plural(skill.demand, "convocatoria", "convocatorias")}`}
                                    >
                                        <div className="h-full rounded-full bg-accent" style={{ width: `${(skill.demand / maxDemand) * 100}%` }} />
                                    </div>
                                    <p className="text-xs text-muted-text mt-1.5">
                                        {evidenceText(skill)}
                                        {skill.track && skill.level !== "consolidated" && (
                                            <>
                                                {" · Se aprende en "}
                                                <Link href={skill.milestone?.href ?? `/roadmap/${skill.track.id}`} className="text-slate-300 hover:text-accent">
                                                    {skill.track.title}
                                                </Link>
                                            </>
                                        )}
                                    </p>
                                </motion.li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Oportunidades en alza */}
                <div className="card-premium p-5">
                    <h3 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-accent" />
                        Oportunidades en alza
                    </h3>
                    <p className="text-xs text-muted-text mb-4">Las skills más pedidas ahora en las hackatones abiertas.</p>
                    {data.rising.length === 0 ? (
                        <p className="text-xs text-muted-text">Ahora no hay datos de demanda.</p>
                    ) : (
                        <ol className="space-y-4">
                            {data.rising.map((skill, index) => (
                                <li key={skill.key}>
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-sm font-medium text-slate-200">
                                            <span className="font-mono text-xs text-accent mr-2">#{index + 1}</span>
                                            {skill.label}
                                        </span>
                                        <span className="text-xs text-muted-text shrink-0">{EVIDENCE_LEVEL_LABELS[skill.level]}</span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-0.5">{demandText(skill)}</p>
                                    {skill.keywords.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Etiquetas de las convocatorias que la piden">
                                            {skill.keywords.map((keyword) => (
                                                <span key={keyword} className="px-2 py-0.5 bg-slate-700/30 text-slate-300 text-[11px] rounded-md border border-slate-600/30">
                                                    {keyword}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>

            {data.hackathonsAvailable && (
                <p className="text-[11px] text-muted-text" suppressHydrationWarning>
                    Basado en {data.total} convocatorias abiertas de {joinNames(data.sources)}
                    {data.fetchedAt ? ` · ${updatedAgo(data.fetchedAt)}` : ""}
                </p>
            )}
        </motion.div>
    );
}
