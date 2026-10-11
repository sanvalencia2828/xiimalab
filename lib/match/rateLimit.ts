/**
 * lib/match/rateLimit.ts — SERVER ONLY
 * Límite de ventana fija por clave, en memoria del proceso.
 *
 * En Vercel cada instancia serverless tiene su propio contador, así que el
 * límite es por instancia: frena el abuso desde un cliente, pero no es un tope
 * global exacto. Para eso hace falta un almacén compartido (Upstash, Vercel KV).
 */
interface Window {
    count: number;
    resetAt: number;
}

const windows = new Map<string, Window>();
const MAX_KEYS = 5000;

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterS: number;
}

export function consume(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
    const current = windows.get(key);
    if (!current || current.resetAt <= now) {
        if (windows.size >= MAX_KEYS) {
            windows.forEach((w, k) => {
                if (w.resetAt <= now) windows.delete(k);
            });
            if (windows.size >= MAX_KEYS) windows.clear();
        }
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterS: 0 };
    }
    if (current.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterS: Math.ceil((current.resetAt - now) / 1000) };
    }
    current.count += 1;
    return { allowed: true, remaining: limit - current.count, retryAfterS: 0 };
}
