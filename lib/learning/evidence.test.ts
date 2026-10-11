import { describe, expect, it } from "vitest";
import { evidenceSkills, parseMilestoneEvidence, withEvidence } from "./evidence";
import type { LearningState } from "./progress";

const MILESTONE = "ai-agents:herramientas:1"; // fase con agent, tool use, mcp, python, fastapi
const TITLES = ["Rastreador · Londrina Radar Comercial", "AURA"];
const done: LearningState = { done: { [MILESTONE]: "2026-10-11T10:00:00.000Z" }, started: {} };

describe("parseMilestoneEvidence", () => {
    it("conserva solo hitos que existen y proyectos del portafolio", () => {
        expect(
            parseMilestoneEvidence(
                { [MILESTONE]: "Rastreador", "no:existe:1": "Rastreador", "ai-agents:herramientas:2": "Otro", "ai-agents:memoria:1": 3 },
                TITLES,
            ),
        ).toEqual({ [MILESTONE]: "Rastreador" });
        expect(parseMilestoneEvidence(null, TITLES)).toEqual({});
    });
});

describe("evidenceSkills", () => {
    it("atribuye al proyecto las skills de la fase del hito", () => {
        const skills = evidenceSkills({ [MILESTONE]: "Rastreador" }, done).get("Rastreador");
        expect(skills).toEqual(expect.arrayContaining(["agent", "tool use", "mcp"]));
    });

    it("no cuenta si el hito ya no está marcado", () => {
        expect(evidenceSkills({ [MILESTONE]: "Rastreador" }, { done: {}, started: {} }).size).toBe(0);
    });
});

describe("withEvidence", () => {
    it("añade las skills demostradas sin duplicar las del stack", () => {
        const projects = [
            { name: "Rastreador", skills: ["python", "fastapi"] },
            { name: "AURA", skills: ["ai"] },
        ];
        const [rastreador, aura] = withEvidence(projects, { [MILESTONE]: "Rastreador" }, done);
        expect(rastreador.skills).toEqual(["python", "fastapi", "agent", "tool use", "mcp"]);
        expect(aura).toBe(projects[1]);
    });
});
