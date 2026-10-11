"use client";

import { useCallback, useEffect, useState } from "react";
import {
    type ChosenHackathon, EMPTY_FIRST_HACKATHON, type FirstHackathonState, parseFirstHackathonState,
} from "@/lib/first-hackathon/plan";

export const FIRST_HACKATHON_STORAGE_KEY = "xiimalab_first_hackathon";
const CHANGE_EVENT = "xiimalab:first-hackathon";

function read(): FirstHackathonState {
    try {
        const raw = localStorage.getItem(FIRST_HACKATHON_STORAGE_KEY);
        return raw ? parseFirstHackathonState(JSON.parse(raw)) : EMPTY_FIRST_HACKATHON;
    } catch {
        return EMPTY_FIRST_HACKATHON;
    }
}

/**
 * Plan de la primera hackatón guardado en el navegador, igual que el avance de los tracks.
 * `loaded` es false hasta leer localStorage, para no pintar un plan vacío durante la hidratación.
 */
export function useFirstHackathon() {
    const [state, setState] = useState<FirstHackathonState>(EMPTY_FIRST_HACKATHON);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const sync = () => setState(read());
        sync();
        setLoaded(true);
        window.addEventListener("storage", sync);
        window.addEventListener(CHANGE_EVENT, sync);
        return () => {
            window.removeEventListener("storage", sync);
            window.removeEventListener(CHANGE_EVENT, sync);
        };
    }, []);

    const update = useCallback((change: (prev: FirstHackathonState) => FirstHackathonState) => {
        const next = change(read());
        try {
            localStorage.setItem(FIRST_HACKATHON_STORAGE_KEY, JSON.stringify(next));
        } catch { /* almacenamiento lleno o bloqueado: el cambio vive solo en esta sesión */ }
        setState(next);
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    /** Elige la hackatón; la idea y los checklists ya rellenados se conservan. */
    const choose = useCallback(
        (hackathon: ChosenHackathon) => update((prev) => ({ ...prev, hackathon, submittedAt: null })),
        [update],
    );

    const setIdea = useCallback((idea: string) => update((prev) => ({ ...prev, idea })), [update]);

    const setFeature = useCallback(
        (index: number, value: string) =>
            update((prev) => ({ ...prev, features: prev.features.map((f, i) => (i === index ? value : f)) })),
        [update],
    );

    const toggleCheck = useCallback(
        (id: string) =>
            update((prev) => {
                const checks = { ...prev.checks };
                if (checks[id]) delete checks[id];
                else checks[id] = new Date().toISOString();
                return { ...prev, checks };
            }),
        [update],
    );

    const setSubmitted = useCallback(
        (submitted: boolean) => update((prev) => ({ ...prev, submittedAt: submitted ? new Date().toISOString() : null })),
        [update],
    );

    return { state, loaded, choose, setIdea, setFeature, toggleCheck, setSubmitted };
}
