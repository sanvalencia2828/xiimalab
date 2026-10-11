"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_PROFILE, parseProfile, type Profile } from "@/lib/profile/data";

const STORAGE_KEY = "xiimalab_profile";
// Clave del perfil anterior: traía un nombre y una bio de ejemplo que no se migran
const LEGACY_KEY = "user_profile";
const LEGACY_PLACEHOLDERS = new Set(["Desarrollador Xiimalab", "Construyendo el futuro con IA y Blockchain"]);

function read(): Profile {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return parseProfile(JSON.parse(saved));

        const legacy: unknown = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null");
        if (legacy && typeof legacy === "object") {
            const { displayName, bio } = legacy as Record<string, unknown>;
            const own = (value: unknown) => (typeof value === "string" && !LEGACY_PLACEHOLDERS.has(value) ? value : "");
            return parseProfile({ name: own(displayName), bio: own(bio) });
        }
    } catch { /* perfil ilegible → vacío */ }
    return EMPTY_PROFILE;
}

/**
 * Datos personales de Mi Perfil, guardados en el navegador.
 * `loaded` es false hasta leer localStorage, para no pintar el perfil vacío durante la hidratación.
 */
export function useProfile() {
    const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setProfile(read());
        setLoaded(true);
    }, []);

    const save = useCallback((next: Profile) => {
        const clean = parseProfile(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        } catch { /* almacenamiento lleno o bloqueado: el cambio vive solo en esta sesión */ }
        setProfile(clean);
    }, []);

    return { profile, loaded, save };
}
