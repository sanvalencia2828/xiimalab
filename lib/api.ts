import { NextResponse } from "next/server";

/**
 * lib/api.ts — Centralised API base URL helper + standard response patterns
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
 * Standard API Response Format — ensures consistency across all endpoints
 * 
 * Usage:
 *   - Success: apiResponse(data, 200)
 *   - Error: apiResponse(null, 400, "User-friendly message", "Optional details")
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;        // User-friendly error message
    details?: string;      // Internal details (dev mode only)
}

export function apiResponse<T>(
    data: T | null,
    statusCode: number = 200,
    errorMessage?: string,
    details?: string,
): NextResponse<ApiResponse<T>> {
    const isSuccess = statusCode >= 200 && statusCode < 300;
    
    const response: ApiResponse<T> = {
        success: isSuccess,
        ...(isSuccess && data !== null && { data }),
        ...(!isSuccess && errorMessage && { error: errorMessage }),
        ...(process.env.NODE_ENV === "development" && details && { details }),
    };

    return NextResponse.json(response, { status: statusCode });
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
