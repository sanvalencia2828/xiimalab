/**
 * lib/wallets/stellar.ts
 * Validación de claves públicas de Stellar con el SDK.
 *
 * El SDK pesa más de 200 kB: en el cliente este módulo se carga con import()
 * dinámico (ver components/settings/SettingsClient.tsx), nunca de forma estática.
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
