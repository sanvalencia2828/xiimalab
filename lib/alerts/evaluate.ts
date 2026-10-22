/**
 * lib/alerts/evaluate.ts
 * Lógica pura de las alertas: en qué estado está un precio y si hay que avisar.
 * Solo se avisa al cambiar de estado; cuando el precio vuelve al rango la
 * alerta se rearma sin aviso.
 */
import { AUTO_RANGE_PCT, type PriceRange } from "./config";

export type AlertState = "dentro" | "bajo_minimo" | "sobre_maximo";
export type RangeSource = "auto" | "custom";

export interface PreviousState {
    state: AlertState;
    range: PriceRange;
    rangeSource: RangeSource;
}

export interface Evaluation {
    state: AlertState;
    range: PriceRange;
    rangeSource: RangeSource;
    /** true si el estado cambió a uno fuera del rango */
    notify: boolean;
}

export function stateFor(price: number, range: PriceRange): AlertState {
    if (price < range.min) return "bajo_minimo";
    if (price > range.max) return "sobre_maximo";
    return "dentro";
}

export function autoRange(price: number, pct: number = AUTO_RANGE_PCT): PriceRange {
    return { min: price * (1 - pct), max: price * (1 + pct) };
}

/**
 * Rango y estado para un precio recién leído.
 *  - Un rango propio (RANGOS) manda siempre.
 *  - Sin rango propio, el automático se calcula con el primer precio y después
 *    se reutiliza el guardado: no se recalcula en cada ejecución.
 * Una moneda sin estado previo avisa solo si ya nace fuera de un rango propio.
 */
export function evaluate(price: number, previous: PreviousState | null, custom: PriceRange | undefined): Evaluation {
    let range: PriceRange;
    let rangeSource: RangeSource;
    if (custom) {
        range = custom;
        rangeSource = "custom";
    } else if (previous && previous.rangeSource === "auto") {
        range = previous.range;
        rangeSource = "auto";
    } else {
        range = autoRange(price);
        rangeSource = "auto";
    }

    const state = stateFor(price, range);
    const notify = state !== "dentro" && state !== (previous?.state ?? "dentro");
    return { state, range, rangeSource, notify };
}
