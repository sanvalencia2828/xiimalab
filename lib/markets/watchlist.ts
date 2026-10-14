/**
 * lib/markets/watchlist.ts
 * Acciones ligadas a los temas de Xiimalab (IA, blockchain y herramientas de
 * desarrollo). Cada tema tiene palabras clave con las que se mide cuánto
 * aparece en las hackatones y bounties abiertos; cada acción, un peso según
 * qué tan directa es su exposición al tema (1 = negocio principal).
 */

export type ThemeKey = "ia" | "blockchain" | "devtools";

export interface Theme {
    key: ThemeKey;
    label: string;
    keywords: string[];
}

export interface WatchStock {
    ticker: string;
    theme: ThemeKey;
    /** 0..1: exposición directa (1) o indirecta (<1) al tema */
    weight: number;
    /** Por qué importa para Xiimalab, en una línea */
    why: string;
}

export const THEMES: Theme[] = [
    {
        key: "ia",
        label: "IA",
        keywords: [
            "ia", "ai", "ml", "llm", "llms", "agent", "agents", "machine learning", "gpt", "genai",
            "generative", "deep learning", "computer vision", "nlp", "data science", "inteligencia artificial",
        ],
    },
    {
        key: "blockchain",
        label: "Blockchain",
        keywords: [
            "blockchain", "web3", "crypto", "cripto", "defi", "nft", "smart contract", "solana", "ethereum",
            "stellar", "avalanche", "bitcoin", "rwa", "stablecoin", "dao", "zk", "onchain", "on-chain", "token",
        ],
    },
    {
        key: "devtools",
        label: "Dev y cloud",
        keywords: [
            "cloud", "devops", "docker", "kubernetes", "database", "data", "analytics", "security",
            "cybersecurity", "ciberseguridad", "api", "infra", "infrastructure", "open source", "developer tools",
            "serverless", "backend",
        ],
    },
];

export const WATCHLIST: WatchStock[] = [
    // IA
    { ticker: "NVDA", theme: "ia", weight: 1, why: "GPUs con las que se entrenan y ejecutan los modelos de IA" },
    { ticker: "AMD", theme: "ia", weight: 0.9, why: "GPUs y CPUs para centros de datos de IA" },
    { ticker: "MSFT", theme: "ia", weight: 0.9, why: "Azure, alianza con OpenAI y GitHub Copilot" },
    { ticker: "GOOGL", theme: "ia", weight: 0.9, why: "Modelos Gemini y Google Cloud" },
    { ticker: "AVGO", theme: "ia", weight: 0.8, why: "Chips a medida y redes para clústeres de IA" },
    { ticker: "TSM", theme: "ia", weight: 0.8, why: "Fabrica los chips de IA de Nvidia, AMD y Apple" },
    { ticker: "MU", theme: "ia", weight: 0.8, why: "Memoria HBM que usan las GPUs de IA" },
    { ticker: "META", theme: "ia", weight: 0.8, why: "Modelos abiertos Llama" },
    { ticker: "AMZN", theme: "ia", weight: 0.8, why: "AWS y Bedrock para apps con IA" },
    { ticker: "ARM", theme: "ia", weight: 0.7, why: "Arquitectura de procesadores en móviles y servidores" },
    { ticker: "PLTR", theme: "ia", weight: 0.7, why: "Plataformas de IA para empresas y gobierno" },
    { ticker: "SNDK", theme: "ia", weight: 0.6, why: "Almacenamiento flash para centros de datos" },
    // Blockchain
    { ticker: "COIN", theme: "blockchain", weight: 1, why: "Exchange cripto y red Base" },
    { ticker: "CRCL", theme: "blockchain", weight: 1, why: "Emisor de la stablecoin USDC" },
    { ticker: "HOOD", theme: "blockchain", weight: 0.8, why: "Trading de cripto y acciones tokenizadas" },
    { ticker: "GLXY", theme: "blockchain", weight: 0.8, why: "Servicios financieros e infraestructura cripto" },
    { ticker: "MSTR", theme: "blockchain", weight: 0.7, why: "Tesorería corporativa en bitcoin" },
    { ticker: "BLSH", theme: "blockchain", weight: 0.7, why: "Exchange cripto institucional (Bullish)" },
    { ticker: "GEMI", theme: "blockchain", weight: 0.7, why: "Exchange cripto (Gemini)" },
    { ticker: "DFDV", theme: "blockchain", weight: 0.7, why: "Tesorería en SOL del ecosistema Solana" },
    { ticker: "FIGR", theme: "blockchain", weight: 0.6, why: "Préstamos y activos del mundo real en blockchain" },
    { ticker: "XYZ", theme: "blockchain", weight: 0.6, why: "Block: pagos y bitcoin (Cash App)" },
    // Herramientas de desarrollo, cloud y datos
    { ticker: "NET", theme: "devtools", weight: 1, why: "Red y plataforma serverless (Workers) para desarrolladores" },
    { ticker: "MDB", theme: "devtools", weight: 0.8, why: "Base de datos MongoDB" },
    { ticker: "DDOG", theme: "devtools", weight: 0.8, why: "Observabilidad y monitoreo de aplicaciones" },
    { ticker: "GTLB", theme: "devtools", weight: 0.8, why: "Plataforma DevOps y repositorios Git" },
    { ticker: "SNOW", theme: "devtools", weight: 0.7, why: "Almacén de datos en la nube" },
    { ticker: "CRWD", theme: "devtools", weight: 0.7, why: "Ciberseguridad de endpoints y nube" },
    { ticker: "ORCL", theme: "devtools", weight: 0.6, why: "Nube y bases de datos para empresas" },
];

// ── Demanda de cada tema en las oportunidades de Xiimalab ───────────────────

export interface OpportunityText {
    title: string;
    tags?: string[] | null;
    /** true si la oportunidad es del ecosistema blockchain aunque no lo diga (p. ej. Superteam = Solana) */
    blockchainNative?: boolean;
}

export interface ThemeDemand {
    key: ThemeKey;
    label: string;
    matches: number;
    total: number;
    /** 0..1 relativo al tema con más coincidencias */
    score: number;
}

function mentions(text: string, kw: string): boolean {
    // Palabras cortas (ia, ai, ml, zk, dao…) solo como palabra completa
    if (kw.length <= 3) return new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`).test(text);
    return text.includes(kw);
}

export function themeDemand(items: OpportunityText[]): ThemeDemand[] {
    const counts = THEMES.map((theme) => {
        const matches = items.filter((it) => {
            if (theme.key === "blockchain" && it.blockchainNative) return true;
            const text = `${it.title} ${(it.tags ?? []).join(" ")}`.toLowerCase();
            return theme.keywords.some((kw) => mentions(text, kw));
        }).length;
        return { key: theme.key, label: theme.label, matches, total: items.length };
    });
    const max = Math.max(1, ...counts.map((c) => c.matches));
    return counts.map((c) => ({ ...c, score: c.matches / max }));
}

/** Importancia de una acción para Xiimalab (0–100): demanda de su tema × su exposición al tema. */
export function stockRelevance(stock: WatchStock, demand: ThemeDemand[]): number {
    const d = demand.find((x) => x.key === stock.theme);
    // Sin datos de demanda, cuenta solo la exposición
    const themeScore = d && d.total > 0 ? d.score : 1;
    return Math.round(100 * (0.6 * themeScore + 0.4) * stock.weight);
}
