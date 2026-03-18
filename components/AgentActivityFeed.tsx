"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Zap, Brain, Search, Terminal, MessageSquare } from "lucide-react";

interface AgentSignal {
    id: number;
    source_agent: string;
    signal_type: string;
    payload: any;
    created_at: string;
}

export default function AgentActivityFeed() {
    const [signals, setSignals] = useState<AgentSignal[]>([]);

    useEffect(() => {
        // Simulate real-time polling or fetch initial signals
        // In a real production app, use Supabase Realtime here
        const fetchSignals = async () => {
            try {
                const response = await fetch("/api/agents/signals");
                const data = await response.json();
                setSignals(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error("Error fetching signals:", e);
            }
        };

        fetchSignals();
        const interval = setInterval(fetchSignals, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const getIcon = (source: string) => {
        switch (source.toLowerCase()) {
            case "scout": return <Search className="w-3 h-3 text-blue-400" />;
            case "strategist": return <Brain className="w-3 h-3 text-purple-400" />;
            case "coach": return <Zap className="w-3 h-3 text-amber-400" />;
            default: return <Activity className="w-3 h-3 text-slate-400" />;
        }
    };

    return (
        <div className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Agent Collaboration Feed</h3>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence initial={false}>
                    {signals.length === 0 ? (
                        <div className="text-[10px] text-slate-500 py-4 text-center">
                            Esperando señales de los agentes...
                        </div>
                    ) : (
                        signals.map((signal) => (
                            <motion.div
                                key={signal.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex gap-3 items-start"
                            >
                                <div className="mt-0.5 p-1.5 rounded-lg bg-black/40 border border-white/10">
                                    {getIcon(signal.source_agent)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[10px] font-bold text-slate-200 capitalize">
                                            {signal.source_agent} Agent
                                        </span>
                                        <span className="text-[8px] text-slate-500 uppercase">
                                            {new Date(signal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-tight">
                                        {signal.signal_type.replace(/_/g, " ")}: 
                                        {signal.payload?.hackathon_id || signal.payload?.topic || "Evento detectado"}
                                    </p>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
