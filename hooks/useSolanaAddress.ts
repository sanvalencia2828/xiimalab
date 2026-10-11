"use client";

import { useCallback, useEffect, useState } from "react";
import { isSolanaAddress } from "@/lib/wallets/address";

export const SOLANA_STORAGE_KEY = "xiimalab_solana_address";
const CHANGE_EVENT = "xiimalab:solana-address";

function read(): string | null {
    try {
        const saved = localStorage.getItem(SOLANA_STORAGE_KEY);
        return saved && isSolanaAddress(saved) ? saved : null;
    } catch {
        return null;
    }
}

/**
 * Dirección pública de Solana vinculada en Configuración (opcional, para
 * bounties). Solo lectura: se guarda la clave pública en el navegador.
 */
export function useSolanaAddress() {
    const [address, setAddress] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const sync = () => setAddress(read());
        sync();
        setLoaded(true);
        window.addEventListener("storage", sync);
        window.addEventListener(CHANGE_EVENT, sync);
        return () => {
            window.removeEventListener("storage", sync);
            window.removeEventListener(CHANGE_EVENT, sync);
        };
    }, []);

    const link = useCallback((next: string) => {
        const value = next.trim();
        if (!isSolanaAddress(value)) return false;
        try {
            localStorage.setItem(SOLANA_STORAGE_KEY, value);
        } catch { /* almacenamiento bloqueado: la dirección vive solo en esta sesión */ }
        setAddress(value);
        window.dispatchEvent(new Event(CHANGE_EVENT));
        return true;
    }, []);

    const unlink = useCallback(() => {
        try {
            localStorage.removeItem(SOLANA_STORAGE_KEY);
        } catch { /* nada que borrar */ }
        setAddress(null);
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    return { address, loaded, link, unlink };
}
