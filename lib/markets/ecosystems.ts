/**
 * lib/markets/ecosystems.ts
 * Para cada cripto de Backpack Lend, su ecosistema: programas oficiales para
 * construir (hackatones, bounties, grants) y las palabras con las que se buscan
 * oportunidades abiertas en el agregador de hackatones y en Superteam.
 * Transformación pura: la página /lend le pasa los datos ya descargados.
 *
 * Las palabras de 3 letras o menos (eth, btc, sui…) solo cuentan como palabra
 * completa; las más largas, como subcadena ("solana" encaja en "SolanaFM").
 */
import { formatReward, rewardSortValue, type Bounty } from "@/lib/bounties/parse";
import { formatPrize, isUsdPrize } from "@/lib/hackathons/format";
import type { AggregatedHackathon } from "@/lib/types";

export type ProgramKind = "hackatones" | "bounties" | "grants" | "programas" | "docs";

export const PROGRAM_KIND_LABELS: Record<ProgramKind, string> = {
    hackatones: "Hackatones",
    bounties: "Bounties",
    grants: "Grants",
    programas: "Programas",
    docs: "Docs y bug bounty",
};

export interface Program {
    label: string;
    url: string;
    kind: ProgramKind;
}

export interface Ecosystem {
    name: string;
    keywords: string[];
    programs: Program[];
    /** Todos los bounties de Superteam cuentan para este ecosistema (Solana) */
    superteam?: boolean;
    /** Aclaración que se muestra junto a los programas */
    note?: string;
}

