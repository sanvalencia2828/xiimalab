/**
 * lib/hackathons/match.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Fórmula de match_score para hackatones (mismo enfoque que
 * services/scraper/parser.py:compute_match_score): suma de pesos de las skills
 * encontradas en título + tags + texto extra, normalizada a 0–100 con piso 5.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const SKILL_WEIGHTS: Record<string, number> = {
    python: 20,
    ai: 18,
    ml: 18,
    "machine learning": 18,
    llm: 16,
    agent: 12,
    data: 15,
    analytics: 12,
    docker: 14,
    devops: 12,
    blockchain: 16,
    stellar: 14,
    avalanche: 14,
    solana: 12,
    defi: 12,
    nft: 8,
    web3: 10,
    "smart contract": 12,
    fastapi: 10,
    typescript: 10,
    "next.js": 8,
    react: 8,
    "open track": 6,
    "open ended": 6,
};
/**
 * Skills de los tracks de aprendizaje que no pesan en el match_score: sirven
 * para cruzar fases, proyectos y hackatones (lib/learning).
 */
export const LEARNING_SKILLS: string[] = [
    "rag",
    "embeddings",
    "evaluation",
    "fine-tuning",
    "tool use",
    "mcp",
    "orchestration",
    "memory",
    "multi-agent",
];

/**
 * Otras formas en que una skill aparece en las etiquetas de una hackatón o en
 * el stack de un proyecto. Solo las usa el cruce de lib/learning: el
 * match_score sigue sumando los pesos de SKILL_WEIGHTS tal cual.
 */
export const SKILL_SYNONYMS: Record<string, string[]> = {
    ml: ["machine learning"],
    llm: ["large language model", "generative ai", "genai", "gen ai"],
    agent: ["agentic"],
    rag: ["retrieval augmented", "retrieval-augmented"],
    embeddings: ["embedding", "vector search", "vector database", "semantic search"],
    evaluation: ["evals", "benchmark"],
    "fine-tuning": ["fine tuning", "finetuning", "fine-tune"],
    "tool use": ["tool calling", "function calling"],
    mcp: ["model context protocol"],
    orchestration: ["workflow"],
    "multi-agent": ["multi agent", "multiagent"],
};

// Con ~3 coincidencias fuertes se alcanza 100.
const SCORE_SATURATION = 60;

function wordMatch(corpus: string, kw: string): boolean {
    // Palabras cortas (ai, ml, llm…) solo como palabra completa
    if (kw.length <= 3) return new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`).test(corpus);
    return corpus.includes(kw);
}

export function computeMatchScore(title: string, tags: string[], extra = ""): number {
    const corpus = `${title} ${tags.join(" ")} ${extra}`.toLowerCase();
    const raw = Object.entries(SKILL_WEIGHTS).reduce(
        (sum, [kw, w]) => (wordMatch(corpus, kw) ? sum + w : sum),
        0,
    );
    return Math.min(100, Math.max(5, Math.round((raw / SCORE_SATURATION) * 100)));
}
