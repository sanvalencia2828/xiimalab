"use client";

import { Fragment, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, ChevronDown, ExternalLink, Info } from "lucide-react";
import { PROGRAM_KIND_LABELS, type Opportunity, type Program } from "@/lib/markets/ecosystems";
import type { LendMarket } from "@/lib/markets/lend";
import { formatRate, formatUsdCompact, formatUtilization } from "@/lib/markets/lendFormat";

export interface LendRow extends LendMarket {
    ecosystem: { name: string; programs: Program[]; note: string | null };
    hackathons: number;
    bounties: number;
    /** Las 3 de mayor premio, con la etiqueta de cierre ya calculada en el servidor */
    top: (Opportunity & { closing: string })[];
}

interface Props {
    rows: LendRow[];
    lendOk: boolean;
    opportunitiesOk: boolean;
    fetchedAt: string | null;
}

type SortBy = "lend" | "amount" | "opportunities";

const selectClass =
    "px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

const COLUMNS = 8;

function opportunityCount(r: LendRow): number {
    return r.hackathons + r.bounties;
}

function ProgramLinks({ programs }: { programs: Program[] }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {programs.map((p) => (
                <a
                    key={p.url}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded border border-accent/30 text-accent hover:bg-accent/10"
                    title={`${PROGRAM_KIND_LABELS[p.kind]} · ${p.label}`}
                >
                    {p.label}
                    <ExternalLink className="w-2.5 h-2.5" />
                </a>
            ))}
        </div>
    );
}