export const ECOSYSTEMS: Record<string, Ecosystem> = {
    SOL: {
        name: "Solana",
        keywords: ["solana", "superteam", "colosseum"],
        superteam: true,
        programs: [
            { label: "Superteam Earn", url: "https://superteam.fun/earn", kind: "bounties" },
            { label: "Colosseum", url: "https://colosseum.com", kind: "hackatones" },
            { label: "Solana Foundation", url: "https://solana.org/grants-funding", kind: "grants" },
        ],
    },
    ETH: {
        name: "Ethereum",
        keywords: ["ethereum", "eth", "ethglobal", "evm", "solidity"],
        programs: [
            { label: "ETHGlobal", url: "https://ethglobal.com", kind: "hackatones" },
            { label: "Ecosystem Support Program", url: "https://esp.ethereum.foundation", kind: "grants" },
        ],
    },
    BTC: {
        name: "Bitcoin",
        keywords: ["bitcoin", "btc", "lightning"],
        programs: [{ label: "OpenSats", url: "https://opensats.org", kind: "grants" }],
    },
    BNB: {
        name: "BNB Chain",
        keywords: ["bnb", "bsc", "bnb chain"],
        programs: [
            { label: "Developer programs", url: "https://bnbchain.org/en/developers/developer-programs", kind: "programas" },
        ],
    },
    SUI: {
        name: "Sui",
        keywords: ["sui", "walrus"],
        programs: [
            { label: "Sui developer grants", url: "https://forums.sui.io/t/apply-for-a-sui-developer-grant/58", kind: "grants" },
        ],
    },
    APT: {
        name: "Aptos",
        keywords: ["aptos", "movemaker"],
        programs: [{ label: "Aptos Foundation", url: "https://aptosfoundation.org/grants", kind: "grants" }],
    },
    MON: {
        name: "Monad",
        keywords: ["monad"],
        programs: [{ label: "Home for builders", url: "https://monad.xyz/blog/home-for-builders", kind: "programas" }],
    },
    SEI: {
        name: "Sei",
        keywords: ["sei"],
        programs: [{ label: "Sei developers", url: "https://sei.io/developers", kind: "programas" }],
    },
    XRP: {
        name: "XRP Ledger",
        keywords: ["xrp", "xrpl", "ripple"],
        programs: [{ label: "XRPL Grants", url: "https://xrplgrants.org", kind: "grants" }],
    },
    HYPE: {
        name: "Hyperliquid",
        keywords: ["hyperliquid", "hyperevm"],
        note: "Sin grants públicos",
        programs: [
            { label: "HyperEVM", url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hyperevm", kind: "docs" },
        ],
    },
    USDC: {
        name: "Circle",
        keywords: ["usdc", "circle"],
        programs: [{ label: "Circle developers", url: "https://developers.circle.com", kind: "programas" }],
    },
    XPL: { name: "Plasma", keywords: ["plasma", "xpl"], programs: [], note: "Sin programa oficial para desarrolladores" },
    DOGE: { name: "Dogecoin", keywords: ["dogecoin"], programs: [], note: "Sin programa oficial para desarrolladores" },
    USDT: { name: "Tether", keywords: ["usdt", "tether"], programs: [], note: "Sin programa oficial para desarrolladores" },
    PAXG: { name: "PAX Gold", keywords: [], programs: [], note: "Sin programa oficial ni oportunidades que buscar" },
};

/** Ecosistema de un símbolo; uno vacío si no está en el mapa. */
export function ecosystemFor(symbol: string): Ecosystem {
    return ECOSYSTEMS[symbol] ?? { name: symbol, keywords: [], programs: [] };
}

// ── Oportunidades ───────────────────────────────────────────────────────────

export type OpportunityKind = "hackathon" | "bounty";

/** Hackatón o bounty abierto, en un formato común para buscarlo y mostrarlo. */
export interface Opportunity {
    kind: OpportunityKind;
    id: string;
    title: string;
    /** "DoraHacks", "Devpost", "Devfolio", "Superteam" */
    platform: string;
    tags: string[];
    organizer: string | null;
    /** Premio comparable en USD, o null si no se puede comparar */
    prizeUsd: number | null;
    prizeLabel: string;
    /** "YYYY-MM-DD" o ISO 8601 */
    deadline: string | null;
    url: string | null;
    /** Viene de Superteam Earn */
    superteam: boolean;
}

const SHORT_KEYWORD = 3;

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** true si `keyword` aparece en `text` (sin distinguir mayúsculas); las cortas, como palabra completa. */
export function keywordMatches(text: string, keyword: string): boolean {
    const t = text.toLowerCase();
    const k = keyword.trim().toLowerCase();
    if (!k) return false;
    if (k.length > SHORT_KEYWORD) return t.includes(k);
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(k)}($|[^a-z0-9])`).test(t);
}

/** Oportunidades del ecosistema: alguna keyword en título, tags u organizador (y todo Superteam para Solana). */
export function matchOpportunities(items: Opportunity[], ecosystem: Ecosystem): Opportunity[] {
    return items.filter((item) => {
        if (ecosystem.superteam && item.superteam) return true;
        const fields = [item.title, item.organizer ?? "", ...item.tags];
        return ecosystem.keywords.some((k) => fields.some((f) => keywordMatches(f, k)));
    });
}

export interface OpportunitySummary {
    hackathons: number;
    bounties: number;
    /** Las de mayor premio en USD (las que no se pueden comparar van al final), luego la que cierra antes */
    top: Opportunity[];
}

export function summarizeOpportunities(matched: Opportunity[], topN = 3): OpportunitySummary {
    const time = (d: string | null) => (d ? new Date(d).getTime() || Infinity : Infinity);
    const top = [...matched]
        .sort((a, b) => (b.prizeUsd ?? -1) - (a.prizeUsd ?? -1) || time(a.deadline) - time(b.deadline))
        .slice(0, topN);
    return {
        hackathons: matched.filter((o) => o.kind === "hackathon").length,
        bounties: matched.filter((o) => o.kind === "bounty").length,
        top,
    };
}

const PLATFORM_LABELS: Record<string, string> = { dorahacks: "DoraHacks", devpost: "Devpost", devfolio: "Devfolio" };

/** Hackatón del agregador → Opportunity (premio comparable con el mismo criterio que las tarjetas). */
export function fromHackathon(h: AggregatedHackathon): Opportunity {
    return {
        kind: "hackathon",
        id: h.id,
        title: h.title,
        platform: PLATFORM_LABELS[h.source.toLowerCase()] ?? h.source,
        tags: h.tags ?? [],
        organizer: h.organizer ?? null,
        prizeUsd: isUsdPrize(h.prize_pool, h.prize_currency, h.prize_unverified) ? h.prize_pool : null,
        prizeLabel: formatPrize(h.prize_pool, h.prize_currency, h.prize_unverified),
        deadline: h.deadline || null,
        url: h.source_url ?? null,
        superteam: false,
    };
}

/** Bounty de Superteam → Opportunity (premio en USD solo si se paga en stablecoin). */
export function fromBounty(b: Bounty): Opportunity {
    const usd = rewardSortValue(b);
    return {
        kind: "bounty",
        id: b.id,
        title: b.title,
        platform: "Superteam",
        tags: [b.type],
        organizer: b.sponsor.name || null,
        prizeUsd: usd > 0 ? usd : null,
        prizeLabel: formatReward(b),
        deadline: b.deadline || null,
        url: b.url,
        superteam: true,
    };
}
