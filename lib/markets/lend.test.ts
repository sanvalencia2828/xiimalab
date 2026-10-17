import { describe, expect, it } from "vitest";
import { isTokenizedStock, parseLendMarkets } from "./lend";
import { formatRate, formatUsdCompact, formatUtilization } from "./lendFormat";

// Muestra real de GET https://api.backpack.exchange/api/v1/borrowLend/markets
const SOL = {
    symbol: "SOL",
    state: "Open",
    lendInterestRate: "0.0023956163367403100085915368",
    borrowInterestRate: "0.0126905412715161386988183302",
    utilization: "0.222084472251532427229320779",
    lentQuantity: "512984.4261101095",
    borrowedQuantity: "113925.8755459189",
    assetMarkPrice: "104.32",
};

describe("parseLendMarkets", () => {
    it("convierte los strings decimales y calcula los montos en USD", () => {
        const [sol] = parseLendMarkets([SOL]);
        expect(sol.symbol).toBe("SOL");
        expect(sol.state).toBe("Open");
        expect(sol.lendApr).toBeCloseTo(0.0023956, 6);
        expect(sol.borrowApr).toBeCloseTo(0.0126905, 6);
        expect(sol.utilization).toBeCloseTo(0.2220845, 6);
        expect(sol.lentUsd).toBeCloseTo(512984.4261101095 * 104.32, 2);
        expect(sol.borrowedUsd).toBeCloseTo(113925.8755459189 * 104.32, 2);
    });

    it("se muestra como lend 0,24 %, borrow 1,27 %, uso 22,2 % y ≈ $53,5 M prestados", () => {
        const [sol] = parseLendMarkets([SOL]);
        expect(formatRate(sol.lendApr)).toBe("0,24 %");
        expect(formatRate(sol.borrowApr)).toBe("1,27 %");
        expect(formatUtilization(sol.utilization)).toBe("22,2 %");
        expect(formatUsdCompact(sol.lentUsd)).toBe("$53,5 M");
    });

    it("excluye las acciones tokenizadas (*.US)", () => {
        const stock = { ...SOL, state: "RepayOnly", lendInterestRate: "0", borrowInterestRate: "0", utilization: "0" };
        const markets = parseLendMarkets([SOL, { ...stock, symbol: "SPCX.US" }, { ...stock, symbol: "MU.US" }]);
        expect(markets.map((m) => m.symbol)).toEqual(["SOL"]);
        expect(isTokenizedStock("SPCX.US")).toBe(true);
        expect(isTokenizedStock("USDC")).toBe(false);
    });

    it("descarta filas sin tasas y respuestas que no son un array", () => {
        expect(parseLendMarkets([{ symbol: "BAD", lendInterestRate: "x" }, null, "SOL"])).toEqual([]);
        expect(parseLendMarkets({ data: [SOL] })).toEqual([]);
    });

    it("conserva el estado RepayOnly", () => {
        expect(parseLendMarkets([{ ...SOL, state: "RepayOnly" }])[0].state).toBe("RepayOnly");
    });
});

describe("formato", () => {
    it("tasas muy bajas con tres decimales, cero con dos", () => {
        expect(formatRate(0.00004)).toBe("0,004 %");
        expect(formatRate(0)).toBe("0,00 %");
    });

    it("USD compacto", () => {
        expect(formatUsdCompact(136_560_000)).toBe("$136,6 M");
        expect(formatUsdCompact(1_250_000_000)).toBe("$1,25 B");
        expect(formatUsdCompact(812_400)).toBe("$812 K");
        expect(formatUsdCompact(950)).toBe("$950");
    });
});
