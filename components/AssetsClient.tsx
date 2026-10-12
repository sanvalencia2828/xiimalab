"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CalendarClock, ExternalLink, Info } from "lucide-react";
import type { MarketAsset } from "@/lib/markets/backpack";
import { THEMES, type ThemeDemand, type ThemeKey } from "@/lib/markets/watchlist";
import {
    DEFAULT_RULES,
    STATUS_ORDER,
    evaluateAcquisition,
    money,
    parseAmount,
    parseRules,
    serializeRules,
    type AcquisitionRules,
    type AcquisitionStatus,
} from "@/lib/markets/acquisition";

export interface AssetRow extends MarketAsset {
    relevance: number;
}

interface Props {
    rows: AssetRow[];
    demand: ThemeDemand[];
    ok: boolean;
    fetchedAt: string | null;
}

type SortBy = "relevance" | "earnings" | "m1" | "status";

const STORAGE_KEY = "xiimalab.assets.rules.v2";

const STATUS_STYLE: Record<AcquisitionStatus, string> = {
    "en-zona": "bg-success/15 text-success border-success/30",
    "bajo-rango": "bg-accent/10 text-accent border-accent/25",
    "esperar-resultados": "bg-warning/15 text-warning border-warning/30",
    "sobre-rango": "bg-danger/10 text-danger border-danger/25",
    "sin-rango": "bg-slate-700/30 text-slate-400 border-slate-600/30",
    "no-operable": "bg-slate-700/30 text-slate-500 border-slate-600/30",
    "sin-datos": "bg-slate-800/40 text-slate-500 border-slate-700/40",
};

const STATUS_LABEL: Record<AcquisitionStatus, string> = {
    "en-zona": "En tu zona",
    "bajo-rango": "Bajo tu mínimo",
    "esperar-resultados": "Esperar resultados",
    "sobre-rango": "Sobre tu máximo",
    "sin-rango": "Sin rango",
    "no-operable": "No operable",
    "sin-datos": "Sin datos",
};

const selectClass =
    "px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

function pct(v: number | null): JSX.Element {
    if (v === null) return <span className="text-muted-text">—</span>;
    const cls = v > 0 ? "text-success" : v < 0 ? "text-danger" : "text-slate-400";
    return <span className={`font-mono ${cls}`}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

function usd(v: number | null): string {
    if (v === null) return "—";
    return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v >= 1000 ? 0 : 2 });
}

