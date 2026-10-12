import { describe, expect, it } from "vitest";
import {
    DEFAULT_RANGES,
    DEFAULT_RULES,
    daysUntil,
    evaluateAcquisition,
    parseAmount,
    parseRules,
    serializeRules,
    type AcquisitionInput,
    type PriceRange,
} from "./acquisition";

const NOW = new Date("2026-10-12T18:00:00Z");
const asset = (over: Partial<AcquisitionInput> = {}): AcquisitionInput => ({
    ticker: "NVDA",
    price: 226,
    earnings: { date: "2026-11-18" },
    backpack: { spot: false, perp: true },
    ...over,
});
const rules = (ranges: Record<string, PriceRange>, over = {}) => ({ ...DEFAULT_RULES, ranges, ...over });
const NVDA = { NVDA: { min: 211, max: 244 } };

describe("evaluateAcquisition con rango", () => {
    it("sin precio → sin-datos", () => {
        expect(evaluateAcquisition(asset({ price: null }), rules(NVDA), NOW).status).toBe("sin-datos");
    });

    it("sin rango → sin-rango", () => {
        expect(evaluateAcquisition(asset(), rules({}), NOW).status).toBe("sin-rango");
    });

    it("dentro del rango → en-zona con la posición", () => {
        const r = evaluateAcquisition(asset({ price: 226 }), rules(NVDA), NOW);
        expect(r.status).toBe("en-zona");
        expect(r.positionPct).toBeCloseTo(45.45, 1);
        expect(r.detail).toBe("Al 45% de tu rango $211–$244");
    });

    it("los extremos del rango cuentan como dentro", () => {
        expect(evaluateAcquisition(asset({ price: 211 }), rules(NVDA), NOW).status).toBe("en-zona");
        expect(evaluateAcquisition(asset({ price: 244 }), rules(NVDA), NOW).status).toBe("en-zona");
    });

    it("bajo el mínimo → bajo-rango", () => {
        const r = evaluateAcquisition(asset({ price: 200 }), rules(NVDA), NOW);
        expect(r.status).toBe("bajo-rango");
        expect(r.detail).toContain("5.2% por debajo");
    });

    it("sobre el máximo → sobre-rango", () => {
        const r = evaluateAcquisition(asset({ price: 268.4 }), rules(NVDA), NOW);
        expect(r.status).toBe("sobre-rango");
        expect(r.detail).toContain("10.0% por encima");
    });

    it("resultados dentro de la ventana → esperar-resultados aunque esté en zona", () => {
        const r = evaluateAcquisition(asset({ earnings: { date: "2026-10-15" } }), rules(NVDA), NOW);
        expect(r.status).toBe("esperar-resultados");
        expect(r.daysToEarnings).toBe(3);
        expect(r.detail).toBe("Publica resultados en 3 días");
    });

    it("ventana 0 desactiva la espera por resultados", () => {
        const r = evaluateAcquisition(
            asset({ earnings: { date: "2026-10-13" } }),
            rules(NVDA, { earningsWindowDays: 0 }),
            NOW,
        );
        expect(r.status).toBe("en-zona");
    });

    it("exigir Backpack sin mercado → no-operable", () => {
        const r = evaluateAcquisition(
            asset({ backpack: { spot: false, perp: false } }),
            rules(NVDA, { requireBackpack: true }),
            NOW,
        );
        expect(r.status).toBe("no-operable");
    });

    it("un rango inválido (máx < mín) cuenta como sin rango", () => {
        expect(evaluateAcquisition(asset(), rules({ NVDA: { min: 244, max: 211 } }), NOW).status).toBe("sin-rango");
    });
});

describe("daysUntil", () => {
    it("cuenta días de calendario en UTC", () => {
        expect(daysUntil("2026-10-12", NOW)).toBe(0);
        expect(daysUntil("2026-10-19", NOW)).toBe(7);
    });
});

describe("parseRules / serializeRules", () => {
    it("sin datos guardados usa los rangos de fábrica", () => {
        const r = parseRules(null);
        expect(r.ranges).toEqual(DEFAULT_RANGES);
        expect(r.ranges.MU).toEqual({ min: 365, max: 1342 });
        expect(parseRules("{no json").ranges).toEqual(DEFAULT_RANGES);
    });

    it("los rangos guardados reemplazan a los de fábrica y descarta los inválidos", () => {
        const r = parseRules(JSON.stringify({
            ranges: { NVDA: { min: 200, max: 250 }, COIN: { min: 150, max: 220 }, AMD: { min: 10, max: 5 } },
            earningsWindowDays: 500,
            requireBackpack: true,
        }));
        expect(r.ranges.NVDA).toEqual({ min: 200, max: 250 });
        expect(r.ranges.COIN).toEqual({ min: 150, max: 220 });
        expect(r.ranges.AMD).toEqual(DEFAULT_RANGES.AMD);
        expect(r.earningsWindowDays).toBe(60);
        expect(r.requireBackpack).toBe(true);
    });

    it("un rango de fábrica borrado sigue borrado al recargar", () => {
        const { NVDA: _drop, ...rest } = DEFAULT_RANGES;
        const saved = serializeRules({ ...DEFAULT_RULES, ranges: rest });
        expect(parseRules(saved).ranges.NVDA).toBe(undefined);
        expect(parseRules(saved).ranges.AMD).toEqual(DEFAULT_RANGES.AMD);
    });
});

describe("parseAmount", () => {
    it("entiende punto o coma de miles y de decimales", () => {
        expect(parseAmount("1.342")).toBe(1342);
        expect(parseAmount("1,342")).toBe(1342);
        expect(parseAmount("2612")).toBe(2612);
        expect(parseAmount("244,5")).toBe(244.5);
        expect(parseAmount("244.5")).toBe(244.5);
        expect(parseAmount("$ 2.612,50")).toBe(2612.5);
    });
    it("vacío, cero o texto → null", () => {
        expect(parseAmount("")).toBe(null);
        expect(parseAmount("0")).toBe(null);
        expect(parseAmount("abc")).toBe(null);
    });
});
