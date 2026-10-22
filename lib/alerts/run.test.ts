import { describe, expect, it, vi } from "vitest";
import { parseQuotes, type Quote } from "./cmc";
import { WATCHED_ASSETS } from "./config";
import { runAlerts, type StateRow, type StateStore, type StoredState } from "./run";

function memoryStore(initial: StoredState[] = []): StateStore & { rows: Map<number, StateRow> } {
    const rows = new Map<number, StateRow>();
    return {
        rows,
        load: async () => new Map(initial.map((s) => [s.assetId, s])),
        save: async (list) => {
            for (const r of list) rows.set(r.asset.id, r);
        },
    };
}

const allAt = (price: number): Quote[] => WATCHED_ASSETS.map((a) => ({ id: a.id, symbol: a.symbol, price }));
const sol = WATCHED_ASSETS.find((a) => a.symbol === "SOL")!;

describe("runAlerts", () => {
    it("primera pasada: guarda un rango automático por moneda y no avisa", async () => {
        const store = memoryStore();
        const send = vi.fn();
        const s = await runAlerts({ quotes: allAt(100), store, send, dryRun: false });
        expect(s.checked).toBe(23);
        expect(s.alerts).toHaveLength(0);
        expect(send).not.toHaveBeenCalled();
        expect(store.rows.size).toBe(23);
        expect(store.rows.get(sol.id)?.rangeSource).toBe("auto");
    });

    it("avisa al salir del rango guardado y guarda el nuevo estado", async () => {
        const store = memoryStore([
            { assetId: sol.id, state: "dentro", range: { min: 90, max: 110 }, rangeSource: "auto", lastAlertedAt: null },
        ]);
        const send = vi.fn().mockResolvedValue("consola");
        const quotes = allAt(100).map((q) => (q.id === sol.id ? { ...q, price: 130 } : q));
        const s = await runAlerts({ quotes, store, send, dryRun: false, now: () => new Date("2026-10-22T12:00:00Z") });
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toContain("SOL");
        expect(s.alerts[0]).toMatchObject({ symbol: "SOL", state: "sobre_maximo", sent: true });
        expect(store.rows.get(sol.id)?.state).toBe("sobre_maximo");
        expect(store.rows.get(sol.id)?.alertedAt).toBe("2026-10-22T12:00:00.000Z");
        // el rango automático no se recalcula con el precio nuevo
        expect(store.rows.get(sol.id)?.range).toEqual({ min: 90, max: 110 });
    });

    it("si el aviso falla no guarda esa moneda, para reintentarla", async () => {
        const store = memoryStore([
            { assetId: sol.id, state: "dentro", range: { min: 90, max: 110 }, rangeSource: "auto", lastAlertedAt: null },
        ]);
        const send = vi.fn().mockRejectedValue(new Error("Telegram respondió 500"));
        const quotes = allAt(100).map((q) => (q.id === sol.id ? { ...q, price: 130 } : q));
        const s = await runAlerts({ quotes, store, send, dryRun: false });
        expect(s.errors).toHaveLength(1);
        expect(store.rows.has(sol.id)).toBe(false);
    });

    it("dry-run no envía ni guarda, pero informa de las alertas", async () => {
        const store = memoryStore([
            { assetId: sol.id, state: "dentro", range: { min: 90, max: 110 }, rangeSource: "auto", lastAlertedAt: null },
        ]);
        const send = vi.fn();
        const quotes = allAt(100).map((q) => (q.id === sol.id ? { ...q, price: 130 } : q));
        const s = await runAlerts({ quotes, store, send, dryRun: true });
        expect(s.alerts).toHaveLength(1);
        expect(s.alerts[0].sent).toBe(false);
        expect(send).not.toHaveBeenCalled();
        expect(store.rows.size).toBe(0);
    });

    it("ignora monedas ausentes o con otro símbolo", async () => {
        const quotes = allAt(100)
            .filter((q) => q.id !== 1027)
            .map((q) => (q.id === sol.id ? { ...q, symbol: "XYZ" } : q));
        const s = await runAlerts({ quotes, store: memoryStore(), send: vi.fn(), dryRun: false });
        expect(s.missing).toEqual(["ETH"]);
        expect(s.mismatched).toEqual(["SOL≠XYZ"]);
        expect(s.checked).toBe(21);
    });
});

describe("parseQuotes", () => {
    const coin = (id: number, symbol: string) => ({ id, symbol, quote: { USD: { price: 2 } } });

    it("lee objeto por ID, objeto por símbolo con listas y array", () => {
        expect(parseQuotes({ data: { "1": coin(1, "BTC") } })).toEqual([{ id: 1, symbol: "BTC", price: 2 }]);
        expect(parseQuotes({ data: { ETH: [coin(1027, "ETH")] } })).toHaveLength(1);
        expect(parseQuotes({ data: [coin(5426, "SOL")] })).toHaveLength(1);
    });

    it("descarta monedas sin precio y respuestas vacías", () => {
        expect(parseQuotes({ data: { "1": { id: 1, symbol: "BTC", quote: { USD: { price: null } } } } })).toEqual([]);
        expect(parseQuotes(null)).toEqual([]);
    });
});
