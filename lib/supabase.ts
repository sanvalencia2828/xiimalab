/**
 * lib/supabase.ts
 * ─────────────────────────────────────────────────────────
 * Cliente Supabase — funciona en Server Components y Client Components.
 *
 * Variables de entorno requeridas (.env):
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *
 * Para obtenerlas:
 *   Supabase Dashboard → Settings → API → Project URL + anon/public key
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Cliente Supabase — puede ser null si las env vars no están configuradas.
 * Siempre verificar: `if (supabase)` antes de usarlo.
 */
export const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export type ActiveHackathon = {
    id:           string;
    title:        string;
    prize_pool:   number;
    tags:         string[];
    deadline:     string;
    match_score:  number;
    source_url:   string | null;
    source:       string;
    last_seen_at: string;
};
