/**
 * lib/dashboard/build.ts — SERVER ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 * Calcula el Dashboard del Estudiante a partir de datos reales:
 *   • el avance de los tracks (hitos marcados, con su fecha),
 *   • los proyectos del portafolio y su avance medido en GitHub,
 *   • las hackatones abiertas del agregador en vivo,
 *   • la primera acción del usuario sobre una hackatón con match alto,
 *   • la primera hackatón enviada con el plan de /first-hackathon.
 *
 * Si GitHub o el agregador fallan, la sección afectada llega vacía o marcada
 * como no disponible; nunca se rellena con valores de ejemplo.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { MATCH_ACHIEVEMENT_SCORE, type HackathonAction } from "@/lib/hackathons/actions";
import type { FirstHackathonSubmission } from "@/lib/first-hackathon/plan";
import { getLiveHackathons, type LiveResult, type LiveSource } from "@/lib/hackathons/live";
import { rankTracks } from "@/lib/learning/demand";
import { reinforceLink } from "@/lib/learning/resources";
import {
    currentPhase, isTrackActive, lastCompletedAt, type LearningState, trackProgress,
} from "@/lib/learning/progress";
import { canonicalSkills, findSkills, SKILLS, skillLabel, skillsFromStack } from "@/lib/learning/skills";
import { TRACKS, type Milestone, type Phase, type Track } from "@/lib/learning/tracks";
import { highDemandThreshold, skillDemand } from "@/lib/market/relevance";
import { certificationFor, type Certification } from "@/lib/profile/certifications";
import { PROJECTS } from "@/lib/projects/data";
import { getRepoProgress, repoFromUrl, type ProjectProgress } from "@/lib/projects/progress";
import type { AggregatedHackathon } from "@/lib/types";
import type {
    AchievementRow, DashboardData, NextMilestoneRow, PracticeRow, ProjectRow, SkillRow, TrackRow,
} from "./types";

const WEEK_MS = 7 * 86_400_000;
const NEXT_MILESTONES = 3;
const PRACTICE_HACKATHONS = 3;
const MAX_PROJECT_SKILLS = 5;
/** Un proyecto es evidencia de una fase si su stack cubre al menos esta parte de sus skills (y 2 como mínimo). */
const EVIDENCE_MIN_COVERAGE = 0.75;
const ACHIEVEMENT_TRACK_PERCENT = 50;

const SOURCE_NAMES: Record<LiveSource, string> = { devpost: "Devpost", dorahacks: "DoraHacks", devfolio: "Devfolio" };

export interface PortfolioProject {
    title: string;
    /** "Rastreador · Londrina Radar Comercial" → "Rastreador" */
    name: string;
    url: string | null;
    skills: string[];
    progress: ProjectProgress | null;
}

export async function loadHackathons(): Promise<LiveResult | null> {
    try {
        const live = await getLiveHackathons();
        return live.hackathons.length > 0 ? live : null;
    } catch (err) {
        console.warn("[dashboard] agregador no disponible:", err instanceof Error ? err.message : err);
        return null;
    }
}

/** Nombres visibles de las fuentes que respondieron. */
export function liveSourceNames(live: LiveResult): string[] {
    return (Object.keys(live.sources) as LiveSource[]).filter((s) => live.sources[s].ok).map((s) => SOURCE_NAMES[s]);
}

export async function loadProjects(): Promise<PortfolioProject[]> {
    return Promise.all(
        PROJECTS.map(async (p) => {
            const repo = repoFromUrl(p.githubUrl);
            return {
                title: p.title,
                name: p.title.split(" · ")[0],
                url: p.liveUrl ?? p.githubUrl ?? null,
                skills: skillsFromStack(p.stack ?? []),
                progress: repo ? await getRepoProgress(repo, p.liveUrl ?? null) : null,
            };
        }),
    );
}

function measured(p: PortfolioProject): ProjectProgress | null {
    return p.progress && !p.progress.error ? p.progress : null;
}