function Detail({ row }: { row: LendRow }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
                <p className="text-xs uppercase tracking-widest text-muted-text mb-2">Mejores oportunidades abiertas</p>
                {row.top.length === 0 ? (
                    <p className="text-sm text-muted-text">Ninguna hackatón ni bounty abierto menciona {row.ecosystem.name} ahora.</p>
                ) : (
                    <ul className="space-y-2">
                        {row.top.map((o) => (
                            <li key={`${o.kind}-${o.id}`} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-200 truncate" title={o.title}>{o.title}</p>
                                        <p className="text-xs text-muted-text">
                                            {o.kind === "hackathon" ? "Hackatón" : "Bounty"} · {o.platform} · {o.closing}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="font-mono text-sm text-success">{o.prizeLabel}</span>
                                        {o.url && (
                                            <a
                                                href={o.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-accent hover:text-accent/80"
                                                aria-label={`Abrir ${o.title}`}
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div>
                <p className="text-xs uppercase tracking-widest text-muted-text mb-2">Programas oficiales</p>
                {row.ecosystem.programs.length > 0 ? (
                    <ul className="space-y-1.5">
                        {row.ecosystem.programs.map((p) => (
                            <li key={p.url} className="text-sm">
                                <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent hover:underline">
                                    {p.label}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                                <span className="text-xs text-muted-text"> · {PROGRAM_KIND_LABELS[p.kind]}</span>
                            </li>
                        ))}
                    </ul>
                ) : null}
                {row.ecosystem.note && <p className="text-xs text-muted-text mt-2">{row.ecosystem.note}</p>}
            </div>
        </div>
    );
}

export function LendClient({ rows, lendOk, opportunitiesOk, fetchedAt }: Props) {
    const [onlyWithOpportunities, setOnlyWithOpportunities] = useState(false);
    const [sortBy, setSortBy] = useState<SortBy>("lend");
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

    const visible = useMemo(() => {
        const list = onlyWithOpportunities ? rows.filter((r) => opportunityCount(r) > 0) : rows;
        const key: Record<SortBy, (r: LendRow) => number> = {
            lend: (r) => r.lendApr,
            amount: (r) => r.lentUsd,
            opportunities: (r) => opportunityCount(r),
        };
        return [...list].sort((a, b) => key[sortBy](b) - key[sortBy](a) || b.lentUsd - a.lentUsd);
    }, [rows, onlyWithOpportunities, sortBy]);

    const toggle = (symbol: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(symbol)) next.delete(symbol);
            else next.add(symbol);
            return next;
        });

    if (!lendOk) {
        return (
            <div className="card-premium p-8 text-center">
                <AlertCircle className="w-6 h-6 text-warning mx-auto mb-2" />
                <p className="text-sm text-slate-300">Backpack Lend no responde ahora. Vuelve a intentarlo en unos minutos.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {!opportunitiesOk && (
                <p className="flex items-center gap-2 text-xs text-warning">
                    <AlertCircle className="w-3.5 h-3.5" />
                    No se pudieron cargar las hackatones ni los bounties: solo se muestran las tasas y los programas oficiales.
                </p>
            )}

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                        type="checkbox"
                        checked={onlyWithOpportunities}
                        onChange={(e) => setOnlyWithOpportunities(e.target.checked)}
                        className="accent-[#5ea5ff]"
                    />
                    Solo con oportunidades abiertas
                </label>
                <select className={selectClass} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} aria-label="Ordenar">
                    <option value="lend">Mayor APR de préstamo</option>
                    <option value="amount">Mayor monto prestado</option>
                    <option value="opportunities">Más oportunidades</option>
                </select>
                <span className="ml-auto text-xs text-muted-text">{visible.length} de {rows.length}</span>
            </div>

            {/* Tabla */}
            <div className="card-premium overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-muted-text border-b border-white/[0.06]">
                            <th className="px-4 py-3 font-medium">Activo</th>
                            <th className="px-3 py-3 font-medium">Ecosistema</th>
                            <th className="px-3 py-3 font-medium text-right">APR préstamo</th>
                            <th className="px-3 py-3 font-medium text-right">APR deuda</th>
                            <th className="px-3 py-3 font-medium">Uso</th>
                            <th className="px-3 py-3 font-medium text-right">Prestado</th>
                            <th className="px-3 py-3 font-medium text-right">Oportunidades</th>
                            <th className="px-4 py-3 font-medium">Programas oficiales</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((row) => {
                            const open = expanded.has(row.symbol);
                            const count = opportunityCount(row);
                            return (
                                <Fragment key={row.symbol}>
                                    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] align-top">
                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => toggle(row.symbol)}
                                                aria-expanded={open}
                                                aria-label={`${open ? "Ocultar" : "Ver"} oportunidades de ${row.symbol}`}
                                                className="flex items-center gap-2 text-left"
                                            >
                                                <ChevronDown className={`w-4 h-4 text-muted-text transition-transform ${open ? "rotate-180" : ""}`} />
                                                <span className="font-mono font-semibold text-white">{row.symbol}</span>
                                                {row.state === "RepayOnly" && (
                                                    <span className="text-2xs px-1.5 py-0.5 rounded border border-warning/30 text-warning">Solo devolución</span>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-3 py-3 text-slate-300">{row.ecosystem.name}</td>
                                        <td className="px-3 py-3 text-right font-mono text-success">{formatRate(row.lendApr)}</td>
                                        <td className="px-3 py-3 text-right font-mono text-slate-300">{formatRate(row.borrowApr)}</td>
                                        <td className="px-3 py-3">
                                            <span className="font-mono text-slate-200">{formatUtilization(row.utilization)}</span>
                                            <div className="mt-1 h-1 w-20 rounded-full bg-muted/40 overflow-hidden">
                                                <div
                                                    className="h-full bg-accent rounded-full"
                                                    style={{ width: `${Math.min(100, Math.max(0, row.utilization * 100))}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono text-slate-200" title={`${row.lentQuantity.toLocaleString("es-ES")} ${row.symbol}`}>
                                            {formatUsdCompact(row.lentUsd)}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className={`font-mono ${count > 0 ? "text-white" : "text-muted-text"}`}>{count}</span>
                                            {count > 0 && (
                                                <p className="text-xs text-muted-text">
                                                    {row.hackathons} hack. · {row.bounties} bount.
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.ecosystem.programs.length > 0 ? (
                                                <ProgramLinks programs={row.ecosystem.programs} />
                                            ) : (
                                                <span className="text-xs text-muted-text">{row.ecosystem.note ?? "—"}</span>
                                            )}
                                        </td>
                                    </tr>
                                    {open && (
                                        <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                                            <td colSpan={COLUMNS} className="px-4 py-4">
                                                <motion.div
                                                    initial={{ opacity: 0, y: -6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                                >
                                                    <Detail row={row} />
                                                </motion.div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                        {visible.length === 0 && (
                            <tr>
                                <td colSpan={COLUMNS} className="px-4 py-10 text-center text-sm text-muted-text">
                                    Ningún activo tiene oportunidades abiertas ahora.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-text">
                <Info className="w-3.5 h-3.5 mt-px shrink-0" />
                <span>
                    Tasas de Backpack Lend; no es una recomendación de inversión. Xiimalab no presta ni mueve fondos.
                    {fetchedAt ? ` Datos actualizados ${new Date(fetchedAt).toLocaleString("es")}.` : ""}
                </span>
            </p>
        </div>
    );
}
