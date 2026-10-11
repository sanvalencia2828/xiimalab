/**
 * lib/profile/data.ts
 * Datos personales de Mi Perfil: nombre, bio, foto, enlaces y certificaciones.
 * Se guardan en el navegador (hooks/useProfile.ts). Las wallets se vinculan en
 * Configuración.
 */
import { parseCertifications, type Certification } from "./certifications";

export const PROFILE_LINKS = [
    { key: "github", label: "GitHub", placeholder: "https://github.com/tu-usuario" },
    { key: "linkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/in/tu-usuario" },
    { key: "x", label: "X", placeholder: "https://x.com/tu-usuario" },
    { key: "devpost", label: "Devpost", placeholder: "https://devpost.com/tu-usuario" },
    { key: "dorahacks", label: "DoraHacks", placeholder: "https://dorahacks.io/hacker/tu-usuario" },
    { key: "devfolio", label: "Devfolio", placeholder: "https://devfolio.co/@tu-usuario" },
] as const;

export type ProfileLinkKey = (typeof PROFILE_LINKS)[number]["key"];

export interface Profile {
    name: string;
    bio: string;
    /** URL de la foto; vacío → iniciales */
    avatarUrl: string;
    links: Record<ProfileLinkKey, string>;
    certifications: Certification[];
}

export const EMPTY_PROFILE: Profile = {
    name: "",
    bio: "",
    avatarUrl: "",
    links: { github: "", linkedin: "", x: "", devpost: "", dorahacks: "", devfolio: "" },
    certifications: [],
};

const MAX_NAME = 80;
const MAX_BIO = 300;
const MAX_URL = 300;

/** "github.com/yo" → "https://github.com/yo"; devuelve "" si no es una URL http(s) válida. */
export function normalizeUrl(raw: string): string {
    const value = raw.trim();
    if (!value) return "";
    try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        const valid = (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
        return valid ? url.toString().slice(0, MAX_URL) : "";
    } catch {
        return "";
    }
}

/** Iniciales para el avatar: "Santiago Valencia" → "SV". Vacío si no hay nombre. */
export function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");
}

/** Lee un perfil guardado, descartando lo que no tenga la forma esperada. */
export function parseProfile(raw: unknown): Profile {
    if (!raw || typeof raw !== "object") return EMPTY_PROFILE;
    const obj = raw as Record<string, unknown>;
    const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
    const rawLinks = obj.links && typeof obj.links === "object" ? (obj.links as Record<string, unknown>) : {};
    return {
        name: text(obj.name, MAX_NAME),
        bio: text(obj.bio, MAX_BIO),
        avatarUrl: normalizeUrl(text(obj.avatarUrl, MAX_URL)),
        links: Object.fromEntries(
            PROFILE_LINKS.map(({ key }) => [key, normalizeUrl(text(rawLinks[key], MAX_URL))]),
        ) as Record<ProfileLinkKey, string>,
        certifications: parseCertifications(obj.certifications),
    };
}
