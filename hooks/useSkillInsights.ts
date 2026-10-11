"use client";

import { useCallback, useEffect, useState } from "react";
import { getSkillInsightsAction } from "@/app/actions/skills";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { useMilestoneEvidence } from "@/hooks/useMilestoneEvidence";
import { useProfile } from "@/hooks/useProfile";
import type { SkillInsights } from "@/lib/skills/types";

export interface SkillInsightsState {
    /** null mientras se calcula o si falló */
    data: SkillInsights | null;
    failed: boolean;
    retry: () => void;
}

/** Nombres de las skills de la lista de /skills (pestaña Mi Perfil), guardada en el navegador. */
export function readDeclaredSkillNames(): string[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem("user_skills") ?? "[]");
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((s) => (s && typeof s === "object" && typeof (s as { name?: unknown }).name === "string" ? (s as { name: string }).name : ""))
            .filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * Skills frente al mercado, calculadas en el servidor con lo que vive en el
 * navegador: avance de los tracks, certificaciones del perfil y skills
 * declaradas. Sin `declared` se leen de localStorage.
 */
export function useSkillInsights(declared?: string[]): SkillInsightsState {
    const { state, loaded: progressLoaded } = useLearningProgress();
    const { profile, loaded: profileLoaded } = useProfile();
    const { evidence, loaded: evidenceLoaded } = useMilestoneEvidence();
    const [data, setData] = useState<SkillInsights | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    // La lista llega como array nuevo en cada render: se compara por contenido
    const declaredKey = declared?.join("\n");

    useEffect(() => {
        if (!progressLoaded || !profileLoaded || !evidenceLoaded) return;
        let cancelled = false;
        const names = declaredKey === undefined ? readDeclaredSkillNames() : declaredKey.split("\n").filter(Boolean);
        getSkillInsightsAction(state, { certifications: profile.certifications, declared: names, milestoneEvidence: evidence })
            .then((next) => {
                if (cancelled) return;
                setData(next);
                setFailed(false);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [progressLoaded, profileLoaded, evidenceLoaded, state, profile.certifications, evidence, declaredKey, attempt]);

    const retry = useCallback(() => {
        setFailed(false);
        setAttempt((n) => n + 1);
    }, []);

    return { data, failed, retry };
}
