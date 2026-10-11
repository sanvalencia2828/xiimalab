/**
 * lib/wallets/stellar.ts
 * Validación de claves públicas de Stellar y enlaces al explorador.
 */
import { StrKey } from "@stellar/stellar-sdk";

/** Clave pública ed25519: empieza por G, 56 caracteres y checksum correcto. */
export function isStellarPublicKey(value: string): boolean {
    return StrKey.isValidEd25519PublicKey(value.trim());
}

/** Por qué una clave no es válida, en un mensaje para el usuario; null si lo es o está vacía. */
export function stellarKeyError(value: string): string | null {
    const key = value.trim();
    if (!key || isStellarPublicKey(key)) return null;
    if (key.startsWith("S")) return "Eso parece una clave secreta (empieza por S). Nunca la pegues aquí: usa la clave pública, que empieza por G.";
    if (!key.startsWith("G")) return "Una clave pública de Stellar empieza por G.";
    if (key.length !== 56) return `Una clave pública de Stellar tiene 56 caracteres; esta tiene ${key.length}.`;
    return "La clave no es válida: revisa que esté copiada completa y sin cambios (el checksum no coincide).";
}

export function stellarExpertUrl(publicKey: string): string {
    return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}
