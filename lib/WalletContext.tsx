"use client";

/**
 * lib/WalletContext.tsx
 * Contexto global de wallet Stellar — persiste en localStorage y Cookies.
 * Sincronizado en tiempo real via storage event (multi-tab).
 */
import {
    createContext, useCallback, useContext,
    useEffect, useState, type ReactNode,
} from "react";

const STORAGE_KEY = "xiimalab_stellar_wallet";
const COOKIE_KEY = "xiimalab_stellar_address";

export interface WalletState {
    publicKey:   string | null;
    displayName: string | null;
    connectedAt: string | null;
}

interface WalletContextValue extends WalletState {
    studentAddress: string | null; // Alias para compatibilidad
    connect:    (publicKey: string, displayName?: string) => void;
    disconnect: () => void;
    isConnected: boolean;
    isLoaded:    boolean;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function loadFromStorage(): WalletState {
    if (typeof window === "undefined")
        return { publicKey: null, displayName: null, connectedAt: null };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
        
        // Fallback a la cookie antigua si existe
        const match = document.cookie.match(new RegExp('(^| )' + COOKIE_KEY + '=([^;]+)'));
        if (match) {
            return { publicKey: match[2], displayName: null, connectedAt: null };
        }
    } catch { /* ignore */ }
    return { publicKey: null, displayName: null, connectedAt: null };
}

export function WalletProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<WalletState>({
        publicKey: null, displayName: null, connectedAt: null,
    });
    const [isLoaded, setIsLoaded] = useState(false);

    // Hidratación desde localStorage (solo en client)
    useEffect(() => {
        setState(loadFromStorage());
        setIsLoaded(true);

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
        
        // Sincronizar con cookie para Server Components
        document.cookie = `${COOKIE_KEY}=${publicKey}; path=/; max-age=31536000; SameSite=Lax`;
        
        setState(next);
        // Disparar evento para otras pestañas
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    }, []);

    const disconnect = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
        
        setState({ publicKey: null, displayName: null, connectedAt: null });
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    }, []);

    return (
        <WalletContext.Provider value={{
            ...state,
            studentAddress: state.publicKey,
            isConnected: !!state.publicKey,
            isLoaded,
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
