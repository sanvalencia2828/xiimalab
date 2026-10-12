import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { MatchAnalysisError, parseMatchOutput } from "./ai";
import { parsePartialJson } from "./partialJson";
import { createSseReader, encodeSseEvent, type MatchStreamEvent, toMatchPartial } from "./sse";

const FULL = '{"match_score":85,"matching_skills":["Python","React"],"missing_skills":["Solidity"],"recommendation":"Destaca tu API en \\"FastAPI\\"."}';

describe("parsePartialJson", () => {
    it("devuelve undefined mientras no hay nada legible", () => {
        expect(parsePartialJson("")).toBeUndefined();
        expect(parsePartialJson("  ")).toBeUndefined();
        expect(parsePartialJson("{")).toEqual({});
    });

    it("no entrega un número hasta que termina", () => {
        expect(parsePartialJson('{"match_score":8')).toEqual({});
        expect(parsePartialJson('{"match_score":85')).toEqual({});
        expect(parsePartialJson('{"match_score":85,')).toEqual({ match_score: 85 });
        expect(parsePartialJson('{"match_score": 85 }')).toEqual({ match_score: 85 });
    });

    it("no muestra una clave sin valor ni una skill a medias", () => {
        expect(parsePartialJson('{"match_score":85,"matching_sk')).toEqual({ match_score: 85 });
        expect(parsePartialJson('{"match_score":85,"matching_skills":')).toEqual({ match_score: 85 });
        expect(parsePartialJson('{"match_score":85,"matching_skills":["Python","Rea')).toEqual({ match_score: 85, matching_skills: ["Python"] });
        expect(parsePartialJson('{"match_score":85,"matching_skills":["Python","React"')).toEqual({
            match_score: 85,
            matching_skills: ["Python", "React"],
        });
    });

    it("el texto de una propiedad crece a medida que llega, con sus escapes", () => {
        expect(parsePartialJson('{"recommendation":"Destaca tu API en \\"Fast')).toEqual({ recommendation: 'Destaca tu API en "Fast' });
        expect(parsePartialJson('{"recommendation":"línea\\')).toEqual({ recommendation: "línea" });
        expect(parsePartialJson('{"recommendation":"a\\u00f1o \\u00')).toEqual({ recommendation: "año " });
    });

    it("cualquier prefijo del JSON completo se lee sin lanzar y el final coincide con JSON.parse", () => {
        let fields = 0;
        for (let i = 0; i <= FULL.length; i++) {
            const partial = parsePartialJson(FULL.slice(0, i)) as Record<string, unknown> | undefined;
            const count = Object.keys(partial ?? {}).length;
            expect(count).toBeGreaterThanOrEqual(fields); // los campos solo se añaden
            fields = count;
        }
        expect(parsePartialJson(FULL)).toEqual(JSON.parse(FULL));
    });
});

describe("toMatchPartial", () => {
    it("conserva solo los campos del análisis con su tipo y acota el porcentaje", () => {
        expect(toMatchPartial({ match_score: 140.4, matching_skills: ["a", 3, ""], extra: true, recommendation: 5 })).toEqual({
            match_score: 100,
            matching_skills: ["a"],
        });
        expect(toMatchPartial(undefined)).toEqual({});
    });
});

describe("eventos SSE", () => {
    const events: MatchStreamEvent[] = [
        { event: "meta", data: { cached: false, model: "claude-haiku-5-5" } },
        { event: "partial", data: { match_score: 85 } },
        { event: "partial", data: { match_score: 85, matching_skills: ["Python"] } },
        { event: "done", data: { match_score: 85, matching_skills: ["Python"], missing_skills: [], recommendation: "Hazlo.\nYa.", model_used: "claude-haiku-5-5" } },
    ];

    it("se leen igual aunque el body llegue cortado por cualquier sitio", () => {
        const wire = events.map(encodeSseEvent).join("");
        for (const size of [1, 7, 64, wire.length]) {
            const received: MatchStreamEvent[] = [];
            const read = createSseReader((event) => received.push(event));
            for (let i = 0; i < wire.length; i += size) read(wire.slice(i, i + size));
            expect(received).toEqual(events);
        }
    });

    it("ignora eventos desconocidos, comentarios y datos ilegibles", () => {
        const received: MatchStreamEvent[] = [];
        const read = createSseReader((event) => received.push(event));
        read(': keep-alive\n\nevent: otro\ndata: {}\n\nevent: partial\ndata: {roto\n\nevent: error\r\ndata: {"message":"Sin crédito"}\r\n\r\n');
        expect(received).toEqual([{ event: "error", data: { message: "Sin crédito" } }]);
    });
});

describe("parseMatchOutput", () => {
    it("valida el resultado completo", () => {
        expect(parseMatchOutput(FULL).match_score).toBe(85);
    });

    it("rechaza un JSON inválido o fuera del esquema con un mensaje legible", () => {
        for (const bad of ['{"match_score":85', "no es json", '{"match_score":140,"matching_skills":[],"missing_skills":[],"recommendation":"x"}', '{"match_score":50}']) {
            expect(() => parseMatchOutput(bad)).toThrow(MatchAnalysisError);
        }
    });
});
