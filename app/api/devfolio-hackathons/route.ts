import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface DevfolioHackathon {
  id: string;
  title: string;
  tagline: string;
  prizePool: number;
  tags: string[];
  deadline: string;
  startDate: string;
  url: string;
  isOnline: boolean;
  isOpen: boolean;
}

async function fetchDevfolioHackathons(page = 1, perPage = 50): Promise<DevfolioHackathon[]> {
  const res = await fetch(
    `https://api.devfolio.co/api/hackathons?is_open=true&page=${page}&per_page=${perPage}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 900 }, // cache 15 min
    }
  );

  if (!res.ok) throw new Error(`Devfolio API ${res.status}`);

  const json = await res.json();
  const items: any[] = json?.result ?? [];

  const now = Date.now();

  return items
    .filter((h: any) => {
      // Keep only hackathons that haven't ended yet
      const endsAt = h.ends_at ? new Date(h.ends_at).getTime() : Infinity;
      return endsAt > now;
    })
    .map((h: any) => ({
      id: h.uuid ?? h.slug ?? `devfolio-${Math.random()}`,
      title: h.name ?? "Hackathon",
      tagline: h.tagline ?? "",
      prizePool: Number(h.prize_pool ?? 0),
      tags: Array.isArray(h.themes)
        ? h.themes.map((t: any) => t.name ?? t)
        : [],
      deadline: h.ends_at ?? "",
      startDate: h.starts_at ?? "",
      url: h.slug ? `https://devfolio.co/hackathons/${h.slug}` : "https://devfolio.co/hackathons",
      isOnline: Boolean(h.is_online),
      isOpen: Boolean(h.is_registration_open ?? true),
    }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const perPage = Number(searchParams.get("per_page") ?? "20");

  try {
    const hackathons = await fetchDevfolioHackathons(page, perPage);
    return NextResponse.json({
      hackathons,
      source: "devfolio-api",
      count: hackathons.length,
    });
  } catch (err) {
    console.error("[devfolio-hackathons]", err);
    return NextResponse.json(
      { error: "Failed to fetch from Devfolio", hackathons: [], count: 0 },
      { status: 502 }
    );
  }
}
