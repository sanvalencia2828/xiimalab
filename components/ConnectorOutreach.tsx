"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateNetworkingStrategyAction } from "@/app/actions/agents";
import { Network, Sparkles, Copy, CheckCircle2, MessageSquare, Loader2, Users } from "lucide-react";

interface ConnectorOutreachProps {
    hackathonTitle: string;
    matchScore: number;
    techStack: string[];
}

export function ConnectorOutreach({ hackathonTitle, matchScore, techStack }: ConnectorOutreachProps) {
    const [strategy, setStrategy] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const res = await generateNetworkingStrategyAction(hackathonTitle, matchScore, techStack);
            if (!res.error) {
                setStrategy(res);
            } else {
                alert(res.error);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = async (text: string, key: string) => {
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="mt-6 p-4 bg-slate-800/20 border border-slate-700/50 rounded-2xl w-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
                        <Network className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-200">AI Connector & XMTP</h4>
                        <p className="text-[10px] text-slate-400">Red descentralizada de reclutamiento y comunidad</p>
                    </div>
                </div>
                {!strategy && (
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-3 py-1.5 flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {isGenerating ? "Buscando Contactos..." : "Generar Estrategia de Outreach"}
                    </button>
                )}
            </div>

            <AnimatePresence>
                {strategy && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-4 pt-3 border-t border-slate-700/50"
                    >
                        {/* Drafts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl relative group">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                    <MessageSquare className="w-3 h-3 text-sky-400" /> Warm Intro (Para Team)
                                </span>
                                <p className="text-[11px] text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">{strategy.warm_intro}</p>
                                <button 
                                    onClick={() => copyToClipboard(strategy.warm_intro, 'intro')}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-opacity opacity-0 group-hover:opacity-100"
                                >
                                    {copied === 'intro' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                            
                            <div className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl relative group">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                    <MessageSquare className="w-3 h-3 text-purple-400" /> Pitch Técnico (Jueces/Sponsors)
                                </span>
                                <p className="text-[11px] text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">{strategy.technical_outreach}</p>
                                <button 
                                    onClick={() => copyToClipboard(strategy.technical_outreach, 'pitch')}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-opacity opacity-0 group-hover:opacity-100"
                                >
                                    {copied === 'pitch' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>

                        {/* Communities */}
                        {strategy.target_communities && strategy.target_communities.length > 0 && (
                            <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                    <Users className="w-3 h-3" /> Comunidades Clave Detectadas
                                </span>
                                <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
                                    {strategy.target_communities.map((comm: string, idx: number) => (
                                        <li key={idx}>{comm}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <p className="text-[10px] italic text-slate-500 mt-2">
                            Strategy Note: {strategy.xmtp_strategy}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
