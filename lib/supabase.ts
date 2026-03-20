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

const isValidUrl = supabaseUrl !== "" && !supabaseUrl.includes("<project-id>");

/**
 * Cliente Supabase — puede ser null si las env vars no están configuradas.
 * Siempre verificar: `if (supabase)` antes de usarlo.
 */
export const supabase = isValidUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// Re-export from central types — use Hackathon everywhere
export type { Hackathon as ActiveHackathon } from "@/lib/types";
export { normalizeHackathon } from "@/lib/types";
