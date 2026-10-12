/**
 * lib/markets/acquisition.ts
 * Estado de adquisición de un activo según las reglas que define el usuario.
 * No recomienda comprar ni vender: solo compara el estado del activo con el
 * rango de precio (mínimo–máximo) y las condiciones que el usuario fijó.
 *
 * Orden de evaluación:
 *   1. sin-datos            — Backpack no devolvió precio
 *   2. sin-rango            — el usuario no fijó su rango mín–máx
 *   3. no-operable          — se exige operar en Backpack y no hay mercado
 *   4. esperar-resultados   — hay resultados trimestrales dentro de la ventana
 *   5. en-zona              — mín ≤ precio ≤ máx
 *      bajo-rango           — precio < mín
 *      sobre-rango          — precio > máx
 */

export interface PriceRange {
    min: number;
    max: number;
}

export interface AcquisitionRules {
    /** Rango de precio por ticker (USD). Sin entrada = sin rango */
    ranges: Record<string, PriceRange>;
    /** No adquirir si hay resultados en los próximos N días (0 = desactivado) */
    earningsWindowDays: number;
    /** Solo considerar activos con mercado spot o perp en Backpack */
    requireBackpack: boolean;
}

/** Rangos definidos por el usuario (2026-10-12). Se pueden editar desde /activos. */
export const DEFAULT_RANGES: Record<string, PriceRange> = {
    // IA
    NVDA: { min: 211, max: 244 },
    AMD: { min: 421, max: 709 },
    MSFT: { min: 346, max: 581 },
    GOOGL: { min: 261, max: 438 },
    AVGO: { min: 286, max: 489 },
    TSM: { min: 370, max: 500 },
    MU: { min: 365, max: 1342 },
    META: { min: 523, max: 817 },
    AMZN: { min: 195, max: 310 },
    ARM: { min: 198, max: 488 },
    PLTR: { min: 112, max: 215 },
    SNDK: { min: 881, max: 2612 },
    // Blockchain
    COIN: { min: 132, max: 229 },
    CRCL: { min: 43, max: 146 },
    HOOD: { min: 69, max: 134 },
    GLXY: { min: 17, max: 26 },
    MSTR: { min: 88, max: 200 },
    XYZ: { min: 70, max: 85 },
    // Dev y cloud
    NET: { min: 321, max: 384 },
    MDB: { min: 272, max: 528 },
    DDOG: { min: 198, max: 307 },
    GTLB: { min: 44, max: 59 },
    SNOW: { min: 286, max: 373 },
    CRWD: { min: 173, max: 856 },
    ORCL: { min: 112, max: 261 },
};

export const DEFAULT_RULES: AcquisitionRules = {
    ranges: DEFAULT_RANGES,
    earningsWindowDays: 7,
    requireBackpack: false,
};

export type AcquisitionStatus =
    | "en-zona"
    | "bajo-rango"
    | "sobre-rango"
    | "esperar-resultados"
    | "no-operable"
    | "sin-rango"
    | "sin-datos";

export interface AcquisitionInput {
    ticker: string;
    price: number | null;
    earnings: { date: string } | null;
    backpack: { spot: boolean; perp: boolean };
}

export interface AcquisitionResult {
    status: AcquisitionStatus;
    label: string;
    detail: string;
    /** Posición del precio en el rango: 0 = mínimo, 100 = máximo (puede salir de 0–100) */
    positionPct: number | null;
    daysToEarnings: number | null;
}

export const STATUS_ORDER: AcquisitionStatus[] = [
    "en-zona", "bajo-rango", "esperar-resultados", "sobre-rango", "sin-rango", "no-operable", "sin-datos",
];

export function daysUntil(date: string, now: Date): number {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const target = Date.parse(`${date}T00:00:00Z`);
    return Math.round((target - today) / 86_400_000);
}

export function isValidRange(r: unknown): r is PriceRange {
    if (typeof r !== "object" || r === null) return false;
    const { min, max } = r as Record<string, unknown>;
    return (
        typeof min === "number" && typeof max === "number" &&
        Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min
    );
}

/**
 * Lee un importe escrito a mano: "1.342" y "1,342" → 1342 (separador de miles),
 * "244,5" y "244.5" → 244.5, "$ 2.612,50" → 2612.5. Null si no es un número > 0.
 */
