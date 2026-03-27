/**
 * app/staking/page.tsx — SERVER COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de Staking y Proof of Skill
 *
 * Arquitectura:
 *   • Este archivo NO tiene "use client" — se ejecuta en el servidor.
 *   • Fetcha estado de staking desde la API en build/request time.
 *   • Pasa initialData a <StakingClient> que maneja interacciones dinámicas.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Suspense } from "react";
import { Trophy, Coins, Target, Calendar, ExternalLink, Database } from "lucide-react";
import StakingClient from "@/components/StakingClient";

// force-dynamic: evita problemas con fetch a localhost durante el build
export const dynamic = "force-dynamic";

// ── Fetch de datos de staking ────────────────────────────────────────
async function fetchStakingStatus(userId: string): Promise<any> {
  try {
    // Usar la API interna (proxy al FastAPI)
    const base = ""; // use relative routes
    const res = await fetch(`${base}/api/staking/status/${userId}`, {
      next: { revalidate: 60 }, // Revalidar cada minuto
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn("[staking/page] Error fetching staking status:", err);
  }

  // Sin datos — el cliente mostrará mensaje de conexión
  return null;
}

// ── Componente de carga inline para el Suspense ─────────
function StakingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Resumen de staking skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
            <div className="h-4 w-24 rounded bg-muted mb-3" />
            <div className="h-6 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Progreso skeleton */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="h-5 w-40 rounded bg-muted mb-4" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-32 rounded bg-muted mb-2" />
                <div className="h-2 w-full rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Escrows skeleton */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="h-5 w-32 rounded bg-muted mb-4" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-muted/10 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-muted" />
                <div>
                  <div className="h-4 w-24 rounded bg-muted mb-1" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
              </div>
              <div className="h-6 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────
export default async function StakingPage() {
  // En servidor, obtenemos el userId de alguna forma (por ahora placeholder)
  // En realidad se obtendría del contexto de autenticación o cookies
  const userId = "user@example.com"; // Placeholder - en realidad vendría del contexto

  const initialData = await fetchStakingStatus(userId);

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-xs font-medium text-accent uppercase tracking-widest">
            Proof of Skill
          </span>
        </div>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              Staking <span className="gradient-text">Educacional</span>
            </h1>
            <p className="text-slate-400 text-sm">
              Libera tus recompensas al completar hitos educacionales
            </p>
          </div>

          {/* Indicador de estado */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              <Database className="w-3.5 h-3.5" />
              {initialData?.escrows?.length || 0} escrows activos
            </span>
            <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Trophy className="w-3.5 h-3.5" />
              Proof of Skill
            </span>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <Suspense fallback={<StakingSkeleton />}>
        <StakingClient initialData={initialData} userId={userId} />
      </Suspense>
    </div>
  );
}