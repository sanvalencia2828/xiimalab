/**
 * lib/markets/lendFormat.ts
 * Formato de /lend, compartido por la página y los tests. Puro.
 */

/** Fracción anual → "0,24 %" (dos decimales; tres si es menor que 0,01 % y no es cero). */
export function formatRate(fraction: number, digits = 2): string {
    const pct = fraction * 100;
    const d = pct !== 0 && Math.abs(pct) < 0.01 ? 3 : digits;
    return `${pct.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
}

/** Uso 0–1 → "22,2 %" */
export function formatUtilization(fraction: number): string {
    return formatRate(fraction, 1);
}

/** USD compacto: "$53,5 M" · "$812 K" · "$950" */
export function formatUsdCompact(n: number): string {
    const fmt = (v: number, d: number) => v.toLocaleString("es-ES", { maximumFractionDigits: d });
    if (n >= 1e9) return `$${fmt(n / 1e9, 2)} B`;
    if (n >= 1e6) return `$${fmt(n / 1e6, 1)} M`;
    if (n >= 1e3) return `$${fmt(n / 1e3, 0)} K`;
    return `$${fmt(n, 0)}`;
}