function shortDate(iso: string): string {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function AssetsClient({ rows, demand, ok, fetchedAt }: Props) {
    const [rules, setRules] = useState<AcquisitionRules>(DEFAULT_RULES);
    const [loaded, setLoaded] = useState(false);
    const [theme, setTheme] = useState<ThemeKey | "all">("all");
    const [status, setStatus] = useState<AcquisitionStatus | "all">("all");
    const [sortBy, setSortBy] = useState<SortBy>("relevance");

    // Reglas guardadas en este navegador
    useEffect(() => {
        try { setRules(parseRules(window.localStorage.getItem(STORAGE_KEY))); } catch { /* sin almacenamiento */ }
        setLoaded(true);
    }, []);
    useEffect(() => {
        if (!loaded) return;
        try { window.localStorage.setItem(STORAGE_KEY, serializeRules(rules)); } catch { /* sin almacenamiento */ }
    }, [rules, loaded]);

    // Edita un extremo del rango. Vaciar un campo borra el rango de ese activo;
    // si el mínimo queda por encima del máximo se intercambian.
    const setRange = (ticker: string, field: "min" | "max", value: string) => {
        const v = parseAmount(value);
        setRules((r) => {
            const ranges = { ...r.ranges };
            const cur = ranges[ticker];
            if (v === null) delete ranges[ticker];
            else if (!cur) ranges[ticker] = { min: v, max: v };
            else {
                const next = { ...cur, [field]: v };
                ranges[ticker] = next.min <= next.max ? next : { min: next.max, max: next.min };
            }
            return { ...r, ranges };
        });
    };

    const evaluated = useMemo(
        () => rows.map((row) => ({ row, acq: evaluateAcquisition(row, rules) })),
        [rows, rules],
    );

    const counts = useMemo(() => {
        const c: Record<AcquisitionStatus, number> = {
            "en-zona": 0, "bajo-rango": 0, "sobre-rango": 0, "esperar-resultados": 0, "sin-rango": 0, "no-operable": 0, "sin-datos": 0,
        };
        evaluated.forEach((e) => { c[e.acq.status]++; });
        return c;
    }, [evaluated]);

    const soonEarnings = evaluated.filter((e) => e.acq.daysToEarnings !== null && e.acq.daysToEarnings >= 0 && e.acq.daysToEarnings <= 14).length;

    const visible = useMemo(() => {
        const list = evaluated.filter(
            (e) => (theme === "all" || e.row.theme === theme) && (status === "all" || e.acq.status === status),
        );
        return [...list].sort((a, b) => {
            if (sortBy === "earnings") return (a.acq.daysToEarnings ?? 9999) - (b.acq.daysToEarnings ?? 9999);
            if (sortBy === "m1") return (a.row.changes.m1 ?? 0) - (b.row.changes.m1 ?? 0);
            if (sortBy === "status") {
                return STATUS_ORDER.indexOf(a.acq.status) - STATUS_ORDER.indexOf(b.acq.status) || b.row.relevance - a.row.relevance;
            }
            return b.row.relevance - a.row.relevance;
        });
    }, [evaluated, theme, status, sortBy]);

    if (!ok || rows.length === 0) {
        return (
            <div className="card-premium p-8 text-center">
                <AlertCircle className="w-6 h-6 text-warning mx-auto mb-3" />
                <p className="text-slate-200 font-medium mb-1">No se pudieron cargar los precios de Backpack</p>
                <p className="text-sm text-muted-text">Vuelve a intentarlo en unos minutos.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Importancia para Xiimalab: demanda de cada tema en las oportunidades abiertas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {THEMES.map((t) => {
                    const d = demand.find((x) => x.key === t.key);
                    const share = d && d.total > 0 ? Math.round((d.matches / d.total) * 100) : null;
                    return (
                        <motion.button
                            key={t.key}
                            type="button"
                            onClick={() => setTheme(theme === t.key ? "all" : t.key)}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className={`card-premium p-4 text-left transition-colors ${theme === t.key ? "ring-1 ring-accent/50" : ""}`}
                        >
                            <div className="flex items-baseline justify-between mb-1">
                                <span className="text-sm font-semibold text-white">{t.label}</span>
                                <span className="font-mono text-sm text-accent">{share === null ? "—" : `${share}%`}</span>
                            </div>
                            <p className="text-xs text-muted-text">
                                {d && d.total > 0
                                    ? `${d.matches} de ${d.total} hackatones y bounties abiertos lo mencionan`
                                    : "Sin datos de hackatones ahora"}
                            </p>
                            <div className="mt-2 h-1 rounded-full bg-muted/40 overflow-hidden">
                                <div className="h-full bg-accent rounded-full" style={{ width: `${Math.round((d?.score ?? 0) * 100)}%` }} />
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            {/* Reglas de adquisición */}
            <div className="card-premium p-4 flex flex-wrap items-end gap-4">
                <div>
                    <p className="text-xs uppercase tracking-widest text-muted-text mb-2">Tus reglas de adquisición</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                        <label className="flex items-center gap-2">
                            No adquirir si hay resultados en
                            <input
                                type="number"
                                min={0}
                                max={60}
                                value={rules.earningsWindowDays}
                                onChange={(e) => setRules((r) => ({ ...r, earningsWindowDays: Math.max(0, Math.min(60, Number(e.target.value) || 0)) }))}
                                className="w-16 px-2 py-1 bg-slate-800/50 border border-slate-700/50 rounded-md text-slate-200 font-mono text-sm"
                            />
                            días
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={rules.requireBackpack}
                                onChange={(e) => setRules((r) => ({ ...r, requireBackpack: e.target.checked }))}
                                className="accent-[#5ea5ff]"
                            />
                            Solo activos operables en Backpack
                        </label>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 ml-auto text-xs">
                    <span className="px-2.5 py-1 rounded-full border bg-success/15 text-success border-success/30">
                        {counts["en-zona"]} en tu zona
                    </span>
                    <span className="px-2.5 py-1 rounded-full border bg-accent/10 text-accent border-accent/25">
                        {counts["bajo-rango"]} bajo tu mínimo
                    </span>
                    <span className="px-2.5 py-1 rounded-full border bg-danger/10 text-danger border-danger/25">
                        {counts["sobre-rango"]} sobre tu máximo
                    </span>
                    <span className="px-2.5 py-1 rounded-full border bg-warning/15 text-warning border-warning/30">
                        {soonEarnings} con resultados en 14 días
                    </span>
                    <span className="px-2.5 py-1 rounded-full border bg-slate-700/30 text-slate-400 border-slate-600/30">
                        {counts["sin-rango"]} sin rango
                    </span>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
                <select className={selectClass} value={theme} onChange={(e) => setTheme(e.target.value as ThemeKey | "all")} aria-label="Tema">
                    <option value="all">Todos los temas</option>
                    {THEMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as AcquisitionStatus | "all")} aria-label="Estado">
                    <option value="all">Todos los estados</option>
                    {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]} ({counts[s]})</option>)}
                </select>
                <select className={selectClass} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} aria-label="Ordenar">
                    <option value="relevance">Más importantes para Xiimalab</option>
                    <option value="status">Estado de adquisición</option>
                    <option value="earnings">Próximos resultados</option>
                    <option value="m1">Mayor caída en 1 mes</option>
                </select>
                <span className="ml-auto text-xs text-muted-text">{visible.length} de {rows.length}</span>
            </div>

            {/* Tabla */}
            <div className="card-premium overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-muted-text border-b border-white/[0.06]">
                            <th className="px-4 py-3 font-medium">Activo</th>
                            <th className="px-3 py-3 font-medium">Importancia</th>
                            <th className="px-3 py-3 font-medium text-right">Precio</th>
                            <th className="px-3 py-3 font-medium text-right">1d</th>
                            <th className="px-3 py-3 font-medium text-right">1m</th>
                            <th className="px-3 py-3 font-medium text-right">Año</th>
                            <th className="px-3 py-3 font-medium">Próx. resultados</th>
                            <th className="px-3 py-3 font-medium">Tu rango (mín – máx)</th>
                            <th className="px-4 py-3 font-medium">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map(({ row, acq }) => (
                            <tr key={row.ticker} className="border-b border-white/[0.04] hover:bg-white/[0.02] align-top">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-semibold text-white">{row.ticker}</span>
                                        {(row.backpack.spot || row.backpack.perp) && (
                                            <a
                                                href={row.backpack.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded border border-accent/30 text-accent hover:bg-accent/10"
                                                title="Ver en Backpack"
                                            >
                                                {[row.backpack.spot && "Spot", row.backpack.perp && "Perp"].filter(Boolean).join(" · ")}
                                                <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 truncate max-w-[260px]" title={row.name}>{row.name}</p>
                                    <p className="text-xs text-muted-text max-w-[260px]">{row.why}</p>
                                </td>
                                <td className="px-3 py-3">
                                    <span className="font-mono text-slate-200">{row.relevance}</span>
                                    <div className="mt-1 h-1 w-16 rounded-full bg-muted/40 overflow-hidden">
                                        <div className="h-full bg-accent rounded-full" style={{ width: `${row.relevance}%` }} />
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-right font-mono text-slate-200">{usd(row.price)}</td>
                                <td className="px-3 py-3 text-right">{pct(row.changes.d1)}</td>
                                <td className="px-3 py-3 text-right">{pct(row.changes.m1)}</td>
                                <td className="px-3 py-3 text-right">{pct(row.changes.ytd)}</td>
                                <td className="px-3 py-3 text-xs">
                                    {row.earnings ? (
                                        <span className="flex items-center gap-1.5 text-slate-300">
                                            <CalendarClock className="w-3.5 h-3.5 text-muted-text" />
                                            {shortDate(row.earnings.date)}
                                            <span className="text-muted-text">
                                                · {acq.daysToEarnings === 0 ? "hoy" : `en ${acq.daysToEarnings} d`}
                                            </span>
                                        </span>
                                    ) : (
                                        <span className="text-muted-text">Sin fecha en 120 días</span>
                                    )}
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex items-center gap-1.5">
                                        {(["min", "max"] as const).map((field, k) => (
                                            <span key={field} className="flex items-center gap-1.5">
                                                {k === 1 && <span className="text-muted-text">–</span>}
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder={field === "min" ? "mín" : "máx"}
                                                    defaultValue={rules.ranges[row.ticker]?.[field] ?? ""}
                                                    key={`${row.ticker}-${field}-${loaded}-${rules.ranges[row.ticker]?.[field] ?? ""}`}
                                                    onBlur={(e) => setRange(row.ticker, field, e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                                    className="w-20 px-2 py-1 bg-slate-800/50 border border-slate-700/50 rounded-md text-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                                    aria-label={`${field === "min" ? "Mínimo" : "Máximo"} de ${row.ticker}`}
                                                />
                                            </span>
                                        ))}
                                    </div>
                                    {acq.positionPct !== null && rules.ranges[row.ticker] && (
                                        <div
                                            className="relative mt-2 h-1.5 w-[172px] rounded-full bg-muted/40"
                                            title={`${usd(row.price)} en tu rango ${money(rules.ranges[row.ticker].min)}–${money(rules.ranges[row.ticker].max)}`}
                                        >
                                            <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-success/25" />
                                            <div
                                                className={`absolute -top-[3px] h-3 w-1 rounded-sm ${acq.positionPct < 0 || acq.positionPct > 100 ? "bg-danger" : "bg-white"}`}
                                                style={{ left: `calc(${Math.min(100, Math.max(0, acq.positionPct))}% - 2px)` }}
                                            />
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLE[acq.status]}`}>
                                        {acq.label}
                                    </span>
                                    <p className="text-xs text-muted-text mt-1 max-w-[220px]">{acq.detail}</p>
                                </td>
                            </tr>
                        ))}
                        {visible.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-text">
                                    No hay activos con estos filtros.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-text">
                <Info className="w-3.5 h-3.5 mt-px shrink-0" />
                <span>
                    El estado solo compara el precio con tu rango (mínimo–máximo) y las reglas que tú defines; no es una recomendación
                    de inversión y Xiimalab no compra ni vende nada. Los rangos que edites se guardan en este navegador. Datos de Backpack Exchange
                    {fetchedAt ? `, actualizados ${new Date(fetchedAt).toLocaleString("es")}` : ""}.
                </span>
            </p>
        </div>
    );
}
