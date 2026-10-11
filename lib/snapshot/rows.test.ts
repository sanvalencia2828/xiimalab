import { describe, expect, it } from "vitest";
import type { Bounty } from "@/lib/bounties/parse";
import type { AggregatedHackathon } from "@/lib/types";
import { bountyRow, hackathonRow, uniqueById } from "./rows";

const SEEN_AT = "2026-10-11T12:00:00.000Z";

const hackathon = (over: Partial<AggregatedHackathon> = {}): AggregatedHackathon =>
    ({
        id: "devpost-1",
        title: "AI Hack",
        prize_pool: 5000,
        prize_currency: "USD",
        tags: ["AI"],
        deadline: "2026-10-20",
        match_score: 80,
        source: "devpost",
        source_url: "https://devpost.com/h/1",
        missing_skills: [],
        project_highlight: "",
        scraped_at: SEEN_AT,
        ...over,
    }) as AggregatedHackathon;

const bounty = (over: Partial<Bounty> = {}): Bounty => ({
    id: "b1",
    title: "Build a bot",
    slug: "build-a-bot",
    url: "https://superteam.fun/earn/listing/build-a-bot",
    type: "bounty",
    deadline: "2026-10-13T18:00:00.000Z",
    rewardKind: "fixed",
    rewardAmount: 2000,
    rewardMin: null,
    rewardMax: null,
    token: "USDC",
    submissions: 0,
    isDev: true,
    matchScore: 30,
    sponsor: { name: "Sponsor", slug: "sponsor", logo: null, isVerified: false },
    source: "superteam",
    ...over,
});

describe("hackathonRow", () => {
    it("guarda un premio en USD como prize_usd", () => {
        expect(hackathonRow(hackathon(), SEEN_AT)).toEqual({
            id: "devpost-1",
            source: "devpost",
            title: "AI Hack",
            deadline: "2026-10-20",
            prize_usd: 5000,
            prize_amount: 5000,
            prize_currency: "USD",
            tags: ["AI"],
            url: "https://devpost.com/h/1",
            last_seen_at: SEEN_AT,
        });
    });

    it("deja prize_usd vacío en otra moneda, pero conserva el importe", () => {
        const row = hackathonRow(hackathon({ prize_pool: 100000, prize_currency: "INR" }), SEEN_AT);
        expect(row).toMatchObject({ prize_usd: null, prize_amount: 100000, prize_currency: "INR" });
    });

    it("no cuenta como USD un premio no verificado", () => {
        const row = hackathonRow(hackathon({ prize_pool: 8412771, prize_unverified: true }), SEEN_AT);
        expect(row.prize_usd).toBeNull();
    });

    it("sin premio ni fecha deja los campos vacíos", () => {
        const row = hackathonRow(hackathon({ prize_pool: 0, prize_currency: null, deadline: "" }), SEEN_AT);
        expect(row).toMatchObject({ prize_usd: null, prize_amount: null, prize_currency: null, deadline: null });
    });
});

describe("bountyRow", () => {
    it("cuenta una stablecoin como USD y etiqueta el tipo", () => {
        expect(bountyRow(bounty(), SEEN_AT)).toMatchObject({
            id: "b1",
            source: "superteam",
            prize_usd: 2000,
            prize_amount: 2000,
            prize_currency: "USDC",
            tags: ["bounty", "development"],
            deadline: "2026-10-13T18:00:00.000Z",
        });
    });

    it("no convierte otros tokens a USD", () => {
        expect(bountyRow(bounty({ token: "SOL", isDev: false }), SEEN_AT)).toMatchObject({
            prize_usd: null,
            prize_amount: 2000,
            prize_currency: "SOL",
            tags: ["bounty"],
        });
    });

    it("usa el tope del rango y deja vacía una recompensa variable", () => {
        expect(bountyRow(bounty({ rewardKind: "range", rewardAmount: null, rewardMin: 500, rewardMax: 1500 }), SEEN_AT).prize_usd).toBe(1500);
        expect(bountyRow(bounty({ rewardKind: "variable", rewardAmount: null }), SEEN_AT)).toMatchObject({
            prize_usd: null,
            prize_amount: null,
            prize_currency: null,
        });
    });
});

describe("uniqueById", () => {
    it("deja una fila por id", () => {
        const rows = [hackathonRow(hackathon(), SEEN_AT), hackathonRow(hackathon({ title: "Otra" }), SEEN_AT)];
        expect(uniqueById(rows)).toHaveLength(1);
        expect(uniqueById(rows)[0].title).toBe("Otra");
    });
});
