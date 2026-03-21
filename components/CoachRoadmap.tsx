"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight, Trophy, Zap, Clock, Info, FileText, Copy, Sparkles, Loader2, Flame } from "lucide-react";
import { useWallet } from "@/lib/WalletContext";
import { acceptRoadmapChallengeAction } from "@/app/actions/roadmap";
import { generateProjectAssetsAction } from "@/app/actions/agents";
import { generateAuraEngagementKitAction, submitToAuraEngagementPoolAction } from "@/app/actions/aura";

interface RoadmapStep {
    title: string;
    description: string;
    priority: "high" | "medium";
}

interface RoadmapData {
    steps: RoadmapStep[];
    estimated_effort: string;
    coach_tip: string;
}

interface CoachRoadmapProps {
    hackathonId: string;
    roadmap: RoadmapData;
    hackathonTitle?: string;
    tags?: string[];
    onChallengeAccepted?: (stepIndex: number) => void;
}

export default function CoachRoadmap({ hackathonId, roadmap, hackathonTitle = "Hackathon", tags = ["AI", "Web3"], onChallengeAccepted }: CoachRoadmapProps) {
    const [acceptedSteps, setAcceptedSteps] = useState<number[]>([]);
    const { studentAddress } = useWallet();
    const [assets, setAssets] = useState<{readme: string, elevator_pitch: string} | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [auraKit, setAuraKit] = useState<{x_post: string, linkedin_post: string, discord_message: string} | null>(null);
    const [isGeneratingAura, setIsGeneratingAura] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState<"x" | "linkedin" | "discord">("x");

    const toggleStep = async (idx: number) => {
        if (acceptedSteps.includes(idx)) return;
        
        // Record achievement via Server Action
        if (studentAddress) {
            await acceptRoadmapChallengeAction(
                studentAddress, 
                hackathonId, 
                idx, 
                roadmap.steps[idx].title
            );
        }

        setAcceptedSteps([...acceptedSteps, idx]);
        onChallengeAccepted?.(idx);
    };

    const handleGenerateAssets = async () => {
        setIsGenerating(true);
        try {
            const res = await generateProjectAssetsAction(
                roadmap.coach_tip.split('"')[1] || "Hackathon Project", 
                roadmap,
                "Un proyecto innovador basado en el roadmap del coach."
            );
            if (res && !res.error && typeof res.readme === "string") {
                setAssets(res as { readme: string; elevator_pitch: string });
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateAuraKit = async () => {
        const projectTitle = roadmap.steps[0]?.title || hackathonTitle;
        setIsGeneratingAura(true);
        try {
            const res = await generateAuraEngagementKitAction(
                projectTitle, 
                hackathonTitle,
                `Un proyecto innovador para ${hackathonTitle} que escala el impacto mediante inteligencia artificial coordinada.`,
                tags
            );
            if (res && !res.error) {
                setAuraKit(res);
            }
        } finally {
            setIsGeneratingAura(false);
        }
    };

    const handleBoost = async () => {
        if (!auraKit || !studentAddress) return;
        const content = selectedPlatform === "x" ? auraKit.x_post : selectedPlatform === "linkedin" ? auraKit.linkedin_post : auraKit.discord_message;
        await submitToAuraEngagementPoolAction(studentAddress, content, selectedPlatform);
        setCopied("boosted");
        setTimeout(() => setCopied(null), 3000);
    };

    const copyToClipboard = async (text: string, key: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const progress = (acceptedSteps.length / roadmap.steps.length) * 100;

    return (
        <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">AI Coach Vision</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    {roadmap.estimated_effort}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                />
            </div>

            <div className="space-y-3">
                {roadmap.steps.map((step, idx) => {
                    const isAccepted = acceptedSteps.includes(idx);
                    return (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`p-3 rounded-xl border transition-all duration-300 ${
                                isAccepted 
                                ? "bg-emerald-500/10 border-emerald-500/30" 
                                : "bg-white/5 border-white/10"
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center border ${
                                    isAccepted 
                                    ? "bg-emerald-500 border-emerald-500" 
                                    : "border-white/20"
                                }`}>
                                    {isAccepted ? (
                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                    ) : (
                                        <span className="text-[10px] text-white/50">{idx + 1}</span>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className={`text-xs font-bold ${isAccepted ? "text-emerald-400" : "text-slate-100"}`}>
                                            {step.title}
                                        </h4>
                                        <span className={`text-[9px] uppercase font-bold tracking-widest ${
                                            step.priority === "high" ? "text-rose-400" : "text-amber-400"
                                        }`}>
                                            {step.priority}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed mb-2">
                                        {step.description}
                                    </p>
                                    
                                    {!isAccepted && (
                                        <button 
                                            onClick={() => toggleStep(idx)}
                                            className="text-[10px] flex items-center gap-1 font-bold text-accent hover:text-white transition-colors"
                                        >
                                            Aceptar Reto <ChevronRight className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Submission Kit / Assets */}
            <AnimatePresence>
                {acceptedSteps.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-3"
                    >
                        {!assets ? (
                            <button
                                onClick={handleGenerateAssets}
                                disabled={isGenerating}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-all"
                            >
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {isGenerating ? "Generando Kit de Entrega..." : "Generar README & Pitch de Pro"}
                            </button>
                        ) : (
                            <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <FileText className="w-3 h-3" /> Submission Kit Listo
                                    </h5>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => assets && copyToClipboard(assets.readme, 'readme')}
                                            className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:text-white transition-colors"
                                            title="Copiar README"
                                        >
                                            {copied === 'readme' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                        <button 
                                            onClick={() => assets && copyToClipboard(assets.elevator_pitch, 'pitch')}
                                            className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:text-white transition-colors"
                                            title="Copiar Pitch"
                                        >
                                            {copied === 'pitch' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-2 bg-black/20 rounded-lg border border-white/5">
                                        <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">README.md</p>
                                        <p className="text-[10px] text-slate-300 line-clamp-2 italic">Estructura profesional profesional con roadmap y tech stack...</p>
                                    </div>
                                    <div className="p-2 bg-black/20 rounded-lg border border-white/5">
                                        <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Elevator Pitch</p>
                                        <p className="text-[10px] text-slate-300 line-clamp-2 italic">"Nuestro proyecto resuelve x mediante y..."</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AURA Digital Strategy Section */}
            <AnimatePresence>
                {acceptedSteps.length >= 1 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">AURA Digital Strategy</h5>
                            </div>
                            {!auraKit && (
                                <button 
                                    onClick={handleGenerateAuraKit}
                                    disabled={isGeneratingAura}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 text-[10px] font-bold hover:bg-indigo-500/30 transition-all border border-indigo-500/30 flex items-center gap-2"
                                >
                                    {isGeneratingAura ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                    Redimensionar Contenido
                                </button>
                            )}
                        </div>

                        {auraKit && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    {(['x', 'linkedin', 'discord'] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setSelectedPlatform(p)}
                                            className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${
                                                selectedPlatform === p 
                                                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                                                : "bg-white/5 text-slate-400 hover:bg-white/10"
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>

                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 relative group">
                                    <p className="text-[10px] text-slate-300 leading-relaxed break-words">
                                        {selectedPlatform === 'x' ? auraKit.x_post : selectedPlatform === 'linkedin' ? auraKit.linkedin_post : auraKit.discord_message}
                                    </p>
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => copyToClipboard(selectedPlatform === 'x' ? auraKit.x_post : selectedPlatform === 'linkedin' ? auraKit.linkedin_post : auraKit.discord_message, 'aura-copy')}
                                            className="p-1.5 rounded-lg bg-white/10 text-slate-400 hover:text-white transition-colors"
                                        >
                                            {copied === 'aura-copy' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleBoost}
                                    className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${
                                        copied === 'boosted'
                                        ? "bg-emerald-500 text-white"
                                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                                    }`}
                                >
                                    {copied === 'boosted' ? <CheckCircle2 className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
                                    {copied === 'boosted' ? "Enviado a AURA Pool" : `Boost via AURA (${selectedPlatform.toUpperCase()})`}
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Coach Tip */}
            <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 flex gap-3">
                <Info className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-1">Coach Pro-Tip</span>
                  <p className="text-[10px] text-slate-300 italic leading-relaxed">
                      "{roadmap.coach_tip}"
                  </p>
                </div>
            </div>
        </div>
    );
}
