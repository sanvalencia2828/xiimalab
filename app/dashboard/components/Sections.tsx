"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
    ArrowRight, Award, Clock, ExternalLink, Flame, FolderKanban, Lock, Map as MapIcon, Network, Wallet, Zap,
} from "lucide-react";
import type {
    AchievementRow, DashboardData, ProjectRow, RankingData, SkillRow,
} from "@/lib/dashboard/types";
import { describeClosing, formatPrize } from "@/lib/hackathons/format";
import { CertifiedChip } from "@/components/skills/EvidenceChip";
import { URGENCY_WINDOW_DAYS } from "@/lib/learning/demand";
import { useWallet } from "@/lib/WalletContext";

// ── Piezas compartidas ──────────────────────────────────────────────────────
function Section({ title, icon, aside, children }: { title: string; icon: ReactNode; aside?: ReactNode; children: ReactNode }) {
    return (
        <section className="card-premium p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                    {icon}
                    {title}
                </h2>
                {aside}
            </div>
            {children}
        </section>
    );
}

function Bar({ percent, label }: { percent: number; label: string }) {
    return (
        <div
            className="h-1.5 rounded-full bg-slate-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
        >
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
    );
}

const chipClass = "px-2 py-0.5 bg-sky-500/10 text-sky-300 text-xs rounded-md border border-sky-500/20";

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** "Devpost, DoraHacks y Devfolio" */
function joinNames(names: string[]): string {
    return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function updatedAgo(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (minutes < 1) return "actualizado hace menos de 1 min";
    return minutes < 60 ? `actualizado hace ${minutes} min` : `actualizado hace ${Math.round(minutes / 60)} h`;
}

// ── Mis tracks ──────────────────────────────────────────────────────────────
export function TracksSection({
    data,
    onMarkMilestone,
}: {
    data: DashboardData;
    onMarkMilestone: (trackId: string, milestoneId: string) => void;
}) {
    const { tracks, nextMilestones } = data;

    if (tracks.length === 0) {
        return (
            <Section title="Mis tracks" icon={<MapIcon className="w-4 h-4 text-accent" />}>
                <div className="py-6 text-center">
                    <p className="text-sm text-slate-200 mb-1">Todavía no tienes ningún track activo.</p>
                    <p className="text-xs text-muted-text mb-4">Elige uno y marca hitos a medida que los demuestres.</p>
                    <Link href="/roadmap" className="btn-primary">
                        Elegir un track
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </Section>
        );
    }

    return (
        <Section
            title="Mis tracks"
            icon={<MapIcon className="w-4 h-4 text-accent" />}
            aside={<Link href="/roadmap" className="text-xs text-muted-text hover:text-accent">Ver todos los tracks</Link>}
        >
            <ul className="space-y-2 mb-5">
                {tracks.map((track) => (
                    <li key={track.id}>
                        <Link
                            href={`/roadmap/${track.id}`}
                            className="block p-3 rounded-lg border border-border hover:border-accent/40 transition-colors"
                        >
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <span className="text-sm font-medium text-slate-200">{track.title}</span>
                                <span className="text-xs text-slate-300 shrink-0">
                                    {track.done} de {track.total} hitos
                                    <span className="ml-2 font-mono text-muted-text">{track.percent}%</span>
                                </span>
                            </div>
                            <Bar percent={track.percent} label={`Avance de ${track.title}`} />
                            <p className="text-xs text-muted-text mt-2">
                                {track.phase ? `Fase actual: ${track.phase}` : "Track completo"}
                                {" · "}
                                {track.lastMilestoneAt ? `Último hito: ${formatDate(track.lastMilestoneAt)}` : "Aún sin hitos marcados"}
                            </p>
                        </Link>
                    </li>
                ))}
            </ul>

            <p className="section-label mb-2">Próximos hitos</p>
            {nextMilestones.length === 0 ? (
                <p className="text-xs text-muted-text">No quedan hitos pendientes en tus tracks activos.</p>
            ) : (
                <ul className="space-y-3">
                    {nextMilestones.map((m) => (
                        <li key={m.id} className="text-sm">
                            <Link href={`/roadmap/${m.trackId}#${m.id}`} className="text-slate-200 hover:text-accent leading-snug">
                                {m.text}
                            </Link>
                            <p className="text-xs text-muted-text mt-0.5">
                                {m.trackTitle} · {m.phaseTitle}
                            </p>
                            {m.evidence.length > 0 && (
                                <p className="text-xs mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-emerald-400">Evidencia: {m.evidence.slice(0, 2).join(", ")}</span>
                                    <button
                                        type="button"
                                        onClick={() => onMarkMilestone(m.trackId, m.id)}
                                        className="text-accent hover:underline"
                                    >
                                        ¿Ya lo demostraste? Márcalo como hecho
                                    </button>
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Section>
    );
}

// ── Mis proyectos ───────────────────────────────────────────────────────────
function projectRoadmapLabel(project: ProjectRow): string {
    if (project.roadmap === "none") return "Sin roadmap";
    if (project.roadmap === "complete") return `Roadmap completo (${project.roadmapTotal} tareas)`;
    return `Próximo: ${project.nextTask ?? "—"}`;
}

export function ProjectsSection({ projects }: { projects: ProjectRow[] }) {
    return (
        <Section
            title="Mis proyectos"
            icon={<FolderKanban className="w-4 h-4 text-accent" />}
            aside={<Link href="/projects" className="text-xs text-muted-text hover:text-accent">Ver detalle</Link>}
        >
            <ul className="divide-y divide-border">
                {projects.map((project) => (
                    <li key={project.title} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            {project.url ? (
                                <a
                                    href={project.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-slate-200 hover:text-accent inline-flex items-center gap-1 min-w-0"
                                >
                                    <span className="truncate">{project.name}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                            ) : (
                                <span className="text-sm font-medium text-slate-200 truncate">{project.name}</span>
                            )}
                            <span className="text-xs font-mono text-slate-300 shrink-0" title={project.error ?? undefined}>
                                {project.percent === null ? "Avance no disponible" : `${project.percent}%`}
                            </span>
                        </div>
                        {project.percent !== null && <Bar percent={project.percent} label={`Avance de ${project.name}`} />}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {project.skills.length === 0 ? (
                                <span className="text-xs text-muted-text">Su stack no coincide con ninguna skill del match</span>
                            ) : (
                                project.skills.map((skill) => (
                                    <span key={skill.key} className={chipClass}>{skill.label}</span>
                                ))
                            )}
                        </div>
                        <p className="text-xs text-muted-text mt-2">{projectRoadmapLabel(project)}</p>
                    </li>
                ))}
            </ul>
        </Section>
    );
}

// ── Mapa de skills ──────────────────────────────────────────────────────────
function SkillItem({ skill, reinforce }: { skill: SkillRow; reinforce: boolean }) {
    return (
        <li className="p-3 rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{skill.label}</span>
                    {skill.certification && <CertifiedChip provider={skill.certification.provider} url={skill.certification.url} />}
                </span>
                <span className="text-xs text-muted-text shrink-0">
                    {skill.demand} {skill.demand === 1 ? "hackatón abierta" : "hackatones abiertas"}
                </span>
            </div>
            <p className="text-xs text-muted-text">
                {skill.projects.length === 0
                    ? "Ningún proyecto la usa"
                    : `${skill.projects.length} ${skill.projects.length === 1 ? "proyecto" : "proyectos"}: ${skill.projects.join(", ")}`}
                {skill.track && (
                    <>
                        {" · Se aprende en "}
                        <Link href={`/roadmap/${skill.track.id}`} className="text-slate-300 hover:text-accent">
                            {skill.track.title}
                        </Link>
                    </>
                )}
            </p>
            {reinforce && skill.milestone && (
                <Link href={skill.milestone.href} className="mt-2 flex items-start gap-1.5 text-xs text-accent hover:underline">
                    <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Hito que la cubre: {skill.milestone.text}</span>
                </Link>
            )}
        </li>
    );
}

export function SkillsMap({ data }: { data: DashboardData }) {
    const { strong, toReinforce } = data.skills;
    const icon = <Network className="w-4 h-4 text-accent" />;

    if (!data.hackathonsAvailable) {
        return (
            <Section title="Mapa de skills" icon={icon}>
                <p className="text-xs text-muted-text">
                    No se pudo consultar el agregador de hackatones, así que ahora no hay datos de demanda.
                </p>
            </Section>
        );
    }

    return (
        <Section title="Mapa de skills" icon={icon}>
            <p className="text-xs text-muted-text mb-4">
                Skills con demanda alta en las {data.ranking.total} hackatones abiertas, cruzadas con el stack de tus proyectos.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <p className="section-label mb-2">Fuertes</p>
                    {strong.length === 0 ? (
                        <p className="text-xs text-muted-text">Ninguna skill con demanda alta tiene todavía un proyecto o una certificación.</p>
                    ) : (
                        <ul className="space-y-2">
                            {strong.map((skill) => <SkillItem key={skill.key} skill={skill} reinforce={false} />)}
                        </ul>
                    )}
                </div>
                <div>
                    <p className="section-label mb-2">Por reforzar</p>
                    {toReinforce.length === 0 ? (
                        <p className="text-xs text-muted-text">Tus proyectos y certificaciones ya cubren todas las skills con demanda alta.</p>
                    ) : (
                        <ul className="space-y-2">
                            {toReinforce.map((skill) => <SkillItem key={skill.key} skill={skill} reinforce />)}
                        </ul>
                    )}
                </div>
            </div>
        </Section>
    );
}

// ── Lo más demandado ahora ──────────────────────────────────────────────────
export function DemandRanking({ ranking }: { ranking: RankingData }) {
    const icon = <Flame className="w-4 h-4 text-accent" />;

    if (ranking.rows.length === 0) {
        return (
            <Section title="Lo más demandado ahora" icon={icon}>
                <p className="text-xs text-muted-text">
                    No se pudo consultar el agregador de hackatones, así que ahora no hay ranking.
                </p>
            </Section>
        );
    }

    return (
        <Section title="Lo más demandado ahora" icon={icon}>
            <ol className="space-y-4">
                {ranking.rows.map((row) => (
                    <li key={row.trackId}>
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-mono text-accent shrink-0">#{row.rank}</span>
                            <Link href={`/roadmap/${row.trackId}`} className="text-sm font-medium text-slate-200 hover:text-accent">
                                {row.title}
                            </Link>
                        </div>
                        <Bar percent={row.relative} label={`Demanda de ${row.title} frente al primero`} />
                        <p className="text-xs text-muted-text mt-1.5">
                            {row.opportunities} {row.opportunities === 1 ? "convocatoria" : "convocatorias"}
                            {" · "}
                            {row.prizeUsd > 0 ? `${formatPrize(row.prizeUsd, "USD")} en premios` : "Sin premios en USD"}
                            {" · "}
                            {row.closingSoon} {row.closingSoon === 1 ? "cierra" : "cierran"} en {URGENCY_WINDOW_DAYS} días
                        </p>
                        {row.active ? (
                            <p className="text-xs text-emerald-400 mt-1">Lo estás aprendiendo · {row.percent} %</p>
                        ) : (
                            row.rank === 1 && (
                                <Link href={`/roadmap/${row.trackId}`} className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                                    Empezar este track
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
                            )
                        )}
                    </li>
                ))}
            </ol>
            <p className="text-[11px] text-muted-text mt-4 pt-3 border-t border-border" suppressHydrationWarning>
                Basado en {ranking.total} convocatorias abiertas de {joinNames(ranking.sources)}
                {ranking.fetchedAt ? ` · ${updatedAgo(ranking.fetchedAt)}` : ""}
            </p>
        </Section>
    );
}

// ── Practica lo que aprendes ────────────────────────────────────────────────
export function PracticeSection({ data }: { data: DashboardData }) {
    const icon = <Zap className="w-4 h-4 text-accent" />;
    let empty: string | null = null;
    if (data.practicePhases.length === 0) empty = "Elige un track para ver hackatones abiertas que encajen con tu fase actual.";
    else if (!data.hackathonsAvailable) empty = "No se pudo consultar el agregador de hackatones.";
    else if (data.practice.length === 0) empty = "Ninguna hackatón abierta coincide con las skills de tu fase actual ahora mismo.";

    return (
        <Section title="Practica lo que aprendes" icon={icon}>
            {data.practicePhases.length > 0 && (
                <p className="text-xs text-muted-text mb-3">Fase actual: {data.practicePhases.join(" · ")}</p>
            )}
            {empty ? (
                <p className="text-xs text-muted-text">{empty}</p>
            ) : (
                <ul className="space-y-3">
                    {data.practice.map((h) => {
                        const closing = describeClosing(h.deadline);
                        return (
                            <li key={h.id}>
                                {h.url ? (
                                    <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-200 hover:text-accent line-clamp-2">
                                        {h.title}
                                    </a>
                                ) : (
                                    <span className="text-sm text-slate-200 line-clamp-2">{h.title}</span>
                                )}
                                <p className={`flex items-center gap-1 text-xs mt-0.5 ${closing.urgent ? "text-red-400" : "text-muted-text"}`} suppressHydrationWarning>
                                    <Clock className="w-3 h-3" />
                                    {closing.label} · {h.matchedSkills.join(", ")}
                                </p>
                                {h.project && <p className="text-xs text-emerald-400 mt-0.5">Puedes presentar {h.project}</p>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Section>
    );
}

// ── Wallet y escrow ─────────────────────────────────────────────────────────
const WALLET_FIELDS = ["Saldo", "Ganado", "En staking", "Transacciones"];

export function WalletCard() {
    const { isConnected, isLoaded, publicKey } = useWallet();
    const icon = <Wallet className="w-4 h-4 text-accent" />;
    if (!isLoaded) return null;

    if (!isConnected) {
        return (
            <Section title="Wallet y escrow" icon={icon}>
                <p className="text-sm text-slate-200 mb-3">Conecta tu wallet para el escrow educativo</p>
                <Link href="/settings" className="btn-ghost">
                    Ir a Ajustes
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </Section>
        );
    }

    return (
        <Section title="Wallet y escrow" icon={icon}>
            <p className="text-xs text-muted-text mb-1">Wallet Stellar conectada</p>
            <p className="text-sm font-mono text-slate-200 mb-4">
                {publicKey?.slice(0, 8)}…{publicKey?.slice(-6)}
            </p>
            <dl className="space-y-2">
                {WALLET_FIELDS.map((field) => (
                    <div key={field} className="flex items-center justify-between text-xs">
                        <dt className="text-muted-text">{field}</dt>
                        <dd className="text-slate-400">Próximamente</dd>
                    </div>
                ))}
            </dl>
        </Section>
    );
}

// ── Logros ──────────────────────────────────────────────────────────────────
export function AchievementsSection({ achievements }: { achievements: AchievementRow[] }) {
    const unlocked = achievements.filter((a) => a.unlocked).length;

    return (
        <Section
            title="Logros"
            icon={<Award className="w-4 h-4 text-accent" />}
            aside={<span className="text-xs text-muted-text">{unlocked} de {achievements.length}</span>}
        >
            <ul className="space-y-3">
                {achievements.map((a) => (
                    <li key={a.id} className={`flex items-start gap-3 ${a.unlocked ? "" : "opacity-60"}`}>
                        <span
                            className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${
                                a.unlocked ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-600/40 bg-slate-700/30"
                            }`}
                        >
                            {a.unlocked ? <Award className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
                        </span>
                        <div className="min-w-0">
                            <p className={`text-sm font-medium ${a.unlocked ? "text-slate-200" : "text-slate-400"}`}>{a.title}</p>
                            <p className="text-xs text-muted-text">
                                {a.detail}
                                {a.unlocked && a.date ? ` · ${formatDate(a.date)}` : ""}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </Section>
    );
}
