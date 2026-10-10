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
