"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Coins } from "lucide-react";
import { type Bounty, rewardSortValue } from "@/lib/bounties/parse";
import { BountyCard } from "./BountyCard";

type SortBy = "deadline" | "reward" | "match";

interface BountiesClientProps {
    bounties: Bounty[];
    /** false si no se pudo consultar la categoría Development: el filtro Dev se oculta */
    devKnown: boolean;
}

const SORTS: { key: SortBy; label: string }[] = [
    { key: "deadline", label: "Cierre más próximo" },
    { key: "reward", label: "Mayor recompensa" },
    { key: "match", label: "Mejor match" },
];

const selectClass =
    "w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

export function BountiesClient({ bounties, devKnown }: BountiesClientProps) {
    const hasDev = devKnown && bounties.some((b) => b.isDev);
    const [onlyDev, setOnlyDev] = useState(hasDev);
    const [token, setToken] = useState("all");
    const [type, setType] = useState("all");
    const [sortBy, setSortBy] = useState<SortBy>("deadline");

    const tokens = useMemo(
        () => Array.from(new Set(bounties.map((b) => b.token).filter((t): t is string => Boolean(t)))).sort(),
        [bounties],
    );
    const types = useMemo(() => Array.from(new Set(bounties.map((b) => b.type))).sort(), [bounties]);

    const visible = useMemo(() => {
        const list = bounties.filter(
            (b) =>
                (!onlyDev || b.isDev) &&
                (token === "all" || b.token === token) &&
                (type === "all" || b.type === type),
        );
        return [...list].sort((a, b) => {
            if (sortBy === "reward") return rewardSortValue(b) - rewardSortValue(a) || a.deadline.localeCompare(b.deadline);
            if (sortBy === "match") return b.matchScore - a.matchScore || a.deadline.localeCompare(b.deadline);
            return a.deadline.localeCompare(b.deadline);
        });
    }, [bounties, onlyDev, token, type, sortBy]);

    const hasFilters = onlyDev || token !== "all" || type !== "all";
    const clearFilters = () => {
        setOnlyDev(false);
        setToken("all");
        setType("all");
    };

    // Sin datos: la fuente no devolvió nada (o falló)
    if (bounties.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card border border-border rounded-2xl text-center py-12 px-6"
            >
                <Coins className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-200 font-medium mb-2">No hay bounties abiertos ahora mismo</p>
                <p className="text-muted-text text-sm">
                    Superteam Earn no devolvió bounties abiertos. Vuelve a intentarlo en unos minutos.
                </p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                    {hasDev && (
                        <div>
                            <span className="block text-xs font-medium text-slate-400 mb-1.5">Categoría</span>
                            <button
                                type="button"
                                aria-pressed={onlyDev}
                                onClick={() => setOnlyDev((v) => !v)}
                                className={`w-full px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                    onlyDev
                                        ? "bg-accent/15 text-accent border-accent/40"
                                        : "bg-slate-800/50 text-slate-300 border-slate-700/50 hover:border-accent/50"
                                }`}
                            >
                                {onlyDev ? "Solo desarrollo" : "Todas las categorías"}
                            </button>
                        </div>
                    )}

                    <div>
                        <label htmlFor="bounty-token" className="block text-xs font-medium text-slate-400 mb-1.5">Token</label>
                        <select id="bounty-token" value={token} onChange={(e) => setToken(e.target.value)} className={selectClass}>
                            <option value="all">Todos</option>
                            {tokens.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    {types.length > 1 && (
                        <div>
                            <label htmlFor="bounty-type" className="block text-xs font-medium text-slate-400 mb-1.5">Tipo</label>
                            <select id="bounty-type" value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
                                <option value="all">Todos</option>
                                {types.map((t) => (
                                    <option key={t} value={t}>{t === "bounty" ? "Bounty" : t === "project" ? "Proyecto" : t}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label htmlFor="bounty-sort" className="block text-xs font-medium text-slate-400 mb-1.5">Ordenar por</label>
                        <select
                            id="bounty-sort"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortBy)}
                            className={selectClass}
                        >
                            {SORTS.map((s) => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Filtros sin resultados */}
            {visible.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-card border border-border rounded-2xl text-center py-12 px-6"
                >
                    <Coins className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-200 font-medium mb-2">Ningún bounty coincide con tus filtros</p>
                    <p className="text-muted-text text-sm">
                        Hay {bounties.length} {bounties.length === 1 ? "bounty abierto" : "bounties abiertos"} en total.
                    </p>
                    {hasFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-4 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30 hover:border-accent/50 transition-colors"
                        >
                            Limpiar filtros
                        </button>
                    )}
                </motion.div>
            )}

            {/* Lista */}
            {visible.length > 0 && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {visible.map((bounty, idx) => (
                            <BountyCard key={bounty.id} bounty={bounty} index={idx} />
                        ))}
                    </div>
                    <div className="text-center py-4 text-xs text-muted-text">
                        Mostrando {visible.length} de {bounties.length} bounties
                    </div>
                </>
            )}
        </div>
    );
}
