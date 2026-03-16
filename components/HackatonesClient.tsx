"use client";

/**
 * HackatonesClient.tsx — v2
 * ─────────────────────────────────────────────────────────────────
 * - Toggle vista: Grid de Cards  ↔  Tabla ordenable
 * - Tab "Devfolio" hace fetch en vivo al MCP (/api/hackathons/devfolio)
 * - SSE para hackatones nuevas desde el backend
 * - Filtros por fuente + búsqueda por texto
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Zap, Globe, Bot, Radio, RefreshCw, Trophy,
    LayoutGrid, Table2, Search, X,
} from "lucide-react";
import HackathonCard   from "./HackathonCard";
import HackatonesTable from "./HackatonesTable";
import type { ActiveHackathon } from "@/lib/supabase";

// ── Tipos ──────────────────────────────────────────────────────────
type Source   = "all" | "dorahacks" | "devfolio" | "devpost";
type ViewMode = "grid" | "table";

const TABS: { id: Source; label: string; icon: typeof Zap; color: string; mcpLive?: boolean }[] = [
    { id: "all",       label: "Todos",     icon: Zap,    color: "text-accent border-accent/40 bg-accent/10" },
    { id: "dorahacks", label: "DoraHacks", icon: Bot,    color: "text-purple-400 border-purple-400/40 bg-purple-400/10" },
    { id: "devfolio",  label: "Devfolio",  icon: Globe,  color: "text-sky-400 border-sky-400/40 bg-sky-400/10",  mcpLive: true },
    { id: "devpost",   label: "Devpost",   icon: Trophy, color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" },
];

// ── Normalizer ─────────────────────────────────────────────────────
function normalize(h: Record<string, unknown>): ActiveHackathon {
    return {
        id:           String(h.id          ?? ""),
        title:        String(h.title       ?? ""),
        prize_pool:   Number(h.prize_pool  ?? 0),
        tags:         Array.isArray(h.tags) ? h.tags as string[] : [],
        deadline:     String(h.deadline    ?? ""),
        match_score:  Number(h.match_score ?? 0),
        source_url:   (h.source_url as string | null) ?? null,
        source:       String(h.source      ?? "unknown"),
        last_seen_at: String(h.last_seen_at ?? ""),
    };
}

// ── Props ──────────────────────────────────────────────────────────
interface HackatonesClientProps {
    initialData: ActiveHackathon[];
}

// ══════════════════════════════════════════════════════════════════
export default function HackatonesClient({ initialData }: HackatonesClientProps) {
    const [activeTab,   setActiveTab]   = useState<Source>("all");
    const [viewMode,    setViewMode]    = useState<ViewMode>("table");
    const [all,         setAll]         = useState<ActiveHackathon[]>(initialData);
    const [devfolioData,setDevfolioData]= useState<ActiveHackathon[]>([]);
    const [devfolioErr, setDevfolioErr] = useState<string | null>(null);
    const [devfolioLoad,setDevfolioLoad]= useState(false);
    const [liveCount,   setLiveCount]   = useState(0);
    const [isLive,      setIsLive]      = useState(false);
    const [refreshing,  setRefreshing]  = useState(false);
    const [query,       setQuery]       = useState("");
    const esRef = useRef<EventSource | null>(null);

    // ── Devfolio MCP — carga al activar el tab ──────────────────
    const loadDevfolio = useCallback(async () => {
        setDevfolioLoad(true);
        setDevfolioErr(null);
        try {
            const res = await fetch("/api/hackathons/devfolio");
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `HTTP ${res.status}`);
            }
            const data: unknown[] = await res.json();
            if (!Array.isArray(data)) throw new Error("Respuesta inesperada del MCP");

            const normalized = data.map(h => normalize(h as Record<string, unknown>));
            setDevfolioData(normalized);

            // Fusionar en el listado global (sin duplicados)
            setAll(prev => {
                const ids = new Set(prev.map(h => h.id));
                const news = normalized.filter(h => !ids.has(h.id));
                return news.length ? [...news, ...prev] : prev;
            });
        } catch (err) {
            setDevfolioErr(err instanceof Error ? err.message : String(err));
        } finally {
            setDevfolioLoad(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === "devfolio" && !devfolioData.length && !devfolioLoad) {
            loadDevfolio();
        }
    }, [activeTab, devfolioData.length, devfolioLoad, loadDevfolio]);

    // ── Refresh (datos generales desde /api/hackathons) ─────────
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const res  = await fetch("/api/hackathons?limit=50");
            if (res.ok) {
                const data: unknown[] = await res.json();
                if (Array.isArray(data)) setAll(data.map(h => normalize(h as Record<string, unknown>)));
            }
        } catch { /* silencioso */ }
        finally {
            setRefreshing(false);
            if (activeTab === "devfolio") loadDevfolio();
        }
    };

    // ── SSE — hackatones en tiempo real ─────────────────────────
    useEffect(() => {
        esRef.current?.close();
        const es = new EventSource("/stream/hackathons");
        esRef.current = es;

        es.addEventListener("ping",      () => setIsLive(true));
        es.addEventListener("hackathon", (e) => {
            try {
                const h = normalize(JSON.parse((e as MessageEvent).data));
                setAll(prev => {
                    if (prev.some(x => x.id === h.id)) return prev;
                    setLiveCount(c => c + 1);
                    return [h, ...prev];
                });
            } catch { /* ignore malformed */ }
        });
        es.onerror = () => setIsLive(false);
        return () => { es.close(); setIsLive(false); };
    }, []);

    // ── Datos visibles según tab + búsqueda ─────────────────────
    const baseData: ActiveHackathon[] =
        activeTab === "devfolio" ? devfolioData :
        activeTab === "all"      ? all :
        all.filter(h => h.source === activeTab);

    const filtered = query.trim()
        ? baseData.filter(h =>
            h.title.toLowerCase().includes(query.toLowerCase()) ||
            (Array.isArray(h.tags) && h.tags.some(t => t.toLowerCase().includes(query.toLowerCase())))
          )
        : baseData;

    // ── Stagger para grid ────────────────────────────────────────
    const container = {
        hidden: {},
        show:   { transition: { staggerChildren: 0.04 } },
    };
    const item = {
        hidden: { opacity: 0, y: 10 },
        show:   { opacity: 1, y: 0, transition: { duration: 0.25 } },
    };

    return (
        <>
            {/* ── Barra de controles ─────────────────────────── */}
            <div className="flex flex-col gap-3 mb-6">

                {/* Fila 1: tabs + view toggle */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    {/* Tabs de fuente */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {TABS.map(tab => {
                            const Icon     = tab.icon;
                            const isActive = activeTab === tab.id;
                            const count    = tab.id === "all"      ? all.length
                                           : tab.id === "devfolio" ? devfolioData.length
                                           : all.filter(h => h.source === tab.id).length;
                            return (
                                <motion.button
                                    key={tab.id}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                        isActive
                                            ? tab.color
                                            : "text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-600"
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                    {tab.mcpLive && (
                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold">
                                            MCP
                                        </span>
                                    )}
                                    {count > 0 && (
                                        <span className="text-xs opacity-60">({count})</span>
                                    )}
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* Toggle vista + live + refresh */}
                    <div className="flex items-center gap-2">
                        {liveCount > 0 && (
                            <motion.span
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            >
                                +{liveCount} nueva{liveCount !== 1 ? "s" : ""}
                            </motion.span>
                        )}
                        <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
                            isLive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                   : "bg-slate-700/30 text-slate-500 border-slate-600/20"
                        }`}>
                            <Radio className={`w-3 h-3 ${isLive ? "animate-pulse" : ""}`} />
                            {isLive ? "En vivo" : "Offline"}
                        </span>

                        {/* Grid / Tabla toggle */}
                        <div className="flex items-center rounded-xl border border-slate-700/50 overflow-hidden">
                            {(["grid", "table"] as ViewMode[]).map(mode => {
                                const Icon = mode === "grid" ? LayoutGrid : Table2;
                                return (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all ${
                                            viewMode === mode
                                                ? "bg-accent/15 text-accent"
                                                : "text-slate-500 hover:text-slate-300"
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {mode === "grid" ? "Cards" : "Tabla"}
                                    </button>
                                );
                            })}
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleRefresh}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
                        >
                            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                            Actualizar
                        </motion.button>
                    </div>
                </div>

                {/* Fila 2: búsqueda */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar por título o tecnología..."
                        className="w-full bg-card border border-border rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Contenido: tabla o grid ────────────────────── */}
            <AnimatePresence mode="wait">
                {viewMode === "table" ? (
                    <motion.div
                        key={`table-${activeTab}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                    >
                        <HackatonesTable
                            data={filtered}
                            isLoading={activeTab === "devfolio" && devfolioLoad}
                            error={activeTab === "devfolio" ? devfolioErr : null}
                        />
                    </motion.div>
                ) : (
                    filtered.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="bg-card border border-border rounded-2xl p-12 text-center"
                        >
                            <Zap className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                            <p className="text-slate-400 text-sm">
                                {activeTab === "devfolio" && devfolioLoad
                                    ? "Consultando Devfolio MCP..."
                                    : "Sin resultados"}
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={`grid-${activeTab}`}
                            variants={container}
                            initial="hidden"
                            animate="show"
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                        >
                            {filtered.map(h => (
                                <motion.div key={h.id} variants={item}>
                                    <HackathonCard hackathon={h} />
                                </motion.div>
                            ))}
                        </motion.div>
                    )
                )}
            </AnimatePresence>
        </>
    );
}
