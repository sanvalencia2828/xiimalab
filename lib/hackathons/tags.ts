/**
 * lib/hackathons/tags.ts
 * Normalización de etiquetas para el filtro de la página de hackatones:
 * une variantes de mayúsculas y espacios, fusiona sinónimos obvios y deja
 * fuera los nombres de plataformas y patrocinadores.
 */

export interface TagOption {
    /** Clave de comparación (minúsculas) */
    key: string;
    label: string;
    count: number;
}

interface TaggedHackathon {
    tags?: string[] | null;
    organizer?: string | null;
}

// Sinónimos → clave canónica. La etiqueta visible está en CANONICAL_LABELS.
const SYNONYMS: Record<string, string> = {
    "ai": "ia",
    "al": "ia", // "AI" escrito con ele minúscula en algunas fuentes
    "ml": "ia",
    "artificial intelligence": "ia",
    "machine learning": "ia",
    "machine learning/ai": "ia",
    "ai & machine learning": "ia",
    "ai/ml": "ia",
    "ai agent": "ai agents",
    "block chain": "blockchain",
    "cryptocurrency": "crypto",
    "iot (internet of things)": "iot",
    "social impact": "social good",
    "healthtech": "health",
    "web development": "web",
    "mobile development": "mobile",
    "student hackathon": "student",
    "real world assets": "rwa",
};

const CANONICAL_LABELS: Record<string, string> = {
    ia: "IA",
    "ai agents": "AI Agents",
    iot: "IoT",
    rwa: "RWA",
    blockchain: "Blockchain",
    crypto: "Crypto",
    health: "Health",
    "social good": "Social Good",
    web: "Web",
    mobile: "Mobile",
    student: "Student",
};

// Plataformas de origen y patrocinadores que aparecen como etiqueta
const EXCLUDED = new Set([
    "devpost", "devfolio", "dorahacks",
    "openai", "anthropic", "llama", "ibm watsonx", "esri", "weex", "circle", "arc", "anna",
]);

/** Clave canónica de una etiqueta: sin espacios ni puntuación sobrante, en minúsculas y con sinónimos fusionados. */
export function tagKey(raw: string): string {
    const cleaned = raw
        .normalize("NFKC")
        .replace(/[,;.\s]+$/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    return SYNONYMS[cleaned] ?? cleaned;
}

function cleanLabel(raw: string): string {
    return raw.normalize("NFKC").replace(/[,;.\s]+$/g, "").replace(/\s+/g, " ").trim();
}

function isSponsorOrPlatform(key: string, organizer?: string | null): boolean {
    if (EXCLUDED.has(key)) return true;
    const org = organizer?.trim().toLowerCase();
    // La etiqueta es el propio organizador (p. ej. "Algorand" en una hackatón de Algorand)
    return Boolean(org && key.length >= 3 && (org === key || org.split(/\s+/).includes(key)));
}

/** Claves canónicas de las etiquetas de una hackatón, sin duplicados. */
export function hackathonTagKeys(hackathon: TaggedHackathon): string[] {
    return Array.from(new Set((hackathon.tags ?? []).map(tagKey).filter(Boolean)));
}

/** Etiquetas del filtro: sinónimos fusionados, sin patrocinadores ni plataformas, de más a menos frecuentes. */
export function buildTagOptions(hackathons: TaggedHackathon[]): TagOption[] {
    const options = new Map<string, TagOption>();
    for (const h of hackathons) {
        const seen = new Set<string>();
        for (const raw of h.tags ?? []) {
            const key = tagKey(raw);
            if (!key || seen.has(key) || isSponsorOrPlatform(key, h.organizer)) continue;
            seen.add(key);
            const existing = options.get(key);
            if (existing) existing.count += 1;
            else options.set(key, { key, label: CANONICAL_LABELS[key] ?? cleanLabel(raw), count: 1 });
        }
    }
    return Array.from(options.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
