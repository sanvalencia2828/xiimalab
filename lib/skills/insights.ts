/**
 * lib/skills/insights.ts — SERVER ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 * Skills frente al mercado, con datos reales:
 *   • nivel por evidencia: proyectos del portafolio que usan la skill e hitos
 *     marcados en las fases que la cubren (nunca un porcentaje autodeclarado),
 *   • demanda actual: hackatones abiertas cuyas etiquetas la piden y la suma de
 *     sus premios en USD verificados,
 *   • palabras clave: las etiquetas más repetidas en esas convocatorias.
 *
 * Sin snapshots históricos no hay tendencia que calcular: no se muestra ninguna.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { liveSourceNames, loadHackathons, loadProjects, whereToLearn, type PortfolioProject } from "@/lib/dashboard/build";
import { formatPrize, isUsdPrize } from "@/lib/hackathons/format";
import { buildTagOptions } from "@/lib/hackathons/tags";
import { isTrackActive, type LearningState } from "@/lib/learning/progress";
import { canonicalSkills, findSkills, SKILLS, skillLabel } from "@/lib/learning/skills";
import { TRACKS } from "@/lib/learning/tracks";
import { highDemandThreshold } from "@/lib/market/relevance";
import type { AggregatedHackathon } from "@/lib/types";
import type { EvidenceLevel, SkillInsight, SkillInsights, SkillRecommendation } from "./types";

const RISING_SKILLS = 4;
const MAX_KEYWORDS = 5;

function evidenceLevel(projects: number, milestones: number): EvidenceLevel {
    if (projects >= 2) return "consolidated";
    if (projects === 1) return "demonstrated";
    return milestones > 0 ? "learning" : "none";
}

function milestonesDone(skill: string, state: LearningState): number {
    return TRACKS.flatMap((track) => track.phases)
        .filter((phase) => canonicalSkills(phase.skills).includes(skill))
        .reduce((sum, phase) => sum + phase.milestones.filter((m) => state.done[m.id]).length, 0);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function recommend(skills: SkillInsight[]): SkillRecommendation | null {
    const gap = skills.find((s) => s.highDemand && s.projects.length === 0);
    if (gap) {
        const prizes = gap.prizeUsd > 0 ? ` (${formatPrize(gap.prizeUsd, "USD")} en premios)` : "";
        const learning = gap.milestonesDone > 0 ? `llevas ${plural(gap.milestonesDone, "hito", "hitos")}, pero ` : "";
        return {
            text: `Refuerza ${gap.label}: ${plural(gap.demand, "convocatoria", "convocatorias")}${prizes}, ${learning}ningún proyecto la demuestra.`,
            href: gap.milestone?.href ?? (gap.track ? `/roadmap/${gap.track.id}` : "/roadmap"),
            linkLabel: gap.milestone ? `Empieza por: ${gap.milestone.text}` : "Ver el roadmap",
        };
    }
    const best = skills.find((s) => s.demand > 0 && s.projects.length > 0);
    if (best) {
        return {
            text: `Aprovecha ${best.label}: ${plural(best.demand, "convocatoria abierta la pide", "convocatorias abiertas la piden")} y ${plural(best.projects.length, "proyecto tuyo la demuestra", "proyectos tuyos la demuestran")} (${best.projects.join(", ")}).`,
            href: "/hackathons",
            linkLabel: "Ver hackatones abiertas",
        };
    }
    return null;
}

/** Cálculo puro, separado de la carga de datos. */
export function computeSkillInsights(
    state: LearningState,
    projects: PortfolioProject[],
    hackathons: AggregatedHackathon[],
): Pick<SkillInsights, "skills" | "rising" | "recommendation"> {
    const activeIds = new Set(TRACKS.filter((track) => isTrackActive(track, state)).map((t) => t.id));
    const asking = new Map<string, AggregatedHackathon[]>(SKILLS.map((skill) => [skill, []]));
    for (const h of hackathons) {
        for (const skill of findSkills(SKILLS, h.tags ?? [])) asking.get(skill)?.push(h);
    }
    const high = highDemandThreshold(Object.fromEntries(SKILLS.map((skill) => [skill, asking.get(skill)?.length ?? 0])));

    const skills = SKILLS.map((skill): SkillInsight => {
        const matching = asking.get(skill) ?? [];
        const used = projects.filter((p) => p.skills.includes(skill)).map((p) => p.name);
        const hitos = milestonesDone(skill, state);
        const where = whereToLearn(skill, state, activeIds);
        return {
            key: skill,
            label: skillLabel(skill),
            level: evidenceLevel(used.length, hitos),
            projects: used,
            milestonesDone: hitos,
            demand: matching.length,
            prizeUsd: matching.reduce(
                (sum, h) => (isUsdPrize(h.prize_pool, h.prize_currency, h.prize_unverified) ? sum + h.prize_pool : sum),
                0,
            ),
            highDemand: matching.length >= high,
            keywords: buildTagOptions(matching).slice(0, MAX_KEYWORDS).map((tag) => tag.label),
            track: where ? { id: where.track.id, title: where.track.title } : null,
            milestone: where?.milestone
                ? { text: where.milestone.text, href: `/roadmap/${where.track.id}#${where.milestone.id}` }
                : null,
        };
    })
        .filter((s) => s.demand > 0 || s.level !== "none")
        .sort((a, b) => b.demand - a.demand || b.projects.length - a.projects.length);

    return {
        skills,
        rising: skills.filter((s) => s.demand > 0).slice(0, RISING_SKILLS),
        recommendation: recommend(skills),
    };
}

export async function getSkillInsights(state: LearningState): Promise<SkillInsights> {
    const [live, projects] = await Promise.all([loadHackathons(), loadProjects()]);
    const hackathons = live?.hackathons ?? [];
    return {
        ...computeSkillInsights(state, projects, hackathons),
        total: hackathons.length,
        sources: live ? liveSourceNames(live) : [],
        fetchedAt: live?.fetched_at ?? null,
        hackathonsAvailable: live !== null,
    };
}

/**
 * Para cada conjunto de skills (etiquetas de match.ts), cuántas hackatones
 * abiertas piden al menos una. Devuelve null si el agregador no respondió.
 */
export async function countOpenHackathonsFor(skillSets: Record<string, string[]>): Promise<Record<string, number> | null> {
    const live = await loadHackathons();
    if (!live) return null;
    return Object.fromEntries(
        Object.entries(skillSets).map(([id, skills]) => [
            id,
            live.hackathons.filter((h) => findSkills(skills, h.tags ?? []).length > 0).length,
        ]),
    );
}
