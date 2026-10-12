"use client";

import { useCallback, useEffect, useState } from "react";
import { migrateEvidence } from "@/lib/learning/evidence";

const STORAGE_KEY = "xiimalab_milestone_evidence";
const CHANGE_EVENT = "xiimalab:milestone-evidence";

/** id del hito → proyecto del portafolio en el que se aplicó */
export type EvidenceMap = Record<string, string>;

function read(): EvidenceMap {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
        if (!parsed || typeof parsed !== "object") return {};
        return migrateEvidence(
            Object.fromEntries(
                Object.entries(parsed as Record<string, unknown>).filter(
                    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
                ),
            ),
        );
    } catch {
        return {};
    }
}

/**
 * Proyecto que el usuario registró como evidencia de cada hito, guardado en el
 * navegador igual que el avance de los tracks. Solo se registra cuando el
 * usuario lo confirma; nunca de forma automática.
 */
export function useMilestoneEvidence() {
    const [evidence, setEvidence] = useState<EvidenceMap>({});
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const sync = () => setEvidence(read());
        sync();
        setLoaded(true);
        window.addEventListener("storage", sync);
        window.addEventListener(CHANGE_EVENT, sync);
        return () => {
            window.removeEventListener("storage", sync);
            window.removeEventListener(CHANGE_EVENT, sync);
        };
    }, []);

    const update = useCallback((change: (prev: EvidenceMap) => EvidenceMap) => {
        const next = change(read());
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch { /* almacenamiento lleno o bloqueado: el cambio vive solo en esta sesión */ }
        setEvidence(next);
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    const record = useCallback(
        (milestoneId: string, project: string) => update((prev) => ({ ...prev, [milestoneId]: project })),
        [update],
    );

    const remove = useCallback(
        (milestoneId: string) =>
            update((prev) => {
                const next = { ...prev };
                delete next[milestoneId];
                return next;
            }),
        [update],
    );

    return { evidence, loaded, record, remove };
}
