import { describe, expect, it } from "vitest";
import { PROJECTS } from "@/lib/projects/data";
import { projectName } from "./applications";
import { phaseImpact } from "./impact";
import {
    currentPhase, MILESTONE_MIGRATIONS, migrateMilestoneKeys, parseLearningState, sanitizeLearningState, trackProgress,
} from "./progress";
import { TRACKS, getTrack } from "./tracks";

const IDS = TRACKS.flatMap((t) => t.phases.flatMap((p) => p.milestones.map((m) => m.id)));
const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}T10:00:00.000Z`;

function track(id: string) {
    const found = getTrack(id);
    if (!found) throw new Error(`falta el track ${id}`);
    return found;
}

describe("tracks.ts", () => {
    it("no repite ids de hito", () => {
        expect(new Set(IDS).size).toBe(IDS.length);
    });

    it("conserva los ids de los hitos que no cambiaron", () => {
        // Fases reordenadas o con un hito quitado en medio: sus ids siguen siendo los de antes
        for (const id of [
            "ai-engineer:produccion:1", "ai-engineer:embeddings-rag:5", "mlops:pipeline:4", "mlops:experimentos:1",
            "full-stack:docker-despliegue:1", "full-stack:docker-despliegue:2", "full-stack:docker-despliegue:4",
            "full-stack:calidad:4", "full-stack:api:2", "blockchain:dapp:1", "blockchain:tokens-defi:4",
        ]) {
            expect(IDS).toContain(id);
        }
        expect(IDS).not.toContain("full-stack:docker-despliegue:3");
    });

    it("solo nombra proyectos del portafolio en `resuelve` y `appliesTo`", () => {
        const names = new Set(PROJECTS.map((p) => projectName(p.title)));
        for (const phase of TRACKS.flatMap((t) => t.phases)) {
            const named = [...(phase.resuelve ?? []).flatMap((n) => n.projects), ...phase.milestones.flatMap((m) => m.appliesTo ?? [])];
            for (const name of named) expect(names, `${phase.id}: ${name}`).toContain(name);
        }
    });

    it("pone al final las fases opcionales y no deja una fase sin impacto delante de la primera con impacto salvo por dependencia", () => {
        for (const t of TRACKS) {
            const optional = t.phases.map((p) => Boolean(p.optional));
            expect(optional).toEqual([...optional].sort((a, b) => Number(a) - Number(b)));
        }
        // Full Stack: la interfaz va primero por dependencia; el resto, de más a menos impacto hasta el despliegue
        expect(track("full-stack").phases.map((p) => [p.id, phaseImpact(p)])).toEqual([
            ["interfaz", 0], ["api", 4], ["integracion", 5], ["calidad", 5], ["docker-despliegue", 3],
        ]);
    });
});

describe("migración del avance", () => {
    it("las reglas apuntan a hitos que existen desde ids que ya no existen", () => {
        for (const { to, from } of MILESTONE_MIGRATIONS) {
            expect(IDS).toContain(to);
            for (const id of from) expect(IDS).not.toContain(id);
        }
    });

    it("mueve el hito del workflow de CI a Calidad con su fecha", () => {
        const state = parseLearningState(JSON.stringify({ done: { "full-stack:docker-despliegue:3": day(3) }, started: {} }));
        expect(state.done).toEqual({ "full-stack:calidad:5": day(3) });
    });

    it("un hito fusionado queda hecho solo si lo estaban todos sus orígenes, con la fecha del último", () => {
        const state = parseLearningState(
            JSON.stringify({
                done: {
                    "blockchain:primer-contrato:1": day(1),
                    "blockchain:primer-contrato:3": day(9),
                    "blockchain:primer-contrato:2": day(4),
                    "blockchain:primer-contrato:4": day(5), // falta primer-contrato:5 → el hito 3 no se da por hecho
                    "blockchain:seguridad-mainnet:3": day(7),
                    "blockchain:fundamentos:1": day(2),
                },
                started: { blockchain: day(1) },
            }),
        );
        expect(state.done).toEqual({
            "blockchain:fundamentos:1": day(2),
            "blockchain:contratos-seguridad:1": day(9),
            "blockchain:contratos-seguridad:2": day(4),
            "blockchain:contratos-seguridad:5": day(7),
        });
        expect(state.started).toEqual({ blockchain: day(1) });
    });

    it("es idempotente y no pisa un hito nuevo ya marcado", () => {
        const once = parseLearningState(JSON.stringify({ done: { "full-stack:docker-despliegue:3": day(3) }, started: {} }));
        expect(parseLearningState(JSON.stringify(once))).toEqual(once);
        const kept = migrateMilestoneKeys(
            { "full-stack:calidad:5": day(20), "full-stack:docker-despliegue:3": day(3) },
            (dates) => dates[0],
        );
        expect(kept).toEqual({ "full-stack:calidad:5": day(20) });
    });

    it("el estado migrado pasa la validación del servidor", () => {
        const raw = { done: { "full-stack:docker-despliegue:3": day(3), "blockchain:seguridad-mainnet:3": day(7) }, started: {} };
        expect(Object.keys(sanitizeLearningState(raw).done).sort()).toEqual(["blockchain:contratos-seguridad:5", "full-stack:calidad:5"]);
    });
});

describe("fases opcionales", () => {
    it("no cuentan para el avance ni para la fase actual del track", () => {
        const blockchain = track("blockchain");
        const required = blockchain.phases.filter((p) => !p.optional).flatMap((p) => p.milestones);
        const done = Object.fromEntries(required.map((m) => [m.id, day(1)]));
        expect(trackProgress(blockchain, done)).toEqual({ done: required.length, total: required.length, percent: 100 });
        expect(currentPhase(blockchain, done)).toBeNull();
    });
});
