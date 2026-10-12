/**
 * lib/markets/acquisition.ts
 * Estado de adquisición de un activo según las reglas que define el usuario.
 * No recomienda comprar ni vender: solo compara el estado del activo con el
 * precio objetivo y las condiciones que el usuario fijó.
 *
 * Orden de evaluación:
 *   1. sin-datos            — Backpack no devolvió precio
 *   2. sin-objetivo         — el usuario no fijó precio objetivo
 *   3. no-operable          — se exige operar en Backpack y no hay mercado
 *   4. esperar-resultados   — hay resultados trimestrales dentro de la ventana
 *   5. en-zona / fuera-de-zona — precio ≤ objetivo o por encima
 */

export interface AcquisitionRules {
    /** Precio objetivo por ticker (USD). Sin entrada = sin objetivo */
    targets: Record<string, number>;
    /** No adquirir si hay resultados en los próximos N días (0 = desactivado) */
    earningsWindowDays: number;
    /** Solo considerar activos con mercado spot o perp en Backpack */
    requireBackpack: boolean;
}

export const DEFAULT_RULES: AcquisitionRules = {
    targets: {},
    earningsWindowDays: 7,
    requireBackpack: false,
};

export type AcquisitionStatus =
    | "en-zona"
    | "fuera-de-zona"
    | "esperar-resultados"
    | "no-operable"
    | "sin-objetivo"
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
    /** % que falta para llegar al objetivo (positivo = el precio está por encima) */
    distancePct: number | null;
    daysToEarnings: number | null;
}

export const STATUS_ORDER: AcquisitionStatus[] = [
    "en-zona", "esperar-resultados", "fuera-de-zona", "sin-objetivo", "no-operable", "sin-datos",
];

export function daysUntil(date: string, now: Date): number {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const target = Date.parse(`${date}T00:00:00Z`);
    return Math.round((target - today) / 86_400_000);
}

function money(n: number): string {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n >= 100 ? 0 : 2 });
}

export function evaluateAcquisition(
    asset: AcquisitionInput,
    rules: AcquisitionRules,
    now: Date = new Date(),
): AcquisitionResult {
    const daysToEarnings = asset.earnings ? daysUntil(asset.earnings.date, now) : null;
    const target = rules.targets[asset.ticker];
    const hasTarget = typeof target === "number" && Number.isFinite(target) && target > 0;
    const distancePct = hasTarget && asset.price !== null ? ((asset.price - target) / target) * 100 : null;
    const base = { distancePct, daysToEarnings };

    if (asset.price === null) {
        return { ...base, status: "sin-datos", label: "Sin datos", detail: "Backpack no devolvió precio para este activo" };
    }
    if (!hasTarget) {
        return { ...base, status: "sin-objetivo", label: "Sin objetivo", detail: "Define tu precio objetivo para evaluarlo" };
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
    if (asset.price <= target) {
        return {
            ...base,
            status: "en-zona",
            label: "En tu zona",
            detail: `${money(asset.price)} ≤ tu objetivo de ${money(target)}`,
        };
    }
    return {
        ...base,
        status: "fuera-de-zona",
        label: "Fuera de zona",
        detail: `Falta bajar ${distancePct!.toFixed(1)}% para tu objetivo de ${money(target)}`,
    };
}

/** Lee reglas guardadas (JSON) tolerando datos viejos o corruptos. */
export function parseRules(raw: string | null): AcquisitionRules {
    if (!raw) return { ...DEFAULT_RULES, targets: {} };
    try {
        const v = JSON.parse(raw) as Partial<AcquisitionRules>;
        const targets: Record<string, number> = {};
        if (v.targets && typeof v.targets === "object") {
            for (const [k, n] of Object.entries(v.targets)) {
                if (typeof n === "number" && Number.isFinite(n) && n > 0) targets[k] = n;
            }
        }
        const days = typeof v.earningsWindowDays === "number" && v.earningsWindowDays >= 0 ? Math.min(60, Math.round(v.earningsWindowDays)) : DEFAULT_RULES.earningsWindowDays;
        return { targets, earningsWindowDays: days, requireBackpack: v.requireBackpack === true };
    } catch {
        return { ...DEFAULT_RULES, targets: {} };
    }
}
