"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getAgentsStatusAction, runAgentAction } from "@/app/actions/agents";
import { Activity, Play, RefreshCw, Zap, Server, BrainCircuit, Bot, Network } from "lucide-react";

interface AgentStatus {
    name: string;
    status: string;
    last_seen: string;
}

const AGENT_ENDPOINTS: Record<string, string> = {
    "Notifier Agent": "notifier/run",
    "Trend Forecaster Agent": "trend-forecaster/run",
    // Connector, Coach, etc requieren payloads específicos por ahora,
    // o se pueden integrar después si se les hace endpoints sin payload.
};

const AGENT_ICONS: Record<string, any> = {
    "Notifier Agent": Activity,
    "Trend Forecaster Agent": Zap,
    "Coach Agent": BrainCircuit,
    "Strategist Agent": Server,
    "Connector Agent": Network,
    "Aura Engagement Agent": Bot,
};

export default function AgentControlPanel() {
    const [agents, setAgents] = useState<AgentStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [runningAgents, setRunningAgents] = useState<Record<string, boolean>>({});
    const [runningOrchestrator, setRunningOrchestrator] = useState(false);

    const loadStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getAgentsStatusAction();
            if (data.error) throw new Error(data.error);
            setAgents(data.agents || []);
        } catch (err: any) {
            setError(err.message || "Failed to load agents status");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
        const interval = setInterval(loadStatus, 30000); // 30s auto refresh
        return () => clearInterval(interval);
    }, []);

    const handleRunAgent = async (name: string, endpoint: string) => {
        setRunningAgents((prev) => ({ ...prev, [name]: true }));
        try {
            const res = await runAgentAction(endpoint);
            if (res.error) throw new Error(res.error);
            alert(`${name} finalizó con éxito`);
            loadStatus(); // refresh list
        } catch (err: any) {
            alert(err.message || `Error ejecutando ${name}`);
        } finally {
            setRunningAgents((prev) => ({ ...prev, [name]: false }));
        }
    };

    const handleRunOrchestrator = async () => {
        setRunningOrchestrator(true);
        try {
            const res = await runAgentAction("orchestrator/coordinate");
            if (res.error) throw new Error(res.error);
            alert("Orchestration cycle completed");
            loadStatus();
        } catch (err: any) {
            alert(err.message || "Error al ejecutar orchestrator");
        } finally {
            setRunningOrchestrator(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BrainCircuit className="w-6 h-6 text-accent" />
                        Control de Agentes (Crew)
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Monitoriza y ejecuta manualmente los agentes del backend.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadStatus}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-700 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        Refrescar
                    </button>
                    <button
                        onClick={handleRunOrchestrator}
                        disabled={runningOrchestrator}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-black bg-accent rounded-xl hover:bg-emerald-400 transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${runningOrchestrator ? "animate-spin" : ""}`} />
                        {runningOrchestrator ? "Coordinando..." : "Orchestrator"}
                    </button>
                </div>
            </div>

            {/* Error state */}
            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading && agents.length === 0 ? (
                    // Skeletons
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse h-32" />
                    ))
                ) : (
                    agents.map((agent) => {
                        const Icon = AGENT_ICONS[agent.name] || Server;
                        const endpoint = AGENT_ENDPOINTS[agent.name];
                        const isRunning = runningAgents[agent.name];
                        const date = new Date(agent.last_seen).toLocaleString("es-ES");

                        return (
                            <motion.div
                                key={agent.name}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-5 rounded-2xl bg-card border border-border flex flex-col justify-between hover:border-accent/40 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-3">
                                        <div className="p-2.5 bg-slate-800 rounded-xl text-accent">
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-100">{agent.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`w-2 h-2 rounded-full ${agent.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                                                <span className="text-xs text-slate-400 capitalize">{agent.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                                    <div className="text-[10px] text-slate-500">
                                        Visto: {date}
                                    </div>
                                    {endpoint ? (
                                        <button
                                            onClick={() => handleRunAgent(agent.name, endpoint)}
                                            disabled={isRunning}
                                            className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50 border border-emerald-500/20"
                                        >
                                            {isRunning ? (
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Play className="w-3.5 h-3.5 fill-current" />
                                            )}
                                            {isRunning ? "Ejecutando" : "Ejecutar"}
                                        </button>
                                    ) : (
                                        <span className="text-[10px] text-slate-500 border border-slate-800 px-2 py-1 rounded-md bg-slate-800/50">
                                            Auto/Event-driven
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
