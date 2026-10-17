import { describe, expect, it } from "vitest";
import type { Bounty } from "@/lib/bounties/parse";
import type { AggregatedHackathon } from "@/lib/types";
import {
    ECOSYSTEMS,
    ecosystemFor,
    fromBounty,
    fromHackathon,
    keywordMatches,
    matchOpportunities,
    summarizeOpportunities,
    type Ecosystem,
    type Opportunity,
} from "./ecosystems";

const opp = (over: Partial<Opportunity> = {}): Opportunity => ({
    kind: "hackathon",
    id: over.title ?? "x",
    title: "Generic Hackathon",
    platform: "Devpost",
    tags: [],
    organizer: null,
    prizeUsd: null,
    prizeLabel: "No especificado",
    deadline: "2026-11-30",
    url: null,
    superteam: false,
    ...over,
});

const hackathon = (over: Partial<AggregatedHackathon> = {}): AggregatedHackathon =>
    ({
        id: "devpost-1",
        title: "SUI Overflow",
        prize_pool: 50000,
        prize_currency: "USD",
        tags: ["Move"],
        deadline: "2026-11-20",
        match_score: 70,
        source: "devpost",
        source_url: "https://devpost.com/h/1",
        missing_skills: [],
        project_highlight: "",
        ...over,
    }) as AggregatedHackathon;

const bounty = (over: Partial<Bounty> = {}): Bounty => ({
    id: "b1",
    title: "Write a thread about our wallet",
    slug: "thread",
    url: "https://superteam.fun/earn/listing/thread",
    type: "bounty",
    deadline: "2026-11-01T18:00:00.000Z",
    rewardKind: "fixed",
    rewardAmount: 500,
    rewardMin: null,
    rewardMax: null,
    token: "USDC",
    submissions: 0,
    isDev: false,
    matchScore: 10,
    sponsor: { name: "Acme", slug: "acme", logo: null, isVerified: false },
    source: "superteam",
    ...over,
});

describe("keywordMatches", () => {
    it("las palabras cortas solo como palabra completa: «Maintain» no coincide con «ai»", () => {
        expect(keywordMatches("Maintain the docs", "ai")).toBe(false);
        expect(keywordMatches("AI agents week", "ai")).toBe(true);
        expect(keywordMatches("Build with AI/ML", "ai")).toBe(true);
    });

    it("eth, sei y sol no coinciden dentro de otras palabras", () => {
        expect(keywordMatches("Methods of payment", "eth")).toBe(false);
        expect(keywordMatches("Seismic hack", "sei")).toBe(false);
        expect(keywordMatches("Solidity basics", "sol")).toBe(false);
        expect(keywordMatches("ETH Online 2026", "eth")).toBe(true);
    });

    it("las largas como subcadena y sin distinguir mayúsculas", () => {
        expect(keywordMatches("SolanaFM explorer", "solana")).toBe(true);
        expect(keywordMatches("BNB Chain Hack", "bnb chain")).toBe(true);
    });
});

describe("matchOpportunities", () => {
    it("«SUI Overflow» coincide con Sui", () => {
        const items = [fromHackathon(hackathon()), opp({ title: "Maintain an AI tool" })];
        expect(matchOpportunities(items, ECOSYSTEMS.SUI).map((o) => o.title)).toEqual(["SUI Overflow"]);
    });

    it("busca en título, tags y organizador", () => {
        const items = [
            opp({ title: "A", tags: ["Ethereum"] }),
            opp({ title: "B", organizer: "ETHGlobal" }),
            opp({ title: "C" }),
        ];
        expect(matchOpportunities(items, ECOSYSTEMS.ETH).map((o) => o.title)).toEqual(["A", "B"]);
    });

    it("todos los bounties de Superteam cuentan para Solana, aunque no la nombren", () => {
        const items = [fromBounty(bounty()), opp({ title: "Generic" })];
        const matched = matchOpportunities(items, ECOSYSTEMS.SOL);
        expect(matched).toHaveLength(1);
        expect(matched[0].platform).toBe("Superteam");
        // …y no cuentan para otros ecosistemas si no los nombran
        expect(matchOpportunities(items, ECOSYSTEMS.ETH)).toHaveLength(0);
    });

    it("un ecosistema sin keywords (PAXG) no encuentra nada", () => {
        expect(matchOpportunities([opp({ title: "PAX Gold hack" })], ECOSYSTEMS.PAXG)).toEqual([]);
    });

    it("una keyword corta respeta la palabra completa", () => {
        const eco: Ecosystem = { name: "Test", keywords: ["ai"], programs: [] };
        const titles = matchOpportunities([opp({ title: "Maintain" }), opp({ title: "AI week" })], eco).map((o) => o.title);
        expect(titles).toEqual(["AI week"]);
    });
});

describe("summarizeOpportunities", () => {
    it("cuenta hackatones y bounties y devuelve las 3 de mayor premio (sin premio comparable, al final)", () => {
        const s = summarizeOpportunities([
            opp({ title: "sin premio", prizeUsd: null }),
            opp({ title: "10k", prizeUsd: 10_000 }),
            opp({ title: "bounty 500", kind: "bounty", prizeUsd: 500 }),
            opp({ title: "50k", prizeUsd: 50_000 }),
        ]);
        expect(s.hackathons).toBe(3);
        expect(s.bounties).toBe(1);
        expect(s.top.map((o) => o.title)).toEqual(["50k", "10k", "bounty 500"]);
    });

    it("con el mismo premio, primero la que cierra antes", () => {
        const s = summarizeOpportunities([
            opp({ title: "tarde", prizeUsd: 1000, deadline: "2026-12-01" }),
            opp({ title: "pronto", prizeUsd: 1000, deadline: "2026-11-01" }),
        ]);
        expect(s.top.map((o) => o.title)).toEqual(["pronto", "tarde"]);
    });
});

describe("conversores", () => {
    it("hackatón: premio en USD solo si es comparable", () => {
        expect(fromHackathon(hackathon()).prizeUsd).toBe(50000);
        expect(fromHackathon(hackathon()).platform).toBe("Devpost");
        expect(fromHackathon(hackathon({ prize_currency: "EUR" })).prizeUsd).toBeNull();
        expect(fromHackathon(hackathon({ prize_unverified: true })).prizeUsd).toBeNull();
    });

    it("bounty: premio en USD solo en stablecoin", () => {
        expect(fromBounty(bounty()).prizeUsd).toBe(500);
        expect(fromBounty(bounty({ token: "SOL" })).prizeUsd).toBeNull();
    });

    it("símbolo desconocido → ecosistema vacío", () => {
        expect(ecosystemFor("FOO")).toEqual({ name: "FOO", keywords: [], programs: [] });
    });
});
