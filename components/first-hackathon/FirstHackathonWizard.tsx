"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    AlertTriangle, ArrowRight, Award, Check, Clock, ExternalLink, Loader2, Timer,
} from "lucide-react";
import { getFirstHackathonAction } from "@/app/actions/firstHackathon";
import { useFirstHackathon } from "@/hooks/useFirstHackathon";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { useProfile } from "@/hooks/useProfile";
import type { FirstHackathonData, PlanInsights } from "@/lib/first-hackathon/build";
import {
    buildChecks, type Candidate, type CheckItem, type ChosenHackathon, closingTime, currentStep,
    type FirstHackathonState, MAX_DAYS_TO_CLOSE, MIN_DAYS_TO_CLOSE, type PlanStep, planDate, PRESENT_CHECKS,
    REINFORCE_CHECK, type StepId, type StepStatus, STEPS, stepDone, stepStatus, SUBMIT_MARGIN_HOURS,
} from "@/lib/first-hackathon/plan";
import { describeClosing } from "@/lib/hackathons/format";

const chipClass = "px-2 py-0.5 bg-sky-500/10 text-sky-300 text-xs rounded-md border border-sky-500/20";
const fieldClass =
    "w-full px-3 py-2 bg-slate-800/50 border border-border rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50";

const STATUS_STYLE: Record<StepStatus, { label: string; chip: string }> = {
    pendiente: { label: "Pendiente", chip: "bg-slate-700/30 text-slate-400 border-slate-600/30" },
    hoy: { label: "Toca hoy", chip: "bg-accent/10 text-accent border-accent/30" },
    atrasado: { label: "Atrasado", chip: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
    hecho: { label: "Hecho", chip: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
};

function dayLabel(step: PlanStep): string {
    return step.days.length > 1 ? `Días ${step.days[0]}–${step.days[step.days.length - 1]}` : `Día ${step.days[0]}`;
}

function shortDate(date: Date): string {
    return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

/** "jue, 15 oct" · "dom, 18 oct – lun, 19 oct" */
function stepDates(step: PlanStep, deadline: string): string {
    const dates = [step.days[0], step.days[step.days.length - 1]]
        .map((day) => planDate(deadline, day))
        .filter((date): date is Date => date !== null)
        .map(shortDate);
    return Array.from(new Set(dates)).join(" – ");
}

/** Hora actual, actualizada cada minuto para la cuenta atrás. */
function useNow(): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(timer);
    }, []);
    return now;
}

// ── Piezas compartidas ──────────────────────────────────────────────────────
function Notice({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed">{children}</p>
        </div>
    );
}

function Checklist({
    items,
    checks,
    onToggle,
}: {
    items: CheckItem[];
    checks: Record<string, string>;
    onToggle: (id: string) => void;
}) {
    return (
        <ul className="space-y-2">
            {items.map((item) => {
                const done = Boolean(checks[item.id]);
                return (
                    <li key={item.id}>
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={done}
                                onChange={() => onToggle(item.id)}
                                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 accent-sky-400 shrink-0"
                            />
                            <span className={`text-sm leading-snug ${done ? "text-slate-500 line-through" : "text-slate-200 group-hover:text-white"}`}>
                                {item.label}
                            </span>
                        </label>
                    </li>
                );
            })}
        </ul>
    );
}

function InsightsLoading() {
    return (
        <p className="flex items-center gap-2 text-xs text-muted-text" role="status">
            <Loader2 className="w-4 h-4 text-accent animate-spin" />
            Cruzando la hackatón con tus proyectos y tus tracks…
        </p>
    );
}

