import { describe, expect, it } from "vitest";
import { PROJECTS } from "@/lib/projects/data";
import {
    applicationsForProject, asRoadmapTask, MAX_PHASES, phaseApplication, type ProjectLike, projectKinds,
} from "./applications";
import { TRACKS, getTrack, type Phase, type Track } from "./tracks";

function project(title: string): ProjectLike {
    const found = PROJECTS.find((p) => p.title.startsWith(title));
    if (!found) throw new Error(`proyecto desconocido: ${title}`);
    return found;
}

function phase(trackId: string, phaseId: string): { track: Track; phase: Phase } {
    const track = getTrack(trackId);
    const found = track?.phases.find((p) => p.id === phaseId);
    if (!track || !found) throw new Error(`fase desconocida: ${trackId}/${phaseId}`);
    return { track, phase: found };
}

function picked(title: string): string[] {
    return applicationsForProject(project(title), TRACKS).map((a) => `${a.trackId}/${a.phaseId}`);
}

describe("projectKinds", () => {
    it("deduce el tipo del stack y la descripción", () => {
        expect(projectKinds(project("Rastreador"))).toEqual(expect.arrayContaining(["api", "etl", "datos"]));
        expect(projectKinds(project("Regen-Buddy"))).toEqual(expect.arrayContaining(["llm"]));
        expect(projectKinds(project("Pulsar Radar"))).toEqual(expect.arrayContaining(["api", "cadena"]));
        expect(projectKinds(project("AURA"))).not.toContain("cadena");
    });
});

describe("phaseApplication", () => {
    it("separa afinidad (ya en el stack) de mejora (encaja con el tipo)", () => {
        const { track, phase: tools } = phase("ai-agents", "herramientas");
        const application = phaseApplication(project("Rastreador"), track, tools);
        expect(application?.affinity).toEqual(expect.arrayContaining(["python", "fastapi"]));
        expect(application?.improvement).toEqual(expect.arrayContaining(["tool use", "agent"]));
        expect(application?.reason).toContain("expone una API");
    });

    it("un proyecto con ETL gana el pipeline de datos de MLOps", () => {
        const { track, phase: pipeline } = phase("mlops", "pipeline");
        const application = phaseApplication(project("Rastreador"), track, pipeline);
        expect(application?.improvement).toContain("devops");
        expect(application?.reason).toContain("ETL");
        expect(application?.needs).toEqual(["Pipeline de datos programado"]);
    });

    it("una necesidad real basta para que la fase aplique, aunque el stack no coincida", () => {
        // Regen-Buddy (HTML, JavaScript, OpenAI) no comparte stack con Full Stack, pero no tiene tests, CI ni licencia
        const { track, phase: calidad } = phase("full-stack", "calidad");
        const application = phaseApplication(project("Regen-Buddy"), track, calidad);
        expect(application?.affinity).toEqual([]);
        expect(application?.needs).toEqual(["Tests y CI", "Repo presentable (README, LICENSE, ROADMAP)"]);
        expect(application?.reason).toContain("Lo tiene pendiente");
    });

    it("no aplica sin punto de partida, aunque la mejora encaje con el tipo", () => {
        const custom: ProjectLike = { title: "CLI", description: "Herramienta con una API interna", stack: ["Rust"] };
        const { track, phase: tools } = phase("ai-agents", "herramientas");
        expect(phaseApplication(custom, track, tools)).toBeNull();
    });

    it("no fuerza una fase por compartir solo lenguaje y framework", () => {
        // La dApp pide web3 y blockchain; AURA solo comparte Next.js y TypeScript
        const { track, phase: dapp } = phase("blockchain", "dapp");
        expect(phaseApplication(project("AURA"), track, dapp)).toBeNull();
        expect(phaseApplication(project("Pulsar Radar"), track, dapp)).not.toBeNull();
        // RedimensionAI ya conecta una wallet: ahí sí aplica
        expect(phaseApplication(project("RedimensionAI"), track, dapp)?.needs).toEqual(["Autenticación y wallet"]);
    });
});

describe("applicationsForProject", () => {
    it("devuelve como mucho 5 fases y 2 por track, de más a menos relevantes", () => {
        for (const p of PROJECTS) {
            const applications = applicationsForProject(p, TRACKS);
            expect(applications.length).toBeGreaterThan(0);
            expect(applications.length).toBeLessThanOrEqual(MAX_PHASES);
            const perTrack = new Map<string, number>();
            for (const a of applications) perTrack.set(a.trackId, (perTrack.get(a.trackId) ?? 0) + 1);
            expect(Math.max(...Array.from(perTrack.values()))).toBeLessThanOrEqual(2);
            const scores = applications.map((a) => a.score);
            expect(scores).toEqual([...scores].sort((a, b) => b - a));
        }
    });

    it("elige las fases esperadas para Rastreador", () => {
        expect(picked("Rastreador")).toEqual(expect.arrayContaining(["ai-agents/herramientas", "mlops/pipeline"]));
    });

    it("no propone Blockchain a proyectos sin relación con una cadena", () => {
        for (const title of ["AURA", "Regen-Buddy", "Rastreador"]) {
            expect(picked(title).some((key) => key.startsWith("blockchain/"))).toBe(false);
        }
        expect(picked("Pulsar Radar")).toContain("blockchain/tokens-defi");
        expect(picked("RedimensionAI")).toContain("blockchain/dapp");
    });

    it("no propone nada a un proyecto que no encaja con ningún track", () => {
        const custom: ProjectLike = { title: "Recetario", description: "Recetas de cocina en papel", stack: ["LaTeX"] };
        expect(applicationsForProject(custom, TRACKS)).toEqual([]);
    });
});

describe("asRoadmapTask", () => {
    it("genera una tarea Markdown sin marcar", () => {
        expect(asRoadmapTask(" Añadir un agente ", { trackTitle: "AI Agents", phaseTitle: "Herramientas (tool use)" })).toBe(
            "- [ ] Añadir un agente (AI Agents · Herramientas (tool use))",
        );
    });
});
