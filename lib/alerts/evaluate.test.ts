import { describe, expect, it } from "vitest";
import { WATCHED_ASSETS } from "./config";
import { autoRange, evaluate, stateFor, type PreviousState } from "./evaluate";

const range = { min: 90, max: 110 };
const prev = (state: PreviousState["state"], source: PreviousState["rangeSource"] = "auto"): PreviousState => ({
    state,
    range,
    rangeSource: source,
});

describe("stateFor", () => {
    it("clasifica el precio según el rango, con los extremos dentro", () => {
        expect(stateFor(89.99, range)).toBe("bajo_minimo");
        expect(stateFor(90, range)).toBe("dentro");
        expect(stateFor(110, range)).toBe("dentro");
        expect(stateFor(110.01, range)).toBe("sobre_maximo");
    });
});

describe("evaluate", () => {
    it("primera lectura sin rango propio: crea el rango ±10 % y no avisa", () => {
        const r = evaluate(100, null, undefined);
        expect(r.state).toBe("dentro");
        expect(r.rangeSource).toBe("auto");
        expect(r.range.min).toBeCloseTo(90);
        expect(r.range.max).toBeCloseTo(110);
        expect(r.notify).toBe(false);
    });

    it("no recalcula el rango automático guardado", () => {
        const r = evaluate(150, prev("dentro"), undefined);
        expect(r.range).toEqual(range);
        expect(r.state).toBe("sobre_maximo");
        expect(r.notify).toBe(true);
    });

    it("avisa una sola vez mientras el estado no cambia", () => {
        expect(evaluate(150, prev("sobre_maximo"), undefined).notify).toBe(false);
    });

    it("se rearma al volver al rango y avisa de nuevo si vuelve a salir", () => {
        const back = evaluate(100, prev("sobre_maximo"), undefined);
        expect(back.state).toBe("dentro");
        expect(back.notify).toBe(false);
        expect(evaluate(80, { ...prev("dentro") }, undefined).notify).toBe(true);
    });

    it("avisa al pasar de un extremo al otro", () => {
        expect(evaluate(150, prev("bajo_minimo"), undefined).notify).toBe(true);
    });

    it("un rango propio manda sobre el guardado y avisa si la moneda nace fuera", () => {
        const r = evaluate(100, null, { min: 120, max: 200 });
        expect(r.rangeSource).toBe("custom");
        expect(r.state).toBe("bajo_minimo");
        expect(r.notify).toBe(true);
        expect(evaluate(100, prev("dentro"), { min: 120, max: 200 }).range).toEqual({ min: 120, max: 200 });
    });
});

describe("autoRange", () => {
    it("aplica el porcentaje indicado", () => {
        expect(autoRange(200, 0.05)).toEqual({ min: 190, max: 210 });
    });
});

describe("WATCHED_ASSETS", () => {
    it("tiene 23 monedas sin IDs ni símbolos repetidos", () => {
        expect(WATCHED_ASSETS).toHaveLength(23);
        expect(new Set(WATCHED_ASSETS.map((a) => a.id)).size).toBe(23);
        expect(new Set(WATCHED_ASSETS.map((a) => a.symbol)).size).toBe(23);
    });
});
