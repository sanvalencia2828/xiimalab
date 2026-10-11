"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_LEARNING_STATE, type LearningState, parseLearningState } from "@/lib/learning/progress";

const STORAGE_KEY = "xiimalab_learning_progress";
const CHANGE_EVENT = "xiimalab:learning-progress";

function read(): LearningState {
    try {
        return parseLearningState(localStorage.getItem(STORAGE_KEY));
    } catch {
        return EMPTY_LEARNING_STATE;
    }
}

/**
 * Avance de los tracks guardado en el navegador, con la fecha de cada hito.
 * `loaded` es false hasta leer localStorage, para no pintar 0 % durante la hidratación.
 */
export function useLearningProgress() {
    const [state, setState] = useState<LearningState>(EMPTY_LEARNING_STATE);
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

    const update = useCallback((change: (prev: LearningState) => LearningState) => {
        const next = change(read());
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch { /* almacenamiento lleno o bloqueado: el cambio vive solo en esta sesión */ }
        setState(next);
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    /** Marca o desmarca un hito; al marcarlo guarda la fecha y activa su track. */
    const toggleMilestone = useCallback(
        (trackId: string, milestoneId: string) => {
            update((prev) => {
                const done = { ...prev.done };
                const now = new Date().toISOString();
                if (done[milestoneId]) delete done[milestoneId];
                else done[milestoneId] = now;
                const started = prev.started[trackId] ? prev.started : { ...prev.started, [trackId]: now };
                return { done, started };
            });
        },
        [update],
    );

    const startTrack = useCallback(
        (trackId: string) => {
            update((prev) =>
                prev.started[trackId]
                    ? prev
                    : { ...prev, started: { ...prev.started, [trackId]: new Date().toISOString() } },
            );
        },
        [update],
    );

    return { state, loaded, toggleMilestone, startTrack };
}
