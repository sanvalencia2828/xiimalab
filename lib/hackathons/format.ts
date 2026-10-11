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

/** "Cierra hoy" · "Cierra mañana" · "Cierra en 5 días", a partir de "YYYY-MM-DD"; urgente si faltan menos de 3 días. */
export function describeClosing(deadline: string | null | undefined, now: Date = new Date()): { label: string; urgent: boolean; closed: boolean } {
    const m = deadline?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return { label: "Sin fecha de cierre", urgent: false, closed: false };
    const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const days = Math.round((end - today) / 86_400_000);
    if (days < 0) return { label: "Cerrada", urgent: false, closed: true };
    const label = days === 0 ? "Cierra hoy" : days === 1 ? "Cierra mañana" : `Cierra en ${days} días`;
    return { label, urgent: days < 3, closed: false };
}
