"use client";

/**
 * StakingClient.tsx — CLIENT COMPONENT
 * Maneja las interacciones dinámicas de la página de Staking.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Trophy, Coins, Target, CheckCircle2,
    Clock, ExternalLink, Loader2, AlertCircle,
} from "lucide-react";

// ── Tipos ────────────────────────────────────────────────
interface Escrow {
    id: string;
    amount: number;
    status: "active" | "released" | "refunded";
    milestone: string;
    created_at: string;
}

interface StakingData {
    total_staked: number;
    total_released: number;
    escrows: Escrow[];
    aura_images_count: number;
    aura_milestone: number;
}

interface StakingClientProps {
    initialData: StakingData | null;
    userId: string;
}

// ── Status badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: Escrow["status"] }) {
    const cfg = {
        active:   { label: "Activo",     cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
        released: { label: "Liberado",   cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
        refunded: { label: "Reembolsado",cls: "text-slate-400 border-slate-500/30 bg-slate-500/10" },
    }[status];
    return (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

// ── Main component ────────────────────────────────────────
export default function StakingClient({ initialData, userId }: StakingClientProps) {
    const [data, setData]       = useState<StakingData | null>(initialData);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    async function refresh() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/staking/status/${userId}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (err) {
            setError("No se pudo conectar con el servidor de staking.");
        } finally {
            setLoading(false);
        }
    }

    // Sin datos — estado vacío
    if (!data) {
        return (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <AlertCircle className="w-10 h-10 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400 font-medium mb-2">Sin datos de staking</p>
                <p className="text-slate-600 text-sm mb-6">
                    El backend de staking no está disponible — levanta los containers Docker.
                </p>
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={refresh}
                    disabled={loading}
                    className="flex items-center gap-2 mx-auto text-xs font-semibold px-4 py-2 rounded-xl border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                    Reintentar conexión
                </motion.button>
            </div>
        );
    }

    const auraProgress = Math.min(100, (data.aura_images_count / data.aura_milestone) * 100);

    return (
        <div className="space-y-6">
            {/* Error banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400"
                    >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: "Total Stakeado",  value: `${data.total_staked} XLM`,   icon: Coins,    color: "text-amber-400" },
                    { label: "Total Liberado",  value: `${data.total_released} XLM`,  icon: Trophy,   color: "text-emerald-400" },
                    { label: "Escrows Activos", value: data.escrows.filter(e => e.status === "active").length, icon: Target, color: "text-accent" },
                ].map(({ label, value, icon: Icon, color }) => (
                    <motion.div
                        key={label}
                        whileHover={{ y: -2 }}
                        className="bg-card border border-border rounded-2xl p-5"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Icon className={`w-4 h-4 ${color}`} />
                            <span className="text-xs text-slate-500 font-medium">{label}</span>
                        </div>
                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    </motion.div>
                ))}
            </div>

            {/* AURA progress */}
            <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Progreso AURA</h3>
                    <span className="text-xs text-slate-500">
                        {data.aura_images_count} / {data.aura_milestone} imágenes
                    </span>
                </div>
                <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-accent to-emerald-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${auraProgress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                </div>
                {auraProgress >= 100 && (
                    <p className="text-xs text-emerald-400 font-medium mt-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Milestone completado — listo para liberar staking
                    </p>
                )}
            </div>

            {/* Escrows list */}
            <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Escrows</h3>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={refresh}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        {loading
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Clock className="w-3.5 h-3.5" />
                        }
                        Actualizar
                    </motion.button>
                </div>

                {data.escrows.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-6">Sin escrows registrados</p>
                ) : (
                    <div className="space-y-3">
                        {data.escrows.map((escrow) => (
                            <div
                                key={escrow.id}
                                className="flex items-center justify-between p-4 bg-slate-800/40 rounded-xl border border-slate-700/40"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-accent/10">
                                        <Coins className="w-4 h-4 text-accent" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">{escrow.milestone}</p>
                                        <p className="text-xs text-slate-500">
                                            {new Date(escrow.created_at).toLocaleDateString("es")}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-amber-400">{escrow.amount} XLM</span>
                                    <StatusBadge status={escrow.status} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
// StakingClient verified 2026-03-19T10:48:43Z
