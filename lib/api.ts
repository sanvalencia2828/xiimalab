/**
 * lib/api.ts — Centralised API base URL helper
 *
 * Priority:
 *   1. NEXT_PUBLIC_API_URL (Vercel env var → points to live FastAPI if set)
 *   2. INTERNAL_API_URL   (server-only, e.g. Docker service name)
 *   3. null               → FastAPI unavailable, caller must use fallback
 */
export function getApiBase(): string | null {
    const external = process.env.NEXT_PUBLIC_API_URL;
    if (external && external !== "http://localhost:8000") return external;

    const internal = process.env.INTERNAL_API_URL;
    if (internal) return internal;

    return null; // FastAPI not available (Vercel without Docker)
}

/**
 * Safe fetch wrapper — returns null instead of throwing on connection errors.
 * Callers can then use fallback data.
 */
export async function safeFetch<T>(
    url: string,
    options?: RequestInit,
): Promise<T | null> {
    try {
        const res = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}
