/**
 * ClientOnly.tsx
 * ─────────────────────────────────────────────────────────
 * Wrapper que previene los errores de hidratación #418 y #423.
 *
 * Úsalo en cualquier componente que:
 *   - Lea localStorage / sessionStorage
 *   - Acceda a window.stellar o cualquier wallet provider
 *   - Muestre datos de Stellar Horizon (balances, escrows)
 *   - Formatee fechas dependientes del timezone del usuario
 *
 * Cómo funciona:
 *   El servidor renderiza `fallback` (normalmente un Skeleton).
 *   El cliente monta el children SOLO después del primer render,
 *   garantizando que server HTML === client HTML en el hydration pass.
 *
 * Uso:
 *   <ClientOnly fallback={<EscrowSkeleton />}>
 *     <EscrowPanel escrows={data} />
 *   </ClientOnly>
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";

interface ClientOnlyProps {
    children: ReactNode;
    fallback?: ReactNode;
}

export default function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <>{fallback}</>;
    return <>{children}</>;
}
