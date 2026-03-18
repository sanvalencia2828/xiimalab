"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface WalletContextType {
    studentAddress: string | null;
    setStudentAddress: (address: string) => void;
    isLoaded: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [studentAddress, setStudentAddressState] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Read from localStorage to hydrate context safely on the client
        try {
            const stored = localStorage.getItem("xiimalab_stellar_address");
            if (stored) {
                setStudentAddressState(stored);
            }
        } catch (error) {
            console.error("Error reading from localStorage:", error);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    const setStudentAddress = (address: string) => {
        setStudentAddressState(address);
        try {
            if (address) {
                localStorage.setItem("xiimalab_stellar_address", address);
                // Escibir cookie para que los Server Components puedan leer la identidad
                document.cookie = `xiimalab_stellar_address=${address}; path=/; max-age=31536000; SameSite=Lax`;
            } else {
                localStorage.removeItem("xiimalab_stellar_address");
                document.cookie = `xiimalab_stellar_address=; path=/; max-age=0; SameSite=Lax`;
            }
        } catch (error) {
            console.error("Error setting storage/cookie:", error);
        }
    };

    return (
        <WalletContext.Provider value={{ studentAddress, setStudentAddress, isLoaded }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}
