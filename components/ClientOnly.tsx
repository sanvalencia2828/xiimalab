// components/ClientOnly.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders children ONLY on the client.
 * Use for: window, localStorage, Stellar wallet extensions (Freighter, Albedo).
 * Prevents React hydration errors #418 and #423.
 */
export default function ClientOnly({
    children,
    fallback = null,
}: {
    children: ReactNode;
    fallback?: ReactNode;
}) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    return mounted ? <>{children}</> : <>{fallback}</>;
}
