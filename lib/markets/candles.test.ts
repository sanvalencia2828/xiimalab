import { describe, expect, it } from "vitest";
import { SCANNER_COLUMNS, buildHoursPlan, decide, parseScanner } from "./candles";

// Respuesta real del escáner de TradingView para CRYPTOCAP:TOTAL (2026-10-13 ~21:30 BRT)
// en el orden de SCANNER_COLUMNS
const REAL = {
    totalCount: 1,
    data: [{
        s: "CRYPTOCAP:TOTAL",
        d: [
            2777906715574,                 // close (vela en curso)
            2766243838577, 2726823146675, 2766281293229, // open | open[1] | close[1]        (D)
            2803049942562, 2913192776752, 2804666490857, // open|1W | open[1]|1W | close[1]|1W (W)
            2839125824392, 2622194906430, 2838647918726, // open|1M | open[1]|1M | close[1]|1M (M)
        ],
    }],
};

describe("parseScanner", () => {
    it("pide 10 columnas en el orden que espera el parser", () => {
        expect(SCANNER_COLUMNS.length).toBe(10);
    });

    it("arma las velas D/W/M cerradas y en curso", () => {
        const p = parseScanner(REAL)!;
        expect(p.marketCap).toBe(2777906715574);
        const [d, w, m] = p.frames;
        expect(d.closed!.changePct).toBeCloseTo(1.4470, 3);   // ayer cerró en verde
        expect(w.closed!.changePct).toBeCloseTo(-3.7253, 3);  // semana pasada en rojo
        expect(m.closed!.changePct).toBeCloseTo(8.2547, 3);   // mes pasado en verde
        expect(d.current!.changePct).toBeCloseTo(0.4216, 3);
        expect(w.current!.changePct).toBeCloseTo(-0.8970, 3);
        expect(m.current!.changePct).toBeCloseTo(-2.1563, 3);
    });

    it("respuesta vacía o incompleta → null", () => {
        expect(parseScanner({ totalCount: 0, data: [] })).toBe(null);
        expect(parseScanner({ data: [{ d: [1, 2] }] })).toBe(null);
        expect(parseScanner(null)).toBe(null);
    });

    it("valores nulos dejan esa vela sin datos", () => {
        const raw = { data: [{ d: [100, 90, null, null, 95, 80, 85, 70, 60, 75] }] };
        const p = parseScanner(raw)!;
        expect(p.frames[0].closed).toBe(null);
        expect(p.frames[1].closed!.close).toBe(85);
    });
});

describe("decide y buildHoursPlan", () => {
    it("positiva → estudiar, negativa → proyecto, igual o sin datos → neutral", () => {
        expect(decide({ open: 1, close: 2, changePct: 100 })).toBe("estudiar");
        expect(decide({ open: 2, close: 1, changePct: -50 })).toBe("proyecto");
        expect(decide({ open: 2, close: 2, changePct: 0 })).toBe("neutral");
        expect(decide(null)).toBe("neutral");
    });

    it("cada vela vale 3 h: con D verde, W roja y M verde → 6 h estudio y 3 h proyecto", () => {
        const plan = buildHoursPlan(parseScanner(REAL)!.frames);
        expect(plan.items.map((i) => i.decision)).toEqual(["estudiar", "proyecto", "estudiar"]);
        expect(plan.items.map((i) => i.preview)).toEqual(["estudiar", "proyecto", "proyecto"]);
        expect(plan.study).toBe(6);
        expect(plan.project).toBe(3);
    });
});
