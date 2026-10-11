/**
 * lib/bounties/parse.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tipo Bounty y transformación pura de los listings de Superteam Earn.
 * Sin red ni dependencias de Next: lo usan el servidor, los componentes
 * cliente y los tests.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { computeMatchScore } from "../hackathons/match";

export type RewardKind = "fixed" | "range" | "variable";

export interface BountySponsor {
    name: string;
    slug: string;
    logo: string | null;
    isVerified: boolean;
}

export interface Bounty {
    id: string;
    title: string;
    slug: string;
    url: string;
    type: string;               // "bounty" | "project"
    deadline: string;           // ISO 8601 con hora
    rewardKind: RewardKind;
    rewardAmount: number | null; // fixed
    rewardMin: number | null;    // range
    rewardMax: number | null;    // range
    token: string | null;
    submissions: number;
    isDev: boolean;             // aparece en la categoría Development
    matchScore: number;         // 0–100, misma fórmula que las hackatones
    sponsor: BountySponsor;
    source: "superteam";
}

export const SUPERTEAM_LISTING_URL = "https://superteam.fun/earn/listing";

// Tokens que se comparan por importe al ordenar por recompensa
const STABLECOINS = new Set(["USDC", "USDG", "USDT"]);
const URGENT_DAYS = 3;

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string {
    return typeof v === "string" ? v.trim() : "";
}
function numOrNull(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Listing crudo → Bounty. Null si le falta título, slug o una fecha de cierre válida. */
export function parseSuperteamListing(raw: unknown, isDev = false): Bounty | null {
    if (!isObj(raw)) return null;
    const title = str(raw.title);
    const slug = str(raw.slug);
    const deadline = str(raw.deadline);
    if (!title || !slug || !deadline || Number.isNaN(new Date(deadline).getTime())) return null;

    const kindRaw = str(raw.compensationType).toLowerCase();
    const rewardKind: RewardKind = kindRaw === "range" || kindRaw === "variable" ? kindRaw : "fixed";
    const sponsor = isObj(raw.sponsor) ? raw.sponsor : {};
    const count = isObj(raw._count) ? raw._count : {};

    return {
        id: str(raw.id) || slug,
        title,
        slug,
        url: `${SUPERTEAM_LISTING_URL}/${slug}`,
        type: str(raw.type).toLowerCase() || "bounty",
        deadline,
        rewardKind,
        rewardAmount: numOrNull(raw.rewardAmount),
        rewardMin: numOrNull(raw.minRewardAsk),
        rewardMax: numOrNull(raw.maxRewardAsk),
        token: str(raw.token).toUpperCase() || null,
        submissions: numOrNull(count.Submission) ?? 0,
        isDev,
        matchScore: computeMatchScore(title, []),
        sponsor: {
            name: str(sponsor.name) || "Sponsor",
            slug: str(sponsor.slug),
            logo: str(sponsor.logo) || null,
            isVerified: sponsor.isVerified === true,
        },
        source: "superteam",
    };
}

/** Abierto, con cierre futuro y no exclusivo de la membresía Pro. */
export function isOpenListing(raw: unknown, now: Date = new Date()): boolean {
    if (!isObj(raw)) return false;
    if (str(raw.status).toUpperCase() !== "OPEN") return false;
    if (raw.isPro === true) return false;
    const deadline = new Date(str(raw.deadline));
    return !Number.isNaN(deadline.getTime()) && deadline.getTime() > now.getTime();
}

function group(n: number): string {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "2.000 USDC" · "500–1.500 USDC" · "A convenir" */
export function formatReward(b: Pick<Bounty, "rewardKind" | "rewardAmount" | "rewardMin" | "rewardMax" | "token">): string {
    const token = b.token ? ` ${b.token}` : "";
    if (b.rewardKind === "range" && b.rewardMin != null && b.rewardMax != null) {
        return `${group(b.rewardMin)}–${group(b.rewardMax)}${token}`;
    }
    if (b.rewardKind === "fixed" && b.rewardAmount != null && b.rewardAmount > 0) {
        return `${group(b.rewardAmount)}${token}`;
    }
    return "A convenir";
}

/**
 * Valor para ordenar por recompensa: importe si es una stablecoin (el tope en
 * los rangos), -1 para otros tokens y recompensas a convenir (van al final).
 */
export function rewardSortValue(b: Pick<Bounty, "rewardKind" | "rewardAmount" | "rewardMax" | "token">): number {
    if (!b.token || !STABLECOINS.has(b.token)) return -1;
    const amount = b.rewardKind === "range" ? b.rewardMax : b.rewardKind === "fixed" ? b.rewardAmount : null;
    return amount != null && amount > 0 ? amount : -1;
}

/** "Cierra hoy" · "Cierra mañana" · "Cierra en 5 días"; urgente si faltan menos de 3 días. */
export function describeCountdown(deadline: string, now: Date = new Date()): { label: string; urgent: boolean } {
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return { label: "Sin fecha", urgent: false };
    if (d.getTime() <= now.getTime()) return { label: "Cerrado", urgent: false };

    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
    const label = days <= 0 ? "Cierra hoy" : days === 1 ? "Cierra mañana" : `Cierra en ${days} días`;
    return { label, urgent: days < URGENT_DAYS };
}
