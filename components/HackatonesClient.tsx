"use client";

/**
 * HackatonesClient.tsx
 * ─────────────────────────────────────────────────────────
 * Wrapper Client para /hackatones.
 * Recibe `initialData` del Server Component (page.tsx),
 * añade filtros por fuente y SSE para tiempo real.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Globe, Bot, Radio, RefreshCw, Trophy } from "lucide-react";
import HackathonCard from "./HackathonCard";
import type { ActiveHackathon } from "@/lib/supabase";

type Source = "all" | "dorahacks" | "devfolio" | "devpost";

const TABS: { id: Source; label: string; icon: typeof Zap; color: string }[] = [
    { id: "all",       label: "Todos",     icon: Zap,    color: "text-accent border-accent/40 bg-accent/10" },
    { id: "dorahacks", label: "DoraHacks", icon: Bot,    color: "text-purple-400 border-purple-400/40 bg-purple-400/10" },
    { id: "devfolio",  label: "Devfolio",  icon: Globe,  color: "text-sky-400 border-sky-400/40 bg-sky-400/10" },
    { id: "devpost",   label: "Devpost",   icon: Trophy, color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" },
];

function normalize(h: any): ActiveHackathon {
    return {
        id:          h.id,
        title:       h.title,
        prize_pool:  h.prize_pool  ?? 0,
        tags:        Array.isArray(h.tags) ? h.tags : [],
        deadline:    h.deadline    ?? "",
        match_score: h.match_score ?? 0,
        source_url:  h.source_url  ?? null,
        source:      h.source      ?? "unknown",
        last_seen_at: h.last_seen_at ?? "",
    };
}

interface HackatonesClientProps {
    initialData: ActiveHackathon[];
}

export default function HackatonesClient({ initialData }: HackatonesClientProps) {
    const [activeTab, setActiveTab] = useState<Source>("all");
    const [all, setAll]             = useState<ActiveHackathon[]>(initialData);
    const [liveCount, setLiveCount] = useState(0);
    const [isLive, setIsLive]       = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const esRef = useRef<EventSource | null>(null);

    // ── Filtrado client-side (datos ya en memoria) ──────
    const filtered = activeTab === "all"
        ? all
        : all.filter((h) => h.source === activeTab);

    // ── Refresh desde /api/hackathons ───────────────────
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const res  = await fetch("/api/hackathons?limit=50");
            const data = await res.json();
            if (Array.isArray(data)) setAll(data.map(normalize));
        } catch {}
        finally { setRefreshing(false); }
    };

    // ── SSE — nuevas hackatones en tiempo real ──────────
    useEffect(() => {
        esRef.current?.close();
        const es = new EventSource("/stream/hackathons");
        esRef.current = es;

        es.addEventListener("ping", () => setIsLive(true));
        es.addEventListener("hackathon", (e) => {
            try {
                const h = normalize(JSON.parse(e.data));
                setAll((prev) => {
                    if (prev.some((x) => x.id === h.id)) return prev;
                    setLiveCount((c) => c + 1);
                    return [h, ...prev];
                });
            } catch {}
        });
        es.onerror = () => setIsLive(false);
        return () => { es.close(); setIsLive(false); };
    }, []);

    return (
        <>
            {/* Tabs + controles */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                <div className="flex items-center gap-2 flex-wrap">
                    {TABS.map((tab) => {
                        const Icon     = tab.icon;
                        const isActive = activeTab === tab.id;
                        const count    = tab.id === "all"
                            ? all.length
                            : all.filter((h) => h.source === tab.id).length;
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
                                {count > 0 && (
                                    <span className="text-xs opacity-70">({count})</span>
                                )}
                            </motion.button>
                        );
                    })}
                </div>

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
                        {isLive ? "En vivo" : "Conectando..."}
                    </span>
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

            {/* Grid de hackatones */}
            <AnimatePresence mode="wait">
                {filtered.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="bg-card border border-border rounded-2xl p-12 text-center"
                    >
                        <Zap className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                        <p className="text-slate-400 text-sm">Buscando nuevas oportunidades...</p>
                        <p className="text-slate-600 text-xs mt-1">
                            El SNAP Engine actualizará en los próximos minutos.
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                    >
                        {filtered.map((h) => (
                            <HackathonCard key={h.id} hackathon={h} />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
