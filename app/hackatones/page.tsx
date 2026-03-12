"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Globe, Bot, Radio, RefreshCw } from "lucide-react";
import DoraHacksFeed, { type Hackathon } from "@/components/DoraHacksFeed";

// ─────────────────────────────────────────────
// Tipos y constantes
// ─────────────────────────────────────────────
type Source = "all" | "dorahacks" | "devfolio";

const TABS: { id: Source; label: string; icon: typeof Zap; color: string }[] = [
    { id: "all",       label: "Todos",     icon: Zap,    color: "text-accent border-accent/40 bg-accent/10" },
    { id: "dorahacks", label: "DoraHacks", icon: Bot,    color: "text-purple-400 border-purple-400/40 bg-purple-400/10" },
    { id: "devfolio",  label: "Devfolio",  icon: Globe,  color: "text-sky-400 border-sky-400/40 bg-sky-400/10" },
];

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────
function HackathonSkeleton() {
    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-muted" />
                <div className="h-4 w-48 rounded bg-muted" />
            </div>
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="px-5 py-4 border-b border-border last:border-0">
                    <div className="h-4 w-3/4 rounded bg-muted mb-3" />
                    <div className="flex gap-3 mb-2">
                        <div className="h-3 w-24 rounded bg-muted" />
                        <div className="h-3 w-16 rounded bg-muted" />
                        <div className="h-3 w-20 rounded bg-muted ml-auto" />
                    </div>
                    <div className="flex gap-2">
                        <div className="h-5 w-16 rounded-md bg-muted" />
                        <div className="h-5 w-14 rounded-md bg-muted" />
                        <div className="h-5 w-12 rounded-md bg-muted" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────
// Normalizar hackathon (snake_case → camelCase)
// ─────────────────────────────────────────────
function normalize(h: any): Hackathon {
    return {
        id:         h.id,
        title:      h.title,
        prizePool:  h.prize_pool  ?? h.prizePool  ?? 0,
        tags:       Array.isArray(h.tags) ? h.tags : [],
        deadline:   h.deadline    ?? "",
        matchScore: h.match_score ?? h.matchScore ?? 0,
        source:     h.source,
    };
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function HackatonesPage() {
    const [activeTab, setActiveTab]       = useState<Source>("all");
    const [hackathons, setHackathons]     = useState<Hackathon[]>([]);
    const [loading, setLoading]           = useState(true);
    const [refreshing, setRefreshing]     = useState(false);
    const [liveCount, setLiveCount]       = useState(0);
    const [isLive, setIsLive]             = useState(false);
    const esRef = useRef<EventSource | null>(null);

    // ── Fetch al cambiar de tab ──────────────────
    useEffect(() => {
        setLoading(true);
        // Tab Devfolio → ruta directa al MCP (sin FastAPI)
        const url = activeTab === "devfolio"
            ? "/api/hackathons/devfolio"
            : activeTab === "all"
                ? "/api/hackathons"
                : `/api/hackathons?source=${activeTab}`;

        fetch(url)
            .then((r) => r.json())
            .then((data: any[]) => Array.isArray(data) ? setHackathons(data.map(normalize)) : null)
            .catch(() => {})
            .finally(() => { setLoading(false); setRefreshing(false); });
    }, [activeTab, refreshing]); // eslint-disable-line

    // ── SSE para tiempo real ─────────────────────
    useEffect(() => {
        // Cerrar conexión anterior si existe
        esRef.current?.close();

        const es = new EventSource("/stream/hackathons");
        esRef.current = es;

        es.addEventListener("ping", () => setIsLive(true));

        es.addEventListener("hackathon", (e) => {
            try {
                const newH = normalize(JSON.parse(e.data));
                // Solo agregar si coincide con el tab activo
                if (activeTab === "all" || newH.source === activeTab) {
                    setHackathons((prev) => {
                        if (prev.some((h) => h.id === newH.id)) return prev;
                        setLiveCount((c) => c + 1);
                        return [newH, ...prev];
                    });
                }
            } catch {}
        });

        es.onerror = () => setIsLive(false);

        return () => {
            es.close();
            setIsLive(false);
        };
    }, [activeTab]);

    const currentTab = TABS.find((t) => t.id === activeTab)!;

    return (
        <div className="p-6 min-h-screen">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-xs font-medium text-accent uppercase tracking-widest">
                        Intelligence Feed
                    </span>
                </div>

                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">
                            Hacka<span className="gradient-text">tones</span>
                        </h1>
                        <p className="text-slate-400 text-sm">
                            DoraHacks + Devfolio · Scrapers activos · Match con IA
                        </p>
                    </div>

                    {/* Live indicator + refresh */}
                    <div className="flex items-center gap-3">
                        {liveCount > 0 && (
                            <motion.span
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            >
                                +{liveCount} nueva{liveCount !== 1 ? "s" : ""} hoy
                            </motion.span>
                        )}
                        <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                            isLive
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-slate-700/30 text-slate-500 border-slate-600/20"
                        }`}>
                            <Radio className={`w-3 h-3 ${isLive ? "animate-pulse" : ""}`} />
                            {isLive ? "En vivo" : "Conectando..."}
                        </span>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setLoading(true); setRefreshing(true); }}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
                        >
                            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                            Actualizar
                        </motion.button>
                    </div>
                </div>
            </motion.div>

            {/* Source filter tabs */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-2 mb-6"
            >
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <motion.button
                            key={tab.id}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                isActive
                                    ? tab.color
                                    : "text-slate-500 border-slate-700/50 bg-transparent hover:text-slate-300 hover:border-slate-600"
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                            {isActive && hackathons.length > 0 && (
                                <span className="text-xs opacity-70">
                                    ({hackathons.length})
                                </span>
                            )}
                        </motion.button>
                    );
                })}
            </motion.div>

            {/* Feed */}
            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <HackathonSkeleton />
                    </motion.div>
                ) : hackathons.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="bg-card border border-border rounded-2xl p-12 text-center"
                    >
                        <currentTab.icon className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                        <p className="text-slate-400 text-sm">
                            No hay hackatones de{" "}
                            <span className="text-white font-medium">{currentTab.label}</span>{" "}
                            por ahora.
                        </p>
                        <p className="text-slate-600 text-xs mt-1">
                            El scraper actualizará en unos minutos.
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <DoraHacksFeed hackathons={hackathons} showSource />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
