/**
 * lib/ideas/data.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ideas en exploración: lo que todavía no es un proyecto. Lista compartida
 * entre Mi Perfil (cliente) y el cálculo de encaje con hackatones (servidor),
 * igual que PROJECTS en lib/projects/data.ts.
 *
 * `skills` se escribe como se nombraría en un stack ("Supabase", "GitHub
 * Actions"); el cruce con las hackatones las normaliza a las etiquetas de
 * lib/hackathons/match.ts con skillsFromStack (lib/learning/skills.ts).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type IdeaStatus = "pensando" | "investigando" | "prototipo" | "convertida" | "descartada";

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
    pensando: "Pensando",
    investigando: "Investigando",
    prototipo: "Prototipo",
    convertida: "Convertida en proyecto",
    descartada: "Descartada",
};

export type IdeaKind = "nuevo" | "integracion" | "por-decidir";

export const IDEA_KIND_LABELS: Record<IdeaKind, string> = {
    nuevo: "Proyecto nuevo",
    integracion: "Integración en un proyecto existente",
    "por-decidir": "Por decidir",
};

export interface Idea {
    id: string;
    title: string;
    /** 1–2 frases */
    summary: string;
    problem: string;
    /** Cómo funcionaría, en 3–5 pasos */
    steps: string[];
    status: IdeaStatus;
    kind: IdeaKind;
    /** Matiz del tipo, p. ej. entre qué opciones está la decisión */
    kindNote?: string;
    /** Título de un proyecto de lib/projects/data.ts */
    relatedProject?: string;
    skills: string[];
    /** Riesgos o dudas abiertas */
    risks: string[];
    createdAt: string; // "YYYY-MM-DD"
    updatedAt: string; // "YYYY-MM-DD"
}

export const IDEAS: Idea[] = [
    {
        id: "bingx-memecoin-listings",
        title: "Detector de nuevos listados de memecoins en BingX",
        summary:
            "Avisar en minutos cuando BingX lista un nuevo par spot que sea memecoin, para seguir los lanzamientos sin revisar el exchange a mano.",
        problem: "Los listados nuevos se descubren tarde o por redes sociales; no hay una señal propia y verificable.",
        steps: [
            "Consultar cada 15 min el endpoint público de pares spot de BingX (/openApi/spot/v1/common/symbols, sin auth).",
            "Comparar con la lista guardada en Supabase para detectar pares nuevos.",
            "Clasificar como memecoin cruzando con la categoría \"meme-token\" de CoinGecko.",
            "Avisar en la campana de Xiimalab y, opcionalmente, por Telegram.",
            "Mostrar el historial en el Radar de memecoins.",
        ],
        status: "pensando",
        kind: "por-decidir",
        kindNote: "Integración en el Radar de memecoins o proyecto nuevo",
        relatedProject: "Pulsar Radar",
        skills: ["Python", "TypeScript", "APIs REST", "Supabase", "GitHub Actions", "Bots de Telegram", "Cripto"],
        risks: [
            "Detecta el par cuando ya existe, no el anuncio previo.",
            "Memecoins recién listados son muy volátiles: la señal es informativa, no de compra.",
            "Licencia del Radar si es de un tercero.",
            "Frecuencia: GitHub Actions gratis; Vercel Cron limitado.",
        ],
        createdAt: "2026-10-11",
        updatedAt: "2026-10-11",
    },
];
