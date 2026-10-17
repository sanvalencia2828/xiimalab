import { describe, expect, it } from "vitest";
import { stockRelevance, themeDemand, WATCHLIST } from "./watchlist";
import { parseBackpackMarkets, parseEarnings, parseSnapshots, parseTickers } from "./backpack";

describe("themeDemand", () => {
    it("cuenta coincidencias por tema y normaliza contra el mayor", () => {
        const d = themeDemand([
            { title: "Build AI agents", tags: ["LLM"] },
            { title: "DeFi on Solana", tags: [] },
            { title: "Solana mobile", blockchainNative: true },
            { title: "Maintain the email list" }, // "ai" dentro de una palabra no cuenta
        ]);
        const ia = d.find((x) => x.key === "ia")!;
        const bc = d.find((x) => x.key === "blockchain")!;
        expect(ia.matches).toBe(1);
        expect(bc.matches).toBe(2);
        expect(bc.score).toBe(1);
        expect(ia.score).toBe(0.5);
        expect(ia.total).toBe(4);
    });

    it("la relevancia combina la demanda del tema con la exposición de la acción", () => {
        const demand = themeDemand([{ title: "AI hackathon" }]);
        const nvda = WATCHLIST.find((s) => s.ticker === "NVDA")!;
        const net = WATCHLIST.find((s) => s.ticker === "NET")!;
        expect(stockRelevance(nvda, demand)).toBe(100);
        expect(stockRelevance(net, demand)).toBe(40); // tema sin coincidencias: solo la base
    });
});

// Muestras reales de las APIs de Backpack (2026-10-12), recortadas
const wanted = new Set(["NVDA", "MU"]);

describe("parsers de Backpack", () => {
    it("tickers", () => {
        const m = parseTickers(
            [
                { ticker: "NVDA", name: "Nvidia Corp", price: 226.15, marketCap: 5.461e12, type: "CS" },
                { ticker: "PTL", name: "Inspire 500 ETF", price: 276.48, type: "ETF" },
            ],
            wanted,
        );
        expect(m.size).toBe(1);
        expect(m.get("NVDA")).toEqual({ ticker: "NVDA", name: "Nvidia Corp", price: 226.15, marketCap: 5.461e12 });
    });

    it("snapshots", () => {
        const m = parseSnapshots(
            [{
                ticker: "MU",
                day: { close: 980 },
                lastTrade: { price: 986.68, timestamp: 1 },
                intervalChanges: { "1d": -0.72, "1m": -0.44, "1w": -0.26, "1y": 13.67, "6m": 3.03, YTD: 10.78 },
            }],
            wanted,
        );
        expect(m.get("MU")).toEqual({
            ticker: "MU",
            price: 986.68,
            changes: { d1: -0.72, w1: -0.26, m1: -0.44, m6: 3.03, y1: 13.67, ytd: 10.78 },
        });
    });

    it("earnings: elige la próxima fecha desde hoy", () => {
        const m = parseEarnings(
            [
                { symbol: "NVDA", date: "2026-08-20", epsEstimated: 1 },
                { symbol: "NVDA", date: "2027-02-25", epsEstimated: 2 },
                { symbol: "NVDA", date: "2026-11-18", epsEstimated: 1.5, revenueEstimated: 6e10 },
                { symbol: "GENC", date: "2026-12-11" },
            ],
            wanted,
            "2026-10-12",
        );
        expect(m.get("NVDA")).toEqual({ date: "2026-11-18", epsEstimated: 1.5, revenueEstimated: 6e10 });
        expect(m.has("GENC")).toBe(false);
    });

    it("markets: detecta spot y perp por baseSymbol .US", () => {
        const m = parseBackpackMarkets([
            { baseSymbol: "MU.US", marketType: "SPOT" },
            { baseSymbol: "MU.US", marketType: "PERP" },
            { baseSymbol: "NVDA.US", marketType: "PERP" },
            { baseSymbol: "SOL", marketType: "SPOT" },
        ]);
        expect(m.get("MU")).toEqual({ spot: true, perp: true });
        expect(m.get("NVDA")).toEqual({ spot: false, perp: true });
        expect(m.has("SOL")).toBe(false);
    });
});
