import { describe, expect, it } from "vitest";
import type { AggregatedHackathon } from "@/lib/types";
import {
    buildChecks, currentStep, EMPTY_FIRST_HACKATHON, type FirstHackathonState, parseFirstHackathonState,
    pickCandidates, planDate, PRESENT_CHECKS, REINFORCE_CHECK, STEPS, stepStatus, submission,
} from "./plan";

const NOW = new Date(2026, 9, 11, 10, 0, 0); // 11 oct 2026

function hackathon(over: Partial<AggregatedHackathon>): AggregatedHackathon {
    return {
        id: "h1",
        title: "Hack",
        prize_pool: 0,
        tags: ["Beginner Friendly"],
        deadline: "2026-10-21",
        match_score: 50,
        source_url: "https://example.com/h1",
        source: "devpost",
        event_type: "virtual",
        ...over,
    } as AggregatedHackathon;
}

const chosen = { id: "h1", title: "Hack", url: null, deadline: "2026-10-21", tags: [], matchScore: 50, source: "devpost" };

describe("pickCandidates", () => {
    it("acepta Beginner Friendly o tema abierto, virtuales y con cierre en 7–14 días", () => {
        const picked = pickCandidates(
            [
                hackathon({ id: "ok" }),
                hackathon({ id: "abierta", tags: ["Open Ended"] }),
                hackathon({ id: "sin-etiqueta", tags: ["Fintech"] }),
                hackathon({ id: "presencial", event_type: "in-person" }),
                hackathon({ id: "pronto", deadline: "2026-10-17" }),
                hackathon({ id: "lejos", deadline: "2026-10-26" }),
                hackathon({ id: "limite-7", deadline: "2026-10-18" }),
                hackathon({ id: "limite-14", deadline: "2026-10-25" }),
            ],
            NOW,
        );
        expect(picked.map((c) => c.id).sort()).toEqual(["abierta", "limite-14", "limite-7", "ok"]);
        expect(picked.find((c) => c.id === "abierta")?.reason).toBe("Tema abierto");
    });

    it("ordena por match", () => {
        const picked = pickCandidates([hackathon({ id: "a", match_score: 20 }), hackathon({ id: "b", match_score: 80 })], NOW);
        expect(picked.map((c) => c.id)).toEqual(["b", "a"]);
    });
});

describe("fechas del plan", () => {
    it("cuenta los 7 días hacia atrás desde el cierre", () => {
        expect(planDate("2026-10-21", 7)).toEqual(new Date(2026, 9, 21));
        expect(planDate("2026-10-21", 1)).toEqual(new Date(2026, 9, 15));
        expect(planDate("2026-11-02", 1)).toEqual(new Date(2026, 9, 27));
    });

    it("marca cada paso como pendiente, de hoy o atrasado", () => {
        const state: FirstHackathonState = { ...EMPTY_FIRST_HACKATHON, hackathon: chosen };
        const [, idea, , construir, , enviar] = STEPS;
        const day5 = new Date(2026, 9, 19, 9, 0, 0);
        expect(stepStatus(STEPS[0], state, day5)).toBe("hecho");
        expect(stepStatus(idea, state, day5)).toBe("atrasado");
        expect(stepStatus(construir, state, day5)).toBe("hoy");
        expect(stepStatus(enviar, state, day5)).toBe("pendiente");
    });
});

describe("avance", () => {
    it("avanza de paso al completar cada uno y desbloquea el envío", () => {
        let state: FirstHackathonState = EMPTY_FIRST_HACKATHON;
        expect(currentStep(state)?.id).toBe("elegir");
        state = { ...state, hackathon: chosen };
        expect(currentStep(state)?.id).toBe("idea");
        state = { ...state, idea: "Una idea", features: ["a", "b", "c"] };
        expect(currentStep(state)?.id).toBe("reforzar");
        const at = NOW.toISOString();
        const ids = [REINFORCE_CHECK, ...buildChecks(state.features).map((c) => c.id), ...PRESENT_CHECKS.map((c) => c.id)];
        state = { ...state, checks: Object.fromEntries(ids.map((id) => [id, at])) };
        expect(currentStep(state)?.id).toBe("enviar");
        expect(submission(state)).toBeNull();
        state = { ...state, submittedAt: at };
        expect(currentStep(state)).toBeNull();
        expect(submission(state)).toEqual({ title: "Hack", at });
    });
});

describe("parseFirstHackathonState", () => {
    it("descarta lo que no tiene la forma esperada", () => {
        expect(parseFirstHackathonState("x")).toEqual(EMPTY_FIRST_HACKATHON);
        const parsed = parseFirstHackathonState({
            hackathon: { ...chosen, deadline: "mañana" },
            idea: 3,
            features: ["a"],
            checks: { repo: "2026-10-11T10:00:00.000Z", deploy: "nunca" },
            submittedAt: "ayer",
        });
        expect(parsed).toEqual({
            hackathon: null,
            idea: "",
            features: ["a", "", ""],
            checks: { repo: "2026-10-11T10:00:00.000Z" },
            submittedAt: null,
        });
    });
});
