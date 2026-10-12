import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, daysUntil, evaluateAcquisition, parseRules, type AcquisitionInput } from "./acquisition";

const NOW = new Date("2026-10-12T18:00:00Z");
const asset = (over: Partial<AcquisitionInput> = {}): AcquisitionInput => ({
    ticker: "NVDA",
    price: 200,
    earnings: { date: "2026-11-18" },
    backpack: { spot: false, perp: true },
    ...over,
});
const rules = (targets: Record<string, number>, over = {}) => ({ ...DEFAULT_RULES, targets, ...over });

describe("evaluateAcquisition", () => {
    it("sin precio → sin-datos", () => {
        expect(evaluateAcquisition(asset({ price: null }), rules({ NVDA: 180 }), NOW).status).toBe("sin-datos");
    });

    it("sin objetivo → sin-objetivo", () => {
        expect(evaluateAcquisition(asset(), rules({}), NOW).status).toBe("sin-objetivo");
    });

    it("precio ≤ objetivo y sin resultados cerca → en-zona", () => {
        const r = evaluateAcquisition(asset({ price: 175 }), rules({ NVDA: 180 }), NOW);
        expect(r.status).toBe("en-zona");
        expect(r.distancePct).toBeCloseTo(-2.78, 1);
    });

    it("precio por encima → fuera-de-zona con la distancia", () => {
        const r = evaluateAcquisition(asset({ price: 200 }), rules({ NVDA: 160 }), NOW);
        expect(r.status).toBe("fuera-de-zona");
        expect(r.distancePct).toBeCloseTo(25, 5);
        expect(r.detail).toContain("25.0%");
    });

    it("resultados dentro de la ventana → esperar-resultados aunque esté en zona", () => {
        const r = evaluateAcquisition(asset({ price: 150, earnings: { date: "2026-10-15" } }), rules({ NVDA: 180 }), NOW);
        expect(r.status).toBe("esperar-resultados");
        expect(r.daysToEarnings).toBe(3);
        expect(r.detail).toBe("Publica resultados en 3 días");
    });

    it("ventana 0 desactiva la espera por resultados", () => {
        const r = evaluateAcquisition(
            asset({ price: 150, earnings: { date: "2026-10-13" } }),
            rules({ NVDA: 180 }, { earningsWindowDays: 0 }),
            NOW,
        );
        expect(r.status).toBe("en-zona");
    });

    it("exigir Backpack sin mercado → no-operable", () => {
        const r = evaluateAcquisition(
            asset({ backpack: { spot: false, perp: false } }),
            rules({ NVDA: 300 }, { requireBackpack: true }),
            NOW,
        );
        expect(r.status).toBe("no-operable");
    });
});

describe("daysUntil", () => {
    it("cuenta días de calendario en UTC", () => {
        expect(daysUntil("2026-10-12", NOW)).toBe(0);
        expect(daysUntil("2026-10-19", NOW)).toBe(7);
    });
});

describe("parseRules", () => {
    it("tolera JSON corrupto o vacío", () => {
        expect(parseRules(null)).toEqual(DEFAULT_RULES);
        expect(parseRules("{no json")).toEqual(DEFAULT_RULES);
    });

    it("descarta objetivos inválidos y acota la ventana", () => {
        const r = parseRules(JSON.stringify({ targets: { NVDA: 180, AMD: -1, MU: "x" }, earningsWindowDays: 500, requireBackpack: true }));
        expect(r).toEqual({ targets: { NVDA: 180 }, earningsWindowDays: 60, requireBackpack: true });
    });
});
