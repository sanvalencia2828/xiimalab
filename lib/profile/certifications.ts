/**
 * lib/profile/certifications.ts
 * Certificaciones que el usuario añade en Mi Perfil. Son la evidencia más
 * fuerte de una skill ("Certificada"), por encima de un proyecto que la usa.
 * Se guardan con el perfil, en el navegador (hooks/useProfile.ts).
 */
import { SKILLS } from "@/lib/learning/skills";

export interface Certification {
    id: string;
    provider: string;
    name: string;
    /** Fecha de obtención, "YYYY-MM-DD" */
    date: string;
    /** URL pública donde se puede verificar (https) */
    url: string;
    /** Skills que acredita (etiquetas de lib/hackathons/match.ts) */
    skills: string[];
}

const MAX_CERTIFICATIONS = 30;
const MAX_TEXT = 120;
const MAX_URL = 300;

/** URL https válida, normalizada; "" si no lo es. */
export function verificationUrl(raw: string): string {
    try {
        const url = new URL(raw.trim());
        return url.protocol === "https:" && url.hostname.includes(".") ? url.toString().slice(0, MAX_URL) : "";
    } catch {
        return "";
    }
}

export function isValidDate(day: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(new Date(`${day}T00:00:00Z`).getTime());
}

/** Lee certificaciones guardadas o recibidas del cliente; descarta las que no estén completas. */
export function parseCertifications(raw: unknown): Certification[] {
    if (!Array.isArray(raw)) return [];
    const known = new Set(SKILLS);
    const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "");
    const out: Certification[] = [];
    for (const item of raw.slice(0, MAX_CERTIFICATIONS)) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;
        const provider = text(obj.provider);
        const name = text(obj.name);
        const date = text(obj.date);
        const url = typeof obj.url === "string" ? verificationUrl(obj.url) : "";
        const skills = Array.isArray(obj.skills)
            ? Array.from(new Set(obj.skills.filter((s): s is string => typeof s === "string" && known.has(s))))
            : [];
        if (!provider || !name || !url || !isValidDate(date) || skills.length === 0) continue;
        out.push({ id: text(obj.id) || `${provider}:${name}:${date}`, provider, name, date, url, skills });
    }
    return out;
}

/** La certificación más reciente que acredita una skill, o null. */
export function certificationFor(skill: string, certifications: Certification[]): Certification | null {
    return (
        certifications
            .filter((c) => c.skills.includes(skill))
            .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    );
}
