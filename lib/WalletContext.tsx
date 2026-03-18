"use client";

/**
 * lib/WalletContext.tsx
 * Contexto global de wallet Stellar — persiste en localStorage.
 * Sincronizado en tiempo real via storage event (multi-tab).
 */
import {
    createContext, useCallback, useContext,
    useEffect, useState, type ReactNode,
} from "react";

const STORAGE_KEY = "xiimalab_stellar_wallet";

export interface WalletState {
    publicKey:   string | null;
    displayName: string | null;
    connectedAt: string | null;
}

interface WalletContextValue extends WalletState {
    connect:    (publicKey: string, displayName?: string) => void;
    disconnect: () => void;
    isConnected: boolean;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function loadFromStorage(): WalletState {
    if (typeof window === "undefined")
        return { publicKey: null, displayName: null, connectedAt: null };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { publicKey: null, displayName: null, connectedAt: null };
}

export function WalletProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<WalletState>({
        publicKey: null, displayName: null, connectedAt: null,
    });

    // Hidratación desde localStorage (solo en client)
    useEffect(() => {
        setState(loadFromStorage());

        // Escuchar cambios de otras pestañas o de /settings
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setState(loadFromStorage());
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const connect = useCallback((publicKey: string, displayName?: string) => {
        const next: WalletState = {
            publicKey,
            displayName: displayName ?? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`,
            connectedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setState(next);
        // Disparar evento para otras pestañas
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    }, []);

    const disconnect = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setState({ publicKey: null, displayName: null, connectedAt: null });
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    }, []);

    return (
        <WalletContext.Provider value={{
            ...state,
            isConnected: !!state.publicKey,
            connect,
            disconnect,
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error("useWallet debe usarse dentro de <WalletProvider>");
    return ctx;
}