export function parseAmount(text: string): number | null {
    const t = text.replace(/[\s$]/g, "");
    if (t === "") return null;
    let norm: string;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) norm = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) norm = t.replace(/,/g, "");
    else norm = t.replace(",", ".");
    const n = Number(norm);
    return Number.isFinite(n) && n > 0 ? n : null;
}

export function money(n: number): string {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n >= 100 ? 0 : 2 });
}

export function evaluateAcquisition(
    asset: AcquisitionInput,
    rules: AcquisitionRules,
    now: Date = new Date(),
): AcquisitionResult {
    const daysToEarnings = asset.earnings ? daysUntil(asset.earnings.date, now) : null;
    const range = rules.ranges[asset.ticker];
    const hasRange = isValidRange(range);
    const positionPct =
        hasRange && asset.price !== null
            ? range.max === range.min
                ? (asset.price >= range.min ? 100 : 0)
                : ((asset.price - range.min) / (range.max - range.min)) * 100
            : null;
    const base = { positionPct, daysToEarnings };

    if (asset.price === null) {
        return { ...base, status: "sin-datos", label: "Sin datos", detail: "Backpack no devolvió precio para este activo" };
    }
    if (!hasRange) {
        return { ...base, status: "sin-rango", label: "Sin rango", detail: "Define tu mínimo y máximo para evaluarlo" };
    }
    if (rules.requireBackpack && !asset.backpack.spot && !asset.backpack.perp) {
        return { ...base, status: "no-operable", label: "No operable", detail: "No tiene mercado en Backpack" };
    }
    if (
        rules.earningsWindowDays > 0 &&
        daysToEarnings !== null &&
        daysToEarnings >= 0 &&
        daysToEarnings <= rules.earningsWindowDays
    ) {
        const when = daysToEarnings === 0 ? "hoy" : daysToEarnings === 1 ? "mañana" : `en ${daysToEarnings} días`;
        return { ...base, status: "esperar-resultados", label: "Esperar resultados", detail: `Publica resultados ${when}` };
    }

    const span = `${money(range.min)}–${money(range.max)}`;
    if (asset.price < range.min) {
        const below = ((range.min - asset.price) / range.min) * 100;
        return { ...base, status: "bajo-rango", label: "Bajo tu mínimo", detail: `${below.toFixed(1)}% por debajo de tu rango ${span}` };
    }
    if (asset.price > range.max) {
        const above = ((asset.price - range.max) / range.max) * 100;
        return { ...base, status: "sobre-rango", label: "Sobre tu máximo", detail: `${above.toFixed(1)}% por encima de tu rango ${span}` };
    }
    return {
        ...base,
        status: "en-zona",
        label: "En tu zona",
        detail: `Al ${Math.round(positionPct!)}% de tu rango ${span}`,
    };
}

/**
 * Lee reglas guardadas (JSON) tolerando datos viejos o corruptos.
 * Si nunca se guardaron rangos, usa DEFAULT_RANGES; los rangos guardados
 * (incluido un rango borrado, guardado como null) mandan sobre los de fábrica.
 */
export function parseRules(raw: string | null): AcquisitionRules {
    const fresh = (): AcquisitionRules => ({ ...DEFAULT_RULES, ranges: { ...DEFAULT_RANGES } });
    if (!raw) return fresh();
    try {
        const v = JSON.parse(raw) as Record<string, unknown>;
        const ranges: Record<string, PriceRange> = { ...DEFAULT_RANGES };
        if (v.ranges && typeof v.ranges === "object") {
            for (const [k, r] of Object.entries(v.ranges as Record<string, unknown>)) {
                if (r === null) delete ranges[k];
                else if (isValidRange(r)) ranges[k] = { min: r.min, max: r.max };
            }
        }
        const d = v.earningsWindowDays;
        const days = typeof d === "number" && d >= 0 ? Math.min(60, Math.round(d)) : DEFAULT_RULES.earningsWindowDays;
        return { ranges, earningsWindowDays: days, requireBackpack: v.requireBackpack === true };
    } catch {
        return fresh();
    }
}

/** Serializa guardando como null los rangos de fábrica que el usuario borró. */
export function serializeRules(rules: AcquisitionRules): string {
    const ranges: Record<string, PriceRange | null> = { ...rules.ranges };
    for (const k of Object.keys(DEFAULT_RANGES)) if (!(k in rules.ranges)) ranges[k] = null;
    return JSON.stringify({ ...rules, ranges });
}
