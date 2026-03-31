import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

// ── Primary: Devfolio REST API (no Docker needed) ───────────────────────────
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

// ── Fallback: Supabase (from /api/devfolio/sync) ───────────────────────────
async function fetchFromSupabase(): Promise<DevfolioHackathon[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("hackathons")
    .select("id, title, prize_pool, tags, deadline, source_url")
    .eq("source", "devfolio")
    .order("deadline", { ascending: true })
    .limit(50);

  if (error || !data || data.length === 0) return [];

  return data.map((h) => ({
    id: h.id,
    title: h.title,
    tagline: "",
    prizePool: h.prize_pool ?? 0,
    tags: Array.isArray(h.tags) ? h.tags : [],
    deadline: h.deadline ?? "",
    startDate: "",
    url: h.source_url ?? "https://devfolio.co",
    isOnline: true,
    isOpen: true,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const perPage = Number(searchParams.get("per_page") ?? "20");

  try {
    // Try Devfolio REST API first
    const hackathons = await fetchDevfolioHackathons(page, perPage);
    return NextResponse.json({
      hackathons,
      source: "devfolio-api",
      count: hackathons.length,
    });
  } catch (err) {
    console.error("[devfolio-hackathons] API failed, trying Supabase:", err);

    // Fallback to Supabase
    const cached = await fetchFromSupabase();
    if (cached.length > 0) {
      return NextResponse.json({
        hackathons: cached,
        source: "supabase-cache",
        count: cached.length,
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch from Devfolio", hackathons: [], count: 0 },
      { status: 502 }
    );
  }
}

