import { describe, expect, it } from "vitest";
import { PROJECTS } from "@/lib/projects/data";
import { projectName, type ProjectLike } from "./applications";
import { resolvedProjects } from "./impact";
import { demonstratedIn, phasePractices, practiceFor, sortPractices } from "./practices";
import { MANUAL_PRACTICES } from "./practices-data";
import { TRACKS, getTrack, type Practice } from "./tracks";

function find(trackId: string, phaseId: string) {
    const track = getTrack(trackId);
    const phase = track?.phases.find((p) => p.id === phaseId);
    if (!track || !phase) throw new Error(`fase desconocida: ${trackId}/${phaseId}`);
    return { track, phase };
}

function project(name: string): ProjectLike {
    const found = PROJECTS.find((p) => projectName(p.title) === name);
    if (!found) throw new Error(`proyecto desconocido: ${name}`);
    return found;
}

describe("prácticas manuales", () => {
    it("cada entrada apunta a una fase, un proyecto y unos hitos que existen", () => {
        const names = new Set(PROJECTS.map((p) => projectName(p.title)));
        for (const [key, practices] of Object.entries(MANUAL_PRACTICES)) {
            const [trackId, phaseId] = key.split(":");
            const { phase } = find(trackId, phaseId);
            const numbers = phase.milestones.map((m) => Number(m.id.split(":")[2]));
            expect(new Set(practices.map((p) => p.proyecto)).size, `${key}: proyecto repetido`).toBe(practices.length);
            for (const practice of practices) {
                expect(names, `${key}: ${practice.proyecto}`).toContain(practice.proyecto);
                expect(practice.hitos.length, `${key}: ${practice.proyecto} sin hitos`).toBeGreaterThan(0);
                for (const n of practice.hitos) expect(numbers, `${key}: hito ${n}`).toContain(n);
                expect(practice.titulo).not.toContain("\n");
            }
        }
    });

    it("cubren todos los proyectos que cada una de esas fases resuelve", () => {
        for (const key of Object.keys(MANUAL_PRACTICES)) {
            const [trackId, phaseId] = key.split(":");
            const { phase } = find(trackId, phaseId);
            const written = phase.practicas.map((p) => p.project);
            for (const name of resolvedProjects(phase)) expect(written, `${key}: falta ${name}`).toContain(name);
        }
    });

    it("llegan a la fase con origen Manual y los hitos resueltos", () => {
        const { phase } = find("ai-engineer", "modelos-por-api");
        const regen = phase.practicas.find((p) => p.project === "Regen-Buddy");
        expect(regen?.origin).toBe("Manual");
        expect(regen?.type).toBe("Mejora");
        expect(regen?.milestones.map((m) => m.id)).toEqual(["ai-engineer:modelos-por-api:1", "ai-engineer:modelos-por-api:4"]);
        expect(phase.practicas.find((p) => p.project === "Rastreador")?.type).toBe("Nueva función");
    });
});

describe("phasePractices", () => {
    it("da una práctica por cada proyecto que toca la fase, sin repetir proyecto", () => {
        for (const track of TRACKS) {
            for (const phase of track.phases) {
                const practices = phasePractices(track, phase, PROJECTS);
                expect(new Set(practices.map((p) => p.project)).size).toBe(practices.length);
                for (const manual of phase.practicas) expect(practices).toContainEqual(manual);
            }
        }
    });

    it("usa la práctica general, adaptada al proyecto, donde no hay una manual", () => {
        const { track, phase } = find("mlops", "pipeline");
        const rastreador = practiceFor(project("Rastreador"), track, phase);
        expect(rastreador?.origin).toBe("General");
        expect(rastreador?.title).toBe(phase.practicaGeneral.idea); // el texto de la fase ya habla de Rastreador
        const xiimalab = practiceFor(project("Xiimalab"), track, phase);
        expect(xiimalab?.title).toBe("Aplicar «Pipeline de datos programado» en Xiimalab");
        expect(xiimalab?.effort).toBeNull();
        expect(xiimalab?.steps).toHaveLength(3);
    });

    it("no inventa una práctica para un proyecto que la fase no toca", () => {
        const { track, phase } = find("blockchain", "tokens-defi");
        expect(practiceFor(project("AURA"), track, phase)).toBeNull();
    });
});

describe("sortPractices", () => {
    it("pone primero las mejoras y, dentro de cada tipo, de menos a más esfuerzo", () => {
        const base: Practice = { project: "", title: "", type: "Mejora", what: "", steps: [], milestones: [], effort: "M", origin: "Manual" };
        const sorted = sortPractices([
            { ...base, project: "a", type: "Nueva función", effort: "S" },
            { ...base, project: "b", effort: null },
            { ...base, project: "c", effort: "L" },
            { ...base, project: "d", effort: "S" },
            { ...base, project: "e", type: "Nueva función", effort: "M" },
        ]);
        expect(sorted.map((p) => p.project)).toEqual(["d", "c", "b", "a", "e"]);
    });
});

describe("demonstratedIn", () => {
    it("cuenta los hitos de la fase registrados en el proyecto que siguen marcados", () => {
        const { phase } = find("full-stack", "calidad");
        const [m1, m2, m3] = phase.milestones.map((m) => m.id);
        const evidence = { [m1]: "AURA", [m2]: "AURA", [m3]: "Xiimalab" };
        const done = { [m1]: "2026-10-01T10:00:00.000Z", [m3]: "2026-10-02T10:00:00.000Z" };
        expect(demonstratedIn(phase, "AURA", evidence, done)).toBe(1);
        expect(demonstratedIn(phase, "Xiimalab", evidence, done)).toBe(1);
        expect(demonstratedIn(phase, "Rastreador", evidence, done)).toBe(0);
    });
});