/** Proyecto que cubre más de las skills pedidas; a igualdad, el más avanzado. null si ninguno cubre alguna. */
export function bestProjectFor(asked: string[], projects: PortfolioProject[]): PortfolioProject | null {
    return (
        projects
            .map((project) => ({
                project,
                overlap: asked.filter((skill) => project.skills.includes(skill)).length,
                percent: measured(project)?.percent ?? 0,
            }))
            .filter((p) => p.overlap > 0)
            .sort((a, b) => b.overlap - a.overlap || b.percent - a.percent)[0]?.project ?? null
    );
}

function projectRow(p: PortfolioProject): ProjectRow {
    const progress = measured(p);
    const roadmap = progress?.roadmap;
    const hasRoadmap = Boolean(roadmap && roadmap.total > 0);
    return {
        title: p.title,
        name: p.name,
        url: p.url,
        percent: progress ? progress.percent : null,
        skills: p.skills.slice(0, MAX_PROJECT_SKILLS).map((key) => ({ key, label: skillLabel(key) })),
        roadmap: !hasRoadmap ? "none" : roadmap && roadmap.done === roadmap.total ? "complete" : "pending",
        roadmapDone: roadmap?.done ?? 0,
        roadmapTotal: roadmap?.total ?? 0,
        nextTask: roadmap?.pending[0]?.text ?? null,
        error: p.progress?.error ?? (p.progress ? null : "Sin repositorio de GitHub"),
    };
}

/** Proyectos cuyo stack cubre las skills de la fase. */
function evidenceFor(phase: Phase, projects: PortfolioProject[]): string[] {
    const skills = canonicalSkills(phase.skills);
    const needed = Math.max(2, Math.ceil(skills.length * EVIDENCE_MIN_COVERAGE));
    return projects
        .map((p) => ({ name: p.name, covered: skills.filter((skill) => p.skills.includes(skill)).length }))
        .filter((p) => p.covered >= needed)
        .sort((a, b) => b.covered - a.covered)
        .map((p) => p.name);
}

/** Los primeros hitos pendientes, repartidos entre los tracks activos. */
function nextMilestones(active: Track[], state: LearningState, projects: PortfolioProject[]): NextMilestoneRow[] {
    const queues = active.map((track) =>
        track.phases.flatMap((phase) =>
            phase.milestones.filter((m) => !state.done[m.id]).map((milestone) => ({ track, phase, milestone })),
        ),
    );
    const rows: NextMilestoneRow[] = [];
    for (let i = 0; rows.length < NEXT_MILESTONES && queues.some((q) => q.length > i); i++) {
        for (const queue of queues) {
            const item = queue[i];
            if (!item || rows.length >= NEXT_MILESTONES) continue;
            rows.push({
                id: item.milestone.id,
                text: item.milestone.text,
                trackId: item.track.id,
                trackTitle: item.track.title,
                phaseTitle: item.phase.title,
                evidence: evidenceFor(item.phase, projects),
            });
        }
    }
    return rows;
}

/** Cómo reforzar una skill: el track y el primer hito pendiente que la cubren, y un recurso reconocido. */
export function reinforcePath(
    skill: string,
    state: LearningState,
    activeIds: Set<string>,
): Pick<SkillRow, "track" | "milestone" | "resource"> {
    const where = whereToLearn(skill, state, activeIds);
    return {
        track: where ? { id: where.track.id, title: where.track.title, active: activeIds.has(where.track.id) } : null,
        milestone: where?.milestone
            ? { id: where.milestone.id, text: where.milestone.text, href: `/roadmap/${where.track.id}#${where.milestone.id}` }
            : null,
        resource: reinforceLink(skill, skillLabel(skill)),
    };
}

/** Dónde se aprende una skill: la primera fase que la cubre y aún tiene hitos pendientes (antes en tracks activos). */
export function whereToLearn(
    skill: string,
    state: LearningState,
    activeIds: Set<string>,
): { track: Track; milestone: Milestone | null } | null {
    const ordered = [...TRACKS.filter((t) => activeIds.has(t.id)), ...TRACKS.filter((t) => !activeIds.has(t.id))];
    let covered: Track | null = null;
    for (const track of ordered) {
        for (const phase of track.phases) {
            if (!canonicalSkills(phase.skills).includes(skill)) continue;
            covered ??= track;
            const milestone = phase.milestones.find((m) => !state.done[m.id]);
            if (milestone) return { track, milestone };
        }
    }
    return covered ? { track: covered, milestone: null } : null;
}

