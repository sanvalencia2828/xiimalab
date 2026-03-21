"use client";

import { useEffect, useState } from "react";
import { Radar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from "chart.js";
import { Loader2, Zap } from "lucide-react";
import { motion } from "framer-motion";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// Props que recibe el nivel del usuario (el backend da la demanda del mercado)
interface SkillRadarChartProps {
    userProfile: Record<string, number>;
}

export default function SkillRadarChart({ userProfile }: SkillRadarChartProps) {
    const [marketDemand, setMarketDemand] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const fetchDemand = async () => {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const res = await fetch(`${API_URL}/api/v1/market/live-demand`);
                if (res.ok) {
                    const data = await res.json();
                    setMarketDemand(data);
                } else {
                    setMarketDemand({"AI / LLM": 95, "Data Analytics": 85, "Web3 / DeFi": 70, "Rust": 60, "PostgreSQL": 80});
                }
            } catch (err) {
                console.warn("Backend offline, loading fallback radar dataset:", err);
                setMarketDemand({"AI / LLM": 95, "Data Analytics": 85, "Web3 / DeFi": 70, "Rust": 60, "PostgreSQL": 80});
            } finally {
                setLoading(false);
            }
        };
        fetchDemand();
    }, []);

    // Evitar hidratación mismatch (Chart.js no le gusta pintar en SSR estricto aveces)
    if (!isMounted) return null;

    if (loading) {
        return (
            <div className="w-full h-80 flex flex-col items-center justify-center bg-card/40 border border-white/5 rounded-3xl backdrop-blur-md">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                <p className="text-xs text-slate-400 animate-pulse">Analizando demanda del ecosistema...</p>
            </div>
        );
    }

    // Preparar Data para Chart.js
    // Mapeamos solo los skills (tags) que el usuario tiene definido o los top del mercado
    const allLabels = Array.from(new Set([...Object.keys(userProfile), ...Object.keys(marketDemand).slice(0, 5)])).slice(0, 6);
    
    const marketDataPoints = allLabels.map(label => marketDemand[label] || 0);
    const userDataPoints = allLabels.map(label => userProfile[label] || 0);

    const data = {
        labels: allLabels,
        datasets: [
            {
                label: "Demanda del Mercado",
                data: marketDataPoints,
                backgroundColor: "rgba(16, 185, 129, 0.2)", // Emerald-500 al 20%
                borderColor: "rgba(16, 185, 129, 0.8)",
                borderWidth: 2,
                pointBackgroundColor: "rgba(16, 185, 129, 1)",
                pointBorderColor: "#fff",
                pointHoverBackgroundColor: "#fff",
                pointHoverBorderColor: "rgba(16, 185, 129, 1)",
                fill: true,
            },
            {
                label: "Mi Nivel (Proof of Skill)",
                data: userDataPoints,
                backgroundColor: "rgba(167, 139, 250, 0.5)", // Purple-400 al 50% solido
                borderColor: "rgba(167, 139, 250, 1)",
                borderWidth: 2,
                pointBackgroundColor: "rgba(167, 139, 250, 1)",
                pointBorderColor: "#fff",
                pointHoverBackgroundColor: "#fff",
                pointHoverBorderColor: "rgba(167, 139, 250, 1)",
                fill: true,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: {
                    color: "rgba(255, 255, 255, 0.1)", // Líneas radiales oscuras
                },
                grid: {
                    color: "rgba(255, 255, 255, 0.05)", // Círculos oscuros
                },
                pointLabels: {
                    color: "#cbd5e1", // text-slate-300
                    font: {
                        family: "Inter, sans-serif",
                        size: 11,
                        weight: "bold" as const,
                    },
                },
                ticks: {
                    display: false, // Ocultar números 0-100 en el radar
                    min: 0,
                    max: 100,
                },
            },
        },
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: {
                    color: "#94a3b8", // text-slate-400
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        family: "monospace",
                        size: 11,
                    }
                },
            },
            tooltip: {
                backgroundColor: "rgba(15, 23, 42, 0.9)", // slate-900 translúcido
                titleColor: "#fff",
                bodyColor: "#cbd5e1",
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderWidth: 1,
                padding: 10,
                cornerRadius: 8,
            },
        },
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full min-h-[350px] bg-card/60 border border-white/5 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col"
        >
            {/* Ambient Background Glow for Radar */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />

            <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-inner">
                    <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                    <h3 className="text-sm font-bold tracking-widest uppercase text-slate-200">Competitividad Radical</h3>
                    <p className="text-xs text-slate-400">Demanda Real vs Proof of Skill</p>
                </div>
            </div>

            <div className="flex-1 relative z-10 w-full min-h-[250px] pb-4">
                <Radar data={data} options={options} />
            </div>
        </motion.div>
    );
}
