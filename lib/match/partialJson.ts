/**
 * lib/match/partialJson.ts
 * Lee un JSON que todavía se está escribiendo (la respuesta del modelo en
 * streaming) y devuelve lo que ya se puede mostrar.
 *
 * Solo entra lo que no va a cambiar al llegar más texto, salvo los textos que
 * son valor directo de una propiedad, que crecen a medida que se escriben:
 *   • un número, true, false o null solo cuentan cuando ya terminaron
 *     ("match_score": 8 puede ser el principio de 85);
 *   • un texto dentro de una lista solo cuenta cuando se cerró (una skill a
 *     medias no se muestra);
 *   • una clave sin valor todavía no aparece.
 */

interface Cursor {
    text: string;
    i: number;
}

/** Valor leído; `complete` es false si el texto se acabó antes de cerrarlo. */
interface Read {
    value: unknown;
    complete: boolean;
}

function skipSpace(c: Cursor): void {
    while (c.i < c.text.length && /\s/.test(c.text[c.i])) c.i++;
}

function readString(c: Cursor): Read {
    c.i++; // comilla de apertura
    let out = "";
    while (c.i < c.text.length) {
        const ch = c.text[c.i];
        if (ch === '"') {
            c.i++;
            return { value: out, complete: true };
        }
        if (ch !== "\\") {
            out += ch;
            c.i++;
            continue;
        }
        const next = c.text[c.i + 1];
        if (next === undefined) break; // escape a medias
        if (next === "u") {
            const hex = c.text.slice(c.i + 2, c.i + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
            out += String.fromCharCode(parseInt(hex, 16));
            c.i += 6;
            continue;
        }
        const escapes: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };
        out += escapes[next] ?? next;
        c.i += 2;
    }
    c.i = c.text.length;
    return { value: out, complete: false };
}

/** Número o literal: solo vale si después viene algo que lo cierra. */
function readScalar(c: Cursor): Read | null {
    const match = c.text.slice(c.i).match(/^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)(?=[\s,}\]])/);
    if (!match) {
        c.i = c.text.length;
        return null;
    }
    c.i += match[0].length;
    return { value: JSON.parse(match[0]) as unknown, complete: true };
}

function readArray(c: Cursor): Read {
    c.i++;
    const out: unknown[] = [];
    for (;;) {
        skipSpace(c);
        if (c.i >= c.text.length) return { value: out, complete: false };
        if (c.text[c.i] === "]") {
            c.i++;
            return { value: out, complete: true };
        }
        if (c.text[c.i] === ",") {
            c.i++;
            continue;
        }
        const item = readValue(c);
        if (!item) return { value: out, complete: false };
        // Un texto a medias dentro de una lista no se muestra; un objeto o una lista a medias, sí
        if (item.complete || typeof item.value !== "string") out.push(item.value);
        if (!item.complete) return { value: out, complete: false };
    }
}

function readObject(c: Cursor): Read {
    c.i++;
    const out: Record<string, unknown> = {};
    for (;;) {
        skipSpace(c);
        if (c.i >= c.text.length) return { value: out, complete: false };
        if (c.text[c.i] === "}") {
            c.i++;
            return { value: out, complete: true };
        }
        if (c.text[c.i] === ",") {
            c.i++;
            continue;
        }
        if (c.text[c.i] !== '"') return { value: out, complete: false };
        const key = readString(c);
        if (!key.complete) return { value: out, complete: false };
        skipSpace(c);
        if (c.text[c.i] !== ":") return { value: out, complete: false };
        c.i++;
        const item = readValue(c);
        if (!item) return { value: out, complete: false };
        out[key.value as string] = item.value;
        if (!item.complete) return { value: out, complete: false };
    }
}

function readValue(c: Cursor): Read | null {
    skipSpace(c);
    const ch = c.text[c.i];
    if (ch === undefined) return null;
    if (ch === "{") return readObject(c);
    if (ch === "[") return readArray(c);
    if (ch === '"') return readString(c);
    return readScalar(c);
}

/** Lo que ya se puede leer de un JSON incompleto; undefined si todavía no hay nada. */
export function parsePartialJson(text: string): unknown {
    return readValue({ text, i: 0 })?.value;
}