function skillMap(
    state: LearningState,
    activeIds: Set<string>,
    projects: PortfolioProject[],
    hackathons: AggregatedHackathon[],
    certifications: Certification[],
): DashboardData["skills"] {
    const demand = skillDemand(SKILLS, hackathons);
    const high = highDemandThreshold(demand);
    const strong: SkillRow[] = [];
    const toReinforce: SkillRow[] = [];

    for (const skill of SKILLS) {
        if (demand[skill] < high) continue;
        const used = projects.filter((p) => p.skills.includes(skill)).map((p) => p.name);
        const certification = certificationFor(skill, certifications);
        const row: SkillRow = {
            key: skill,
            label: skillLabel(skill),
            projects: used,
            certification: certification ? { provider: certification.provider, url: certification.url } : null,
            demand: demand[skill],
            ...reinforcePath(skill, state, activeIds),
        };
        (used.length > 0 || certification ? strong : toReinforce).push(row);
    }

    const byDemand = (a: SkillRow, b: SkillRow) => b.demand - a.demand;
    // Las certificadas van primero: es la evidencia más fuerte
    const byEvidence = (a: SkillRow, b: SkillRow) => Number(Boolean(b.certification)) - Number(Boolean(a.certification)) || byDemand(a, b);
    return { strong: strong.sort(byEvidence), toReinforce: toReinforce.sort(byDemand) };
}

/** Hackatones abiertas que coinciden con las skills de las fases actuales, con el proyecto que mejor encaja. */
function practice(phases: Phase[], projects: PortfolioProject[], hackathons: AggregatedHackathon[]): PracticeRow[] {
    const skills = Array.from(new Set(phases.flatMap((phase) => phase.skills)));
    if (skills.length === 0) return [];

    return hackathons
        .map((h) => ({ h, matched: findSkills(skills, h.tags ?? []) }))
        .filter(({ matched }) => matched.length > 0)
        .sort((a, b) => b.matched.length - a.matched.length || a.h.deadline.localeCompare(b.h.deadline))
        .slice(0, PRACTICE_HACKATHONS)
        .map(({ h, matched }) => {
            const best = bestProjectFor(findSkills(SKILLS, h.tags ?? []), projects);
            return {
                id: h.id,
                title: h.title,
                url: h.source_url,
                deadline: h.deadline,
                source: h.source,
                matchedSkills: matched.map(skillLabel),
                project: best?.name ?? null,
            };
        });
}

function achievements(
    state: LearningState,
    projects: PortfolioProject[],
    hackathons: AggregatedHackathon[] | null,
    matchAction: HackathonAction | null,
    firstHackathon: FirstHackathonSubmission | null,
): AchievementRow[] {
    const dates = Object.values(state.done).sort();
    const halfway = TRACKS.map((track) => ({ track, progress: trackProgress(track, state.done) }))
        .filter(({ progress }) => progress.percent >= ACHIEVEMENT_TRACK_PERCENT)
        .sort((a, b) => b.progress.percent - a.progress.percent)[0];
    const highMatches = hackathons?.filter((h) => h.match_score > MATCH_ACHIEVEMENT_SCORE).length ?? null;
    const howToMatch = `Se desbloquea al analizar el match o abrir "Ir a la hackatón" de una con más del ${MATCH_ACHIEVEMENT_SCORE} % de match`;
    const finished = projects.find((p) => {
        const roadmap = measured(p)?.roadmap;
        return roadmap && roadmap.total > 0 && roadmap.done === roadmap.total;
    });

    return [
        {
            id: "first-milestone",
            title: "Primer hito",
            unlocked: dates.length > 0,
            detail: dates.length > 0 ? "Marcaste tu primer hito" : "Se desbloquea al marcar un hito en cualquier track",
            date: dates[0] ?? null,
        },
        {
            id: "track-half",
            title: `Primer track al ${ACHIEVEMENT_TRACK_PERCENT} %`,
            unlocked: Boolean(halfway),
            detail: halfway
                ? `${halfway.track.title} · ${halfway.progress.percent} %`
                : "Se desbloquea al completar la mitad de los hitos de un track",
            date: null,
        },
        {
            id: "match-70",
            title: `Hackatón con match > ${MATCH_ACHIEVEMENT_SCORE} %`,
            unlocked: Boolean(matchAction),
            detail: matchAction
                ? `${matchAction.kind === "analyze" ? "Analizaste el match de" : "Abriste"} ${matchAction.title} · ${matchAction.matchScore} %`
                : highMatches === null
                  ? howToMatch
                  : highMatches === 0
                    ? `${howToMatch}; hoy ninguna abierta lo supera`
                    : `${howToMatch}; hoy hay ${highMatches} ${highMatches === 1 ? "abierta" : "abiertas"}`,
            date: matchAction?.at ?? null,
        },
        {
            id: "first-hackathon",
            title: "Primera hackatón enviada",
            unlocked: Boolean(firstHackathon),
            detail: firstHackathon
                ? `Enviaste ${firstHackathon.title}`
                : "Se desbloquea al completar el plan de 7 días del Modo primera hackatón",
            date: firstHackathon?.at ?? null,
        },
        {
            id: "roadmap-100",
            title: "Proyecto con roadmap al 100 %",
            unlocked: Boolean(finished),
            detail: finished
                ? `${finished.name} completó su ROADMAP.md`
                : "Se desbloquea al completar todas las tareas del ROADMAP.md de un proyecto",
            date: null,
        },
    ];
}

