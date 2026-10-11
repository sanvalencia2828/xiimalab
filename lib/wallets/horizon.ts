/**
 * lib/wallets/horizon.ts — SERVER ONLY
 * Lectura de una cuenta en Horizon testnet: saldo XLM y saldos reclamables
 * (claimable balances), que es donde el escrow educativo deja los fondos
 * (engine/staking_manager.py). Solo lectura, con la clave pública.
 */
import { isStellarPublicKey } from "./stellar";

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
const TIMEOUT_MS = 8000;
const MAX_CLAIMABLE = 20;

export interface ClaimableBalance {
    id: string;
    amount: string;
    /** "XLM" o el código del activo */
    asset: string;
}

export type StellarAccount =
    | { status: "ok"; xlm: string; claimable: ClaimableBalance[] }
    /** La cuenta no existe en testnet: nunca recibió fondos */
    | { status: "unfunded"; claimable: ClaimableBalance[] }
    | { status: "invalid" }
    | { status: "error" };

type Json = Record<string, unknown>;

async function horizon(path: string): Promise<Response> {
    return fetch(`${HORIZON_TESTNET}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
}

async function claimableBalances(publicKey: string): Promise<ClaimableBalance[]> {
    const res = await horizon(`/claimable_balances?claimant=${publicKey}&limit=${MAX_CLAIMABLE}`);
    if (!res.ok) throw new Error(`Horizon HTTP ${res.status}`);
    const data = (await res.json()) as { _embedded?: { records?: Json[] } };
    return (data._embedded?.records ?? []).map((record) => {
        const asset = String(record.asset ?? "");
        return {
            id: String(record.id ?? ""),
            amount: String(record.amount ?? "0"),
            asset: asset === "native" ? "XLM" : asset.split(":")[0],
        };
    });
}

export async function getStellarAccount(publicKey: string): Promise<StellarAccount> {
    if (!isStellarPublicKey(publicKey)) return { status: "invalid" };
    try {
        const [accountRes, claimable] = await Promise.all([horizon(`/accounts/${publicKey}`), claimableBalances(publicKey)]);
        if (accountRes.status === 404) return { status: "unfunded", claimable };
        if (!accountRes.ok) return { status: "error" };
        const account = (await accountRes.json()) as { balances?: Json[] };
        const native = account.balances?.find((b) => b.asset_type === "native");
        return { status: "ok", xlm: String(native?.balance ?? "0"), claimable };
    } catch (err) {
        console.warn("[horizon] testnet no disponible:", err instanceof Error ? err.message : err);
        return { status: "error" };
    }
}