// ── Día 1 · Elegir ──────────────────────────────────────────────────────────
function ChooseStep({
    data,
    chosenId,
    onChoose,
}: {
    data: FirstHackathonData;
    chosenId: string | null;
    onChoose: (candidate: Candidate) => void;
}) {
    if (!data.hackathonsAvailable) {
        return <p className="text-sm text-muted-text">No se pudo consultar el agregador de hackatones. Vuelve a intentarlo en unos minutos.</p>;
    }
    if (data.candidates.length === 0) {
        return (
            <div>
                <p className="text-sm text-slate-200 mb-1">Hoy ninguna hackatón abierta cumple los tres criterios.</p>
                <p className="text-xs text-muted-text mb-4">
                    Buscamos etiqueta Beginner Friendly o tema abierto, formato virtual y cierre entre {MIN_DAYS_TO_CLOSE} y {MAX_DAYS_TO_CLOSE} días.
                    La lista cambia a diario.
                </p>
                <Link href="/hackathons" className="btn-ghost">
                    Ver todas las hackatones
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        );
    }

    return (
        <ul className="space-y-3">
            {data.candidates.map((candidate) => {
                const chosen = candidate.id === chosenId;
                return (
                    <li
                        key={candidate.id}
                        className={`p-4 rounded-lg border transition-colors ${chosen ? "border-accent/50 bg-accent/5" : "border-border"}`}
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-200">{candidate.title}</p>
                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-text mt-1" suppressHydrationWarning>
                                    <span className="inline-flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {describeClosing(candidate.deadline).label}
                                    </span>
                                    <span>· Virtual · Premio: {candidate.prize}</span>
                                    {candidate.organizer && <span>· {candidate.organizer}</span>}
                                </p>
                            </div>
                            <span className="text-sm font-mono text-accent shrink-0">{candidate.matchScore}% match</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-md border border-emerald-500/30">
                                {candidate.reason}
                            </span>
                            {candidate.tags.slice(0, 4).map((tag) => (
                                <span key={tag} className={chipClass}>{tag}</span>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-4">
                            <button type="button" onClick={() => onChoose(candidate)} disabled={chosen} className="btn-primary text-sm px-4 py-1.5 disabled:opacity-60">
                                {chosen ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Elegida
                                    </>
                                ) : (
                                    "Elegir esta"
                                )}
                            </button>
                            {candidate.url && (
                                <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                                    Ver la convocatoria
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

// ── Día 2 · Idea ────────────────────────────────────────────────────────────
function IdeaStep({
    plan,
    insights,
    onIdea,
    onFeature,
}: {
    plan: FirstHackathonState;
    insights: PlanInsights | null;
    onIdea: (idea: string) => void;
    onFeature: (index: number, value: string) => void;
}) {
    return (
        <div className="space-y-5">
            <div>
                <p className="section-label mb-2">Tu proyecto que mejor encaja</p>
                {!insights ? (
                    <InsightsLoading />
                ) : insights.project ? (
                    <p className="text-sm text-slate-200">
                        {insights.project.url ? (
                            <a href={insights.project.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent inline-flex items-center gap-1">
                                {insights.project.name}
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        ) : (
                            insights.project.name
                        )}
                        <span className="block text-xs text-muted-text mt-0.5">Comparte con la hackatón: {insights.project.shared.join(", ")}</span>
                    </p>
                ) : (
                    <p className="text-xs text-muted-text">
                        Ningún proyecto de tu portafolio usa las skills que pide esta hackatón: empieza una idea nueva.
                    </p>
                )}
            </div>

            <Notice>Revisa si las reglas exigen código nuevo: muchas hackatones no aceptan proyectos empezados antes de la convocatoria.</Notice>

            <div>
                <label htmlFor="fh-idea" className="section-label block mb-2">La idea en una frase</label>
                <input
                    id="fh-idea"
                    type="text"
                    value={plan.idea}
                    onChange={(e) => onIdea(e.target.value)}
                    maxLength={200}
                    placeholder="Una herramienta que ayuda a… a…"
                    className={fieldClass}
                />
            </div>

            <fieldset>
                <legend className="section-label mb-2">Las 3 funciones del MVP</legend>
                <div className="space-y-2">
                    {plan.features.map((feature, index) => (
                        <input
                            key={index}
                            type="text"
                            value={feature}
                            onChange={(e) => onFeature(index, e.target.value)}
                            maxLength={120}
                            aria-label={`Función ${index + 1} del MVP`}
                            placeholder={`Función ${index + 1}`}
                            className={fieldClass}
                        />
                    ))}
                </div>
                <p className="text-xs text-muted-text mt-2">Solo lo que puedas terminar en dos días; el resto, después de enviar.</p>
            </fieldset>
        </div>
    );
}

// ── Día 3 · Reforzar ────────────────────────────────────────────────────────
function ReinforceStep({
    insights,
    checks,
    onToggle,
}: {
    insights: PlanInsights | null;
    checks: Record<string, string>;
    onToggle: (id: string) => void;
}) {
    if (!insights) return <InsightsLoading />;

    return (
        <div className="space-y-4">
            {insights.skills.length === 0 ? (
                <p className="text-xs text-muted-text">
                    Las etiquetas de esta hackatón no nombran ninguna skill de tus tracks, así que no hay nada concreto que reforzar.
                </p>
            ) : insights.reinforce.length === 0 ? (
                <p className="text-xs text-muted-text">
                    Ya tienes un proyecto o una certificación para todas las skills que pide: {insights.skills.map((s) => s.label).join(", ")}.
                </p>
            ) : (
                <>
                    <p className="text-xs text-muted-text">
                        Skills que pide la hackatón y tienes «Por reforzar»: ninguna aparece todavía en un proyecto ni en una certificación.
                    </p>
                    <ul className="space-y-2">
                        {insights.reinforce.map((skill) => (
                            <li key={skill.key} className="p-3 rounded-lg border border-border">
                                <p className="text-sm font-medium text-slate-200">{skill.label}</p>
                                {skill.milestone ? (
                                    <Link href={skill.milestone.href} className="mt-1.5 flex items-start gap-1.5 text-xs text-accent hover:underline">
                                        <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                                        <span>
                                            Hito que la cubre{skill.track ? ` (${skill.track.title})` : ""}: {skill.milestone.text}
                                        </span>
                                    </Link>
                                ) : skill.track ? (
                                    <Link href={`/roadmap/${skill.track.id}`} className="mt-1.5 flex items-start gap-1.5 text-xs text-accent hover:underline">
                                        <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                                        <span>Se aprende en {skill.track.title}</span>
                                    </Link>
                                ) : (
                                    <p className="text-xs text-muted-text mt-1.5">Ningún track la cubre todavía.</p>
                                )}
                                {skill.resource && (
                                    <a href={skill.resource.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-start gap-1.5 text-xs text-accent hover:underline">
                                        <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                                        <span>{skill.resource.text}</span>
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </>
            )}
            <Checklist items={[{ id: REINFORCE_CHECK, label: "Ya sé qué repasar antes de construir" }]} checks={checks} onToggle={onToggle} />
        </div>
    );
}

// ── Día 7 · Enviar ──────────────────────────────────────────────────────────
function Countdown({ deadline, now }: { deadline: string; now: Date }) {
    const close = closingTime(deadline);
    if (!close) return null;
    const minutes = Math.floor((close.getTime() - now.getTime()) / 60_000);
    const sendBy = new Date(close.getTime() - SUBMIT_MARGIN_HOURS * 3_600_000);
    const late = now.getTime() > sendBy.getTime();

    return (
        <div className="space-y-3">
            <div className="p-4 rounded-lg border border-border text-center">
                <p className="section-label mb-1 flex items-center justify-center gap-1.5">
                    <Timer className="w-3 h-3" />
                    Cierre de la convocatoria
                </p>
                {minutes <= 0 ? (
                    <p className="text-2xl font-bold font-mono text-red-400">Cerrada</p>
                ) : (
                    <p className={`text-2xl font-bold font-mono ${late ? "text-red-400" : "text-slate-200"}`}>
                        {Math.floor(minutes / 1440)} d {Math.floor((minutes % 1440) / 60)} h {minutes % 60} min
                    </p>
                )}
                <p className="text-xs text-muted-text mt-1">
                    Cierra el {close.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                </p>
            </div>
            <Notice>
                Envía {SUBMIT_MARGIN_HOURS} h antes: como tarde el {shortDate(sendBy)} a las{" "}
                {sendBy.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}. Las fuentes solo publican el día de cierre,
                así que confirma la hora exacta y la zona horaria en la página de la hackatón.
            </Notice>
        </div>
    );
}

function Finished({
    hackathon,
    insights,
    done,
    onMarkMilestone,
    onUndo,
}: {
    hackathon: ChosenHackathon;
    insights: PlanInsights | null;
    done: Record<string, string>;
    onMarkMilestone: (trackId: string, milestoneId: string) => void;
    onUndo: () => void;
}) {
    return (
        <div className="space-y-5">
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="flex items-start gap-3 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5"
            >
                <span className="w-9 h-9 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Award className="w-4 h-4 text-emerald-400" />
                </span>
                <div>
                    <p className="text-sm font-semibold text-slate-200">Logro desbloqueado: Primera hackatón enviada</p>
                    <p className="text-xs text-muted-text mt-0.5">Enviaste {hackathon.title}. Ya aparece en los logros de tu dashboard.</p>
                </div>
            </motion.div>

            <div>
                <p className="section-label mb-2">Hitos de tus tracks que quizá ya demostraste</p>
                {!insights ? (
                    <InsightsLoading />
                ) : insights.milestones.length === 0 ? (
                    <p className="text-xs text-muted-text">
                        Ningún hito pendiente coincide con las skills de esta hackatón.{" "}
                        <Link href="/roadmap" className="text-accent hover:underline">Revisa tus tracks</Link> por si el proyecto demuestra otro.
                    </p>
                ) : (
                    <>
                        <p className="text-xs text-muted-text mb-3">Márcalos solo si tu proyecto lo demuestra con el repo, la demo o el despliegue.</p>
                        <ul className="space-y-3">
                            {insights.milestones.map((m) => (
                                <li key={m.id}>
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(done[m.id])}
                                            onChange={() => onMarkMilestone(m.trackId, m.id)}
                                            className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 accent-sky-400 shrink-0"
                                        />
                                        <span className="text-sm leading-snug text-slate-200 group-hover:text-white">
                                            {m.text}
                                            <Link href={m.href} className="block text-xs text-muted-text hover:text-accent mt-0.5">
                                                {m.trackTitle} · ver en el track
                                            </Link>
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
                <Link href="/dashboard" className="btn-primary">
                    Ver mis logros
                    <ArrowRight className="w-4 h-4" />
                </Link>
                <button type="button" onClick={onUndo} className="text-xs text-muted-text hover:text-accent">
                    Aún no la envié: deshacer
                </button>
            </div>
        </div>
    );
}

// ── Asistente ───────────────────────────────────────────────────────────────
export default function FirstHackathonWizard() {
    const { state: plan, loaded: planLoaded, choose, setIdea, setFeature, toggleCheck, setSubmitted } = useFirstHackathon();
    const { state: learning, loaded: learningLoaded, toggleMilestone } = useLearningProgress();
    const { profile, loaded: profileLoaded } = useProfile();
    const [result, setResult] = useState<{ hackathonId: string | null; data: FirstHackathonData } | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [selected, setSelected] = useState<StepId | null>(null);
    const now = useNow();

    const ready = planLoaded && learningLoaded && profileLoaded;
    const hackathonId = plan.hackathon?.id ?? null;
    // Solo se recalcula al cambiar de hackatón: así los hitos sugeridos no cambian mientras se marcan
    const latest = useRef({ plan, learning });
    latest.current = { plan, learning };

    useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        getFirstHackathonAction({ hackathon: latest.current.plan.hackathon }, latest.current.learning, profile.certifications)
            .then((data) => {
                if (cancelled) return;
                setResult({ hackathonId, data });
                setFailed(false);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [ready, hackathonId, profile.certifications, attempt]);

    if (!result) {
        return failed ? (
            <div className="card-premium p-8 text-center">
                <p className="text-sm text-slate-200 mb-1">No se pudo preparar el plan.</p>
                <p className="text-xs text-muted-text mb-4">Lo que ya rellenaste sigue guardado en este navegador.</p>
                <button type="button" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }} className="btn-primary">
                    Reintentar
                </button>
            </div>
        ) : (
            <div className="card-premium p-12 flex flex-col items-center justify-center" role="status">
                <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
                <p className="text-sm text-muted-text">Buscando hackatones abiertas para empezar…</p>
            </div>
        );
    }

    const { data } = result;
    const insights = result.hackathonId === hackathonId ? data.plan : null;
    const hackathon = plan.hackathon;
    const active = STEPS.find((s) => s.id === (hackathon ? selected ?? currentStep(plan)?.id ?? "enviar" : "elegir")) ?? STEPS[0];
    const next = STEPS[STEPS.indexOf(active) + 1];
    const doneCount = STEPS.filter((s) => stepDone(s.id, plan)).length;
    const percent = Math.round((doneCount / STEPS.length) * 100);

    let panel: ReactNode;
    if (active.id === "elegir" || !hackathon) {
        panel = (
            <ChooseStep
                data={data}
                chosenId={hackathonId}
                onChoose={({ id, title, url, deadline, tags, matchScore, source }) => {
                    choose({ id, title, url, deadline, tags, matchScore, source });
                    setSelected(null);
                }}
            />
        );
    } else if (active.id === "idea") {
        panel = <IdeaStep plan={plan} insights={insights} onIdea={setIdea} onFeature={setFeature} />;
    } else if (active.id === "reforzar") {
        panel = <ReinforceStep insights={insights} checks={plan.checks} onToggle={toggleCheck} />;
    } else if (active.id === "construir") {
        panel = <Checklist items={buildChecks(plan.features)} checks={plan.checks} onToggle={toggleCheck} />;
    } else if (active.id === "presentar") {
        panel = <Checklist items={PRESENT_CHECKS} checks={plan.checks} onToggle={toggleCheck} />;
    } else if (plan.submittedAt) {
        panel = (
            <Finished
                hackathon={hackathon}
                insights={insights}
                done={learning.done}
                onMarkMilestone={toggleMilestone}
                onUndo={() => setSubmitted(false)}
            />
        );
    } else {
        panel = (
            <div className="space-y-4">
                <Countdown deadline={hackathon.deadline} now={now} />
                <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setSubmitted(true)} className="btn-primary">
                        <Check className="w-4 h-4" />
                        Ya la envié
                    </button>
                    {hackathon.url && (
                        <a href={hackathon.url} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                            Ir a la hackatón
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hackatón elegida y avance */}
            <div className="card-premium p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <p className="text-sm text-slate-200 min-w-0">
                        {hackathon ? (
                            <>
                                <span className="font-medium">{hackathon.title}</span>
                                <span className="text-muted-text" suppressHydrationWarning> · {describeClosing(hackathon.deadline, now).label}</span>
                            </>
                        ) : (
                            "Aún no has elegido hackatón"
                        )}
                    </p>
                    <span className="text-xs text-slate-300 shrink-0">
                        {doneCount} de {STEPS.length} pasos
                        <span className="ml-2 font-mono text-muted-text">{percent}%</span>
                    </span>
                </div>
                <div
                    className="h-2 rounded-full bg-slate-800 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Avance del plan de 7 días"
                >
                    <motion.div
                        className="h-full rounded-full bg-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                </div>
                <p className="text-xs text-muted-text mt-3">
                    El plan se guarda en este navegador. Los 7 días se cuentan hacia atrás desde el cierre de la hackatón que elijas.
                </p>
            </div>

            {/* Los 7 días */}
            <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {STEPS.map((step, index) => {
                    const status = stepStatus(step, plan, now);
                    const style = STATUS_STYLE[status];
                    const isActive = step.id === active.id;
                    return (
                        <motion.li
                            key={step.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
                        >
                            <button
                                type="button"
                                onClick={() => setSelected(step.id)}
                                disabled={!hackathon && step.id !== "elegir"}
                                aria-current={isActive ? "step" : undefined}
                                className={`w-full h-full text-left p-3 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    isActive ? "border-accent/60 bg-accent/5" : "border-border bg-card hover:border-accent/40"
                                }`}
                            >
                                <span className="block text-[11px] font-mono text-muted-text">{dayLabel(step)}</span>
                                <span className="block text-sm font-medium text-slate-200">{step.title}</span>
                                <span className="block text-[11px] text-muted-text mt-0.5" suppressHydrationWarning>
                                    {hackathon ? stepDates(step, hackathon.deadline) : "Sin fecha"}
                                </span>
                                <span className={`inline-block mt-2 px-1.5 py-0.5 text-[10px] rounded-md border ${style.chip}`}>{style.label}</span>
                            </button>
                        </motion.li>
                    );
                })}
            </ol>

            {/* Paso activo */}
            <motion.section
                key={active.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="card-premium p-5"
            >
                <div className="mb-4">
                    <h2 className="text-base font-semibold text-slate-200">
                        {dayLabel(active)} · {active.title}
                    </h2>
                    <p className="text-sm text-muted-text">{active.summary}</p>
                </div>
                {panel}
                {next && hackathon && stepDone(active.id, plan) && (
                    <div className="mt-5 pt-4 border-t border-border">
                        <button type="button" onClick={() => setSelected(next.id)} className="btn-ghost">
                            Siguiente: {dayLabel(next)} · {next.title}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </motion.section>
        </div>
    );
}
