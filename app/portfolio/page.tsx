"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
    Briefcase, Trophy, Brain, Sparkles, Download, 
    Copy, ExternalLink, ChevronRight, Loader2,
    Code, Award, TrendingUp, Target
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getPortfolio, getPortfolioMarkdown, PortfolioResponse } from "@/app/actions/portfolio";
import { useWallet } from "@/lib/WalletContext";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    technical: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    cognitive: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
    soft: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    general: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
};

export default function PortfolioPage() {
    const { publicKey } = useWallet();
    const [data, setData] = useState<PortfolioResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [markdown, setMarkdown] = useState<string>("");
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "skills" | "hackathons" | "export">("overview");

    const walletAddress = publicKey;

    useEffect(() => {
        if (walletAddress) {
            loadPortfolio();
        } else {
            setLoading(false);
        }
    }, [walletAddress]);

    const loadPortfolio = async () => {
        if (!walletAddress) return;
        
        setLoading(true);
        try {
            const [portfolioData, mdData] = await Promise.all([
                getPortfolio(walletAddress),
                getPortfolioMarkdown(walletAddress),
            ]);
            setData(portfolioData);
            setMarkdown(mdData.markdown);
        } catch (error) {
            console.error("Error loading portfolio:", error);
        } finally {
            setLoading(false);
        }
    };

    const copyMarkdown = () => {
        navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadMarkdown = () => {
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "xiimalab-profile.md";
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!walletAddress) {
        return (
            <div className="min-h-screen bg-background p-6 relative overflow-hidden flex items-center justify-center">
                {/* Glow Behind Image */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 blur-[120px] rounded-full pointer-events-none" />
                
                <div className="max-w-2xl mx-auto relative z-10 text-center">
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="py-12 px-8 bg-card/40 backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl"
                    >
                        <div className="relative w-48 h-48 mx-auto mb-6">
                            {/* Floating Animation */}
                            <motion.div
                                animate={{ y: [-10, 10, -10] }}
                                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                            >
                                <Image
                                    src="/assets/portfolio-empty.png"
                                    alt="Holographic Portfolio"
                                    fill
                                    className="object-contain drop-shadow-[0_0_30px_rgba(168,139,250,0.4)]"
                                    priority
                                />
                            </motion.div>
                        </div>
                        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-accent to-purple-400 mb-4 tracking-tight">
                            Digital Identity Vault
                        </h1>
                        <p className="text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
                            Inicializa tu portafolio encriptado Web3 y accede a tu historial de hackathons, certificaciones y tu perfil neurocognitivo.
                        </p>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link
                                href="/settings"
                                className="inline-flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-accent to-purple-600 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(168,139,250,0.5)] transition-all hover:shadow-[0_0_30px_rgba(168,139,250,0.7)]"
                            >
                                Conectar Wallet <Sparkles className="w-4 h-4" />
                            </Link>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Generando tu portafolio...</p>
                </div>
            </div>
        );
    }

    const portfolio = data?.portfolio;

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
                            <Briefcase className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Tu Portfolio</h1>
                            <p className="text-sm text-slate-500">
                                Generado el {new Date(portfolio?.generated_at || "").toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500 bg-white/5 px-3 py-1 rounded-full">
                            {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
                        </span>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <StatCard icon={Code} value={portfolio?.total_skills || 0} label="Skills" color="text-blue-400" />
                    <StatCard icon={Trophy} value={portfolio?.total_hackathons || 0} label="Hackathons" color="text-amber-400" />
                    <StatCard icon={Award} value={portfolio?.total_achievements || 0} label="Logros" color="text-purple-400" />
                    <StatCard icon={TrendingUp} value={`${portfolio?.market_position.percentile || 0}%`} label="Percentil" color="text-emerald-400" />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-border pb-2">
                    {[
                        { id: "overview", label: "Resumen", icon: Sparkles },
                        { id: "skills", label: "Skills", icon: Code },
                        { id: "hackathons", label: "Hackathons", icon: Trophy },
                        { id: "export", label: "Exportar", icon: Download },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? "bg-accent/20 text-accent"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === "overview" && portfolio && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Summary */}
                        <div className="bg-card border border-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-3">Resumen</h3>
                            <p className="text-slate-400">{portfolio.summary}</p>
                        </div>

                        {/* Cognitive Profile */}
                        {portfolio.cognitive_profile && (
                            <div className="bg-gradient-to-br from-purple-500/10 to-accent/5 border border-purple-500/20 rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Brain className="w-5 h-5 text-purple-400" />
                                    <h3 className="text-lg font-bold text-white">Perfil Neuropsicológico</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500">Estilo de aprendizaje</p>
                                        <p className="text-lg font-bold text-purple-400">{portfolio.cognitive_profile.learning_style}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Neuroplasticidad</p>
                                        <p className="text-lg font-bold text-accent">{Math.round(portfolio.cognitive_profile.neuroplasticity * 100)}%</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {portfolio.cognitive_profile.strengths.map((s) => (
                                        <span key={s} className="px-3 py-1 bg-purple-500/20 rounded-full text-xs text-purple-300">
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendations */}
                        {portfolio.recommendations.length > 0 && (
                            <div className="bg-card border border-border rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-white mb-3">Recomendaciones</h3>
                                <div className="space-y-2">
                                    {portfolio.recommendations.map((rec, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                                            <Target className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                            <span className="text-sm text-slate-300">{rec}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {activeTab === "skills" && portfolio && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                    >
                        {portfolio.skills.map((skill) => {
                            const colors = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.general;
                            return (
                                <div key={skill.name} className={`p-4 bg-card border ${colors.border} rounded-xl`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-bold ${colors.text}`}>{skill.name}</span>
                                            <span className={`px-2 py-0.5 ${colors.bg} rounded text-[10px] ${colors.text}`}>
                                                {skill.category}
                                            </span>
                                        </div>
                                        <span className={`text-sm font-bold ${colors.text}`}>{skill.level}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${skill.level}%` }}
                                            transition={{ duration: 0.5 }}
                                            className={`h-full ${colors.text.replace("text-", "bg-")}`}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </motion.div>
                )}

                {activeTab === "hackathons" && portfolio && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                    >
                        {portfolio.hackathons.length === 0 ? (
                            <div className="text-center py-12 bg-white/5 rounded-xl">
                                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400">No hay hackathons en tu historial</p>
                                <Link href="/hackathons" className="text-accent text-sm hover:underline">
                                    Explorar hackathons
                                </Link>
                            </div>
                        ) : (
                            portfolio.hackathons.map((h) => (
                                <div key={h.id} className="p-4 bg-card border border-border rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-white">{h.title}</h4>
                                            <p className="text-xs text-slate-500">{h.date} · {h.role}</p>
                                        </div>
                                        <span className="text-lg font-bold text-amber-400">${h.prize_pool}</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {h.skills_used.map((s) => (
                                            <span key={s} className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-slate-400">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </motion.div>
                )}

                {activeTab === "export" && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="bg-card border border-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Exportar como Markdown</h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Copia el contenido para tu README de GitHub o descárgalo.
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={copyMarkdown}
                                    className="flex items-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg transition-colors"
                                >
                                    <Copy className="w-4 h-4 text-accent" />
                                    <span className="text-sm font-medium text-accent">
                                        {copied ? "¡Copiado!" : "Copiar"}
                                    </span>
                                </button>
                                <button
                                    onClick={downloadMarkdown}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                                >
                                    <Download className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-medium text-slate-300">Descargar .md</span>
                                </button>
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Preview</h3>
                            <pre className="text-xs text-slate-400 whitespace-pre-wrap bg-slate-900/50 p-4 rounded-lg max-h-96 overflow-auto">
                                {markdown}
                            </pre>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, value, label, color }: { icon: any; value: string | number; label: string; color: string }) {
    return (
        <motion.div 
            whileHover={{ y: -4, scale: 1.02 }}
            className={`relative bg-card/60 backdrop-blur-md border border-white/5 rounded-2xl p-5 overflow-hidden shadow-lg group`}
        >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-0 group-hover:opacity-5 blur-2xl rounded-full transition-opacity" />
            
            <div className="flex items-center gap-3 mb-3 relative z-10">
                <div className={`p-2 rounded-xl bg-white/5 border border-white/10 ${color.replace('text', 'border')}/30`}>
                    <Icon className={`w-5 h-5 ${color} drop-shadow-[0_0_8px_currentColor]`} />
                </div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <p className={`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 relative z-10`}>
                {value}
            </p>
            
            <div className={`absolute bottom-0 left-0 h-1 w-full opacity-50 ${color.replace('text', 'bg')}`} />
        </motion.div>
    );
}
