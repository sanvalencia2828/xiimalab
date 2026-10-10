/**
 * lib/hackathons/match.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Fórmula de match_score para hackatones — port directo de
 * services/scraper/parser.py:compute_match_score: suma de pesos de las skills
 * encontradas (por subcadena) en título + tags + texto extra, normalizada
 * contra la suma de todos los pesos, 0–100 con piso 5.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const SKILL_WEIGHTS: Record<string, number> = {
    python: 20,
    ai: 18,
    ml: 18,
    "machine learning": 18,
    data: 15,
    analytics: 12,
    docker: 14,
    devops: 12,
    blockchain: 16,
    stellar: 14,
    avalanche: 14,
    defi: 12,
    nft: 8,
    web3: 10,
    "smart contracts": 12,
    fastapi: 10,
    "open track": 6,
};

const MAX_POSSIBLE_SCORE = Object.values(SKILL_WEIGHTS).reduce((sum, w) => sum + w, 0);

export function computeMatchScore(title: string, tags: string[], extra = ""): number {
    const corpus = `${title} ${tags.join(" ")} ${extra}`.toLowerCase();
    const raw = Object.entries(SKILL_WEIGHTS).reduce(
        (sum, [kw, w]) => (corpus.includes(kw) ? sum + w : sum),
        0,
    );
    return Math.min(100, Math.max(5, Math.round((raw / MAX_POSSIBLE_SCORE) * 100)));
}
