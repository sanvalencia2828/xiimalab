/**
 * lib/wallets/address.ts
 * Utilidades de direcciones públicas compartidas por Mi Perfil, Configuración
 * y el menú lateral.
 */

/** "GABC…XYZ1": los cuatro primeros y los cuatro últimos caracteres. */
export function abbreviateAddress(address: string): string {
    return address.length <= 9 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Clave pública de Solana: base58, 32–44 caracteres. */
export function isSolanaAddress(value: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

export function stellarExpertUrl(publicKey: string): string {
    return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}
