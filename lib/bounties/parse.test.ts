import { describe, expect, it } from "vitest";
import fixtures from "./__fixtures__/superteam-review.json";
import {
    describeCountdown,
    formatReward,
    isOpenListing,
    parseSuperteamListing,
    rewardSortValue,
} from "./parse";

// Muestras reales de GET /api/listings?status=review: una por tipo de compensación
const fixed = fixtures.find((f) => f.compensationType === "fixed")!;
const range = fixtures.find((f) => f.compensationType === "range")!;
const variable = fixtures.find((f) => f.compensationType === "variable")!;

describe("parseSuperteamListing", () => {
    it("maps a fixed listing", () => {
        const b = parseSuperteamListing(fixed, true)!;
        expect(b.title).toBe(fixed.title);
        expect(b.url).toBe(`https://superteam.fun/earn/listing/${fixed.slug}`);
        expect(b.rewardKind).toBe("fixed");
        expect(b.rewardAmount).toBe(530);
        expect(b.token).toBe("USDC");
        expect(b.submissions).toBe(fixed._count.Submission);
        expect(b.isDev).toBe(true);
        expect(b.source).toBe("superteam");
        expect(b.sponsor.name).toBe(fixed.sponsor.name);
    });

    it("keeps the listing type and a 0–100 match score", () => {
        const b = parseSuperteamListing(range)!;
        expect(b.type).toBe("project");
        expect(b.isDev).toBe(false);
        expect(b.matchScore).toBeGreaterThanOrEqual(0);
        expect(b.matchScore).toBeLessThanOrEqual(100);
    });

    it("rejects listings without title, slug or a valid deadline", () => {
        expect(parseSuperteamListing(null)).toBeNull();
        expect(parseSuperteamListing({ ...fixed, title: "" })).toBeNull();
        expect(parseSuperteamListing({ ...fixed, slug: undefined })).toBeNull();
        expect(parseSuperteamListing({ ...fixed, deadline: "not a date" })).toBeNull();
    });
});

describe("formatReward", () => {
    it("formats fixed, range and variable rewards", () => {
        expect(formatReward(parseSuperteamListing(fixed)!)).toBe("530 USDC");
        expect(formatReward(parseSuperteamListing(range)!)).toBe("400–800 USDC");
        expect(formatReward(parseSuperteamListing(variable)!)).toBe("A convenir");
    });

    it("groups thousands with a dot", () => {
        expect(formatReward(parseSuperteamListing({ ...fixed, rewardAmount: 2000 })!)).toBe("2.000 USDC");
        expect(formatReward(parseSuperteamListing({ ...range, minRewardAsk: 500, maxRewardAsk: 1500 })!)).toBe("500–1.500 USDC");
    });
});

describe("isOpenListing", () => {
    const before = new Date("2025-01-01T00:00:00Z");

    it("accepts an open, non-Pro listing with a future deadline", () => {
        expect(isOpenListing(fixed, before)).toBe(true);
    });

    it("rejects past deadlines, Pro listings and other statuses", () => {
        expect(isOpenListing(fixed, new Date("2030-01-01T00:00:00Z"))).toBe(false);
        expect(isOpenListing({ ...fixed, isPro: true }, before)).toBe(false);
        expect(isOpenListing({ ...fixed, status: "CLOSED" }, before)).toBe(false);
    });
});

describe("rewardSortValue", () => {
    it("ranks stablecoins by amount and uses the top of a range", () => {
        expect(rewardSortValue(parseSuperteamListing(fixed)!)).toBe(530);
        expect(rewardSortValue(parseSuperteamListing(range)!)).toBe(800);
    });

    it("sends other tokens and variable rewards to the end", () => {
        expect(rewardSortValue(parseSuperteamListing({ ...fixed, token: "SKR" })!)).toBe(-1);
        expect(rewardSortValue(parseSuperteamListing(variable)!)).toBe(-1);
    });
});

describe("describeCountdown", () => {
    const now = new Date(2026, 9, 10, 12, 0, 0);
    const at = (days: number, hour = 18) => new Date(2026, 9, 10 + days, hour, 0, 0).toISOString();

    it("labels today, tomorrow and later", () => {
        expect(describeCountdown(at(0), now)).toEqual({ label: "Cierra hoy", urgent: true });
        expect(describeCountdown(at(1), now)).toEqual({ label: "Cierra mañana", urgent: true });
        expect(describeCountdown(at(2), now)).toEqual({ label: "Cierra en 2 días", urgent: true });
        expect(describeCountdown(at(3), now)).toEqual({ label: "Cierra en 3 días", urgent: false });
    });

    it("labels closed listings", () => {
        expect(describeCountdown(at(0, 9), now)).toEqual({ label: "Cerrado", urgent: false });
    });
});