export async function buildDashboard(
    state: LearningState,
    matchAction: HackathonAction | null = null,
    certifications: Certification[] = [],
    firstHackathon: FirstHackathonSubmission | null = null,
    now: Date = new Date(),
): Promise<DashboardData> {
    const [live, projects] = await Promise.all([loadHackathons(), loadProjects()]);
    const hackathons = live?.hackathons ?? [];

    const active = TRACKS.filter((track) => isTrackActive(track, state));
    const activeIds = new Set(active.map((t) => t.id));
    const progressOf = new Map(TRACKS.map((track) => [track.id, trackProgress(track, state.done)]));

    const tracks: TrackRow[] = active.map((track) => {
        const progress = progressOf.get(track.id) ?? { done: 0, total: 0, percent: 0 };
        return {
            id: track.id,
            title: track.title,
            ...progress,
            phase: currentPhase(track, state.done)?.title ?? null,
            lastMilestoneAt: lastCompletedAt(track, state.done),
        };
    });

    const done = tracks.reduce((sum, t) => sum + t.done, 0);
    const total = tracks.reduce((sum, t) => sum + t.total, 0);
    const milestonesThisWeek = Object.values(state.done).filter((date) => {
        const age = now.getTime() - new Date(date).getTime();
        return age >= 0 && age <= WEEK_MS;
    }).length;

    const currentPhases = active
        .map((track) => currentPhase(track, state.done))
        .filter((phase): phase is Phase => phase !== null);

    return {
        summary: {
            done,
            total,
            percent: total > 0 ? Math.round((done / total) * 100) : 0,
            activeTracks: active.length,
            milestonesThisWeek,
            demonstratedSkills: new Set([...projects.flatMap((p) => p.skills), ...certifications.flatMap((c) => c.skills)]).size,
        },
        tracks,
        nextMilestones: nextMilestones(active, state, projects),
        projects: projects.map(projectRow),
        skills: skillMap(state, activeIds, projects, hackathons, certifications),
        practicePhases: currentPhases.map((phase) => phase.title),
        practice: practice(currentPhases, projects, hackathons),
        achievements: achievements(state, projects, live ? hackathons : null, matchAction, firstHackathon),
        ranking: {
            rows: rankTracks(TRACKS, hackathons, now).map((row) => ({
                ...row,
                active: activeIds.has(row.trackId),
                percent: progressOf.get(row.trackId)?.percent ?? 0,
            })),
            total: hackathons.length,
            sources: live ? liveSourceNames(live) : [],
            fetchedAt: live?.fetched_at ?? null,
        },
        hackathonsAvailable: live !== null,
    };
}
