"use server";

import { getStellarAccount, type StellarAccount } from "@/lib/wallets/horizon";

/**
 * Saldo XLM y saldos reclamables de una cuenta en Horizon testnet.
 * La clave pública se valida en el servidor antes de consultar.
 */
export async function getStellarAccountAction(publicKey: unknown): Promise<StellarAccount> {
    if (typeof publicKey !== "string") return { status: "invalid" };
    return getStellarAccount(publicKey.trim());
}
