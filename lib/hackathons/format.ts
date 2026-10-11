/**
 * lib/hackathons/format.ts
 * Formato de premios compartido por las tarjetas y el modal de detalle.
 */

/** true si el importe se puede comparar como dólares (moneda informada y en USD). */
export function isUsdPrize(amount: number | null | undefined, currency?: string | null): boolean {
    return Boolean(amount && amount > 0 && currency?.trim().toUpperCase() === "USD");
}

/** "$5.000" · "5.000 EUR" · "No especificado" */
export function formatPrize(amount: number | null | undefined, currency?: string | null): string {
    if (!amount || amount <= 0) return "No especificado";
    const grouped = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const code = currency?.trim().toUpperCase();
    return !code || code === "USD" || code === "$" ? `$${grouped}` : `${grouped} ${code}`;
}
