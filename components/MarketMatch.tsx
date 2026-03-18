"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { BarChart3, BrainCircuit, Loader2, Target, TrendingUp, X } from "lucide-react";

// -------------------------------------------------------
// TYPES
// -------------------------------------------------------
interface Skill {
    label: string;
    sublabel: string;
    userScore: number;
    marketDemand: number;
    color: string;
    icon: typeof BarChart3;
    // AI-enriched (populated on demand)
    matchScore?: number;
    missingSkills?: string[];
    projectHighlight?: string;
}

// -------------------------------------------------------
// STATIC BASE DATA (scores updated by AI analysis)
// -------------------------------------------------------
const BASE_SKILLS: Skill[] = [
    {
        label: "Data Analytics",
        sublabel: "NODO-EAFIT",
        userScore: 82,
        marketDemand: 90,
        color: "#7dd3fc",
        icon: BarChart3,
    },
    {
        label: "Docker & DevOps",
        sublabel: "Containerización",
        userScore: 75,
        marketDemand: 85,
        color: "#38bdf8",
        icon: TrendingUp,
    },
    {
        label: "Blockchain",
        sublabel: "Stellar · Avalanche",
        userScore: 68,
        marketDemand: 78,
        color: "#f59e0b",
        icon: Target,
    },
    {
        label: "AI / ML",
        sublabel: "Python · Modelos",
        userScore: 70,
        marketDemand: 95,
        color: "#a78bfa",
        icon: BarChart3,
    },
];

// Fake "hackathon" opportunity per skill to send to Claude
const SKILL_OPPORTUNITIES: Record<string, object> = {
    "Data Analytics": {
        title: "Data Analytics & BI Hackathon",
        tags: ["Python", "Pandas", "SQL", "Tableau", "dbt"],
        prize_pool_usd: 30000,
        description: "Build a data pipeline and dashboard for real-time business intelligence.",
    },
    "Docker & DevOps": {
        title: "Cloud-Native DevOps Challenge",
        tags: ["Docker", "Kubernetes", "CI/CD", "GitHub Actions", "Terraform"],
        prize_pool_usd: 50000,
        description: "Design a fully automated cloud-native deployment pipeline.",
    },
    "Blockchain": {
        title: "DeFi & Blockchain Innovation Sprint",
        tags: ["Solidity", "EVM", "Stellar", "Avalanche", "Smart Contracts", "IPFS"],
        prize_pool_usd: 75000,
        description: "Create a decentralized financial product on Stellar or Avalanche.",
    },
    "AI / ML": {
        title: "AI x Web3 Global Sprint",
        tags: ["PyTorch", "LLMs", "Computer Vision", "FastAPI", "Python"],
        prize_pool_usd: 100000,
        description: "Build an AI-powered product that integrates with blockchain infrastructure.",
    },
};

// -------------------------------------------------------
// ANIMATED BAR
// -------------------------------------------------------
function AnimatedBar({ value, color, delay = 0 }: { value: number; color: string; delay?: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once: true });

    return (
        <div ref={ref} className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
                initial={{ width: "0%" }}
                animate={{ width: isInView ? `${value}%` : "0%" }}
                transition={{ duration: 1.2, ease: "easeOut", delay }}
            />
        </div>
    );
}

// -------------------------------------------------------
// GAP BADGE
// -------------------------------------------------------
function GapBadge({ user, market }: { user: number; market: number }) {
    const gap = market - user;
    if (gap <= 0)
        return (
            <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md">
                ✓ Cubierto
            </span>
        );
    return (
        <span className="text-xs text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-md">
            +{gap}% gap
        </span>
    );
}

// -------------------------------------------------------
// AI INSIGHTS MODAL
// -------------------------------------------------------
interface InsightsModal {
    skill: Skill;
    onClose: () => void;
}

function AIInsightsModal({ skill, onClose }: InsightsModal) {
    const [loading, setLoading] = useState(!skill.missingSkills);
    const [data, setData] = useState<{
        matchScore: number;
        missingSkills: string[];
        projectHighlight: string;
    } | null>(
        skill.missingSkills
            ? {
                matchScore: skill.matchScore ?? 0,
                missingSkills: skill.missingSkills,
                projectHighlight: skill.projectHighlight ?? "",
            }
            : null
    );

    useEffect(() => {
        if (data) return;
        const opp = SKILL_OPPORTUNITIES[skill.label] ?? { title: skill.label, tags: [], prize_pool_usd: 0 };

        fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: `skill-${skill.label.toLowerCase().replace(/\s/g, "-")}`,
                title: (opp as any).title,
                tags: (opp as any).tags ?? [],
                prize_pool: (opp as any).prize_pool_usd ?? 0,
                description: (opp as any).description ?? "",
            }),
        })
            .then((r) => r.json())
            .then((res) =>
                setData({
                    matchScore: res.match_score ?? 0,
                    missingSkills: res.missing_skills ?? [],
                    projectHighlight: res.project_highlight ?? "",
                })
            )
            .catch(() =>
                setData({ matchScore: 0, missingSkills: [], projectHighlight: "Error al conectar con IA." })
            )
            .finally(() => setLoading(false));
    }, []);

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Backdrop */}
            <motion.div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            />

            {/* Modal card */}
            <motion.div
                className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl z-10"
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 20, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-500/15">
                            <BrainCircuit className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-text">Claude 3.5 · IA Insights</p>
                            <h3 className="text-sm font-bold text-slate-100">{skill.label}</h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-text hover:text-slate-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center py-10 gap-3">
                        <Loader2 className="w-7 h-7 text-accent animate-spin" />
                        <p className="text-xs text-muted-text">Consultando a Claude 3.5…</p>
                    </div>
                ) : data ? (
                    <div className="space-y-4">
                        {/* Match score ring */}
                        <div className="flex items-center gap-4 p-4 bg-background rounded-xl border border-border">
                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center text-sm font-extrabold text-white shrink-0"
                                style={{
                                    background: `conic-gradient(${skill.color} ${data.matchScore * 3.6}deg, #1f2937 0deg)`,
                                }}
                            >
                                <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center">
                                    <span className="text-xs font-bold" style={{ color: skill.color }}>
                                        {data.matchScore}%
                                    </span>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-muted-text mb-0.5">Match Score IA</p>
                                <p className="text-sm font-semibold text-slate-200">
                                    {data.matchScore >= 80
                                        ? "🔥 Alta competitividad"
                                        : data.matchScore >= 60
                                            ? "⚡ Buen potencial"
                                            : "📈 En desarrollo"}
                                </p>
                            </div>
                        </div>

                        {/* Missing skills */}
                        {data.missingSkills.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    Habilidades faltantes
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {data.missingSkills.map((s) => (
                                        <span
                                            key={s}
                                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-danger/10 text-red-400 border border-danger/20"
                                        >
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Project highlight */}
                        {data.projectHighlight && (
                            <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl">
                                <p className="text-xs text-muted-text mb-1 font-semibold uppercase tracking-wider">
                                    💡 Cómo usar RedimensionAI
                                </p>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    {data.projectHighlight}
                                </p>
                            </div>
                        )}
                    </div>
                ) : null}
            </motion.div>
        </motion.div>
    );
}

// -------------------------------------------------------
// MAIN COMPONENT
// -------------------------------------------------------
// Icon map for API-returned skills (by label keyword)
const ICON_MAP: Record<string, React.ElementType> = {
    "Data":       BarChart3,
    "Docker":     TrendingUp,
    "Blockchain": Target,
    "AI":         BrainCircuit,
    "ML":         BrainCircuit,
    "Python":     BarChart3,
};
function iconForLabel(label: string): React.ElementType {
    for (const [key, Icon] of Object.entries(ICON_MAP)) {
        if (label.includes(key)) return Icon;
    }
    return BarChart3;
}

export default function MarketMatch() {
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
    const [skills, setSkills]               = useState<Skill[]>(BASE_SKILLS);
    const [loadingSkills, setLoadingSkills] = useState(true);

    // Fetch skills from API on mount — fallback to BASE_SKILLS on error
    useEffect(() => {
        fetch("/api/skills")
            .then((r) => r.json())
            .then((data: Array<{ label: string; sublabel?: string; user_score: number; market_demand: number; color: string }>) => {
                if (!Array.isArray(data) || data.length === 0) return;
                setSkills(data.map((s) => ({
                    label:        s.label,
                    sublabel:     s.sublabel ?? "",
                    userScore:    s.user_score,
                    marketDemand: s.market_demand,
                    color:        s.color,
                    icon:         iconForLabel(s.label),
                })));
            })
            .catch(() => {/* keep BASE_SKILLS fallback */})
            .finally(() => setLoadingSkills(false));
    }, []);

    const overallScore = Math.round(
        skills.reduce((acc, s) => acc + (s.userScore / s.marketDemand) * 100, 0) / skills.length
    );

    return (
        <>
            <div className="bg-card border border-border rounded-2xl p-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 rounded-xl bg-purple-500/15">
                        <Target className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-200">Habilidades vs. Mercado</h3>
                        <p className="text-xs text-muted-text">Análisis IA con Claude 3.5</p>
                    </div>
                    {/* Score ring */}
                    <div className="text-center">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-extrabold text-white"
                            style={{ background: `conic-gradient(#7dd3fc ${overallScore * 3.6}deg, #1f2937 0deg)` }}
                        >
                            <div className="w-9 h-9 rounded-full bg-card flex items-center justify-center">
                                <span className="text-xs font-bold text-accent">{overallScore}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Skills list */}
                <div className="space-y-5">
                    {loadingSkills ? (
                        // Skeleton loading
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="animate-pulse space-y-2">
                                <div className="flex justify-between">
                                    <div className="h-3 w-32 bg-slate-700/60 rounded" />
                                    <div className="h-3 w-12 bg-slate-700/60 rounded" />
                                </div>
                                <div className="h-2 w-full bg-slate-700/40 rounded-full" />
                            </div>
                        ))
                    ) : skills.map(({ label, sublabel, userScore, marketDemand, color, icon: Icon }, idx) => (
                        <motion.div
                            key={label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1, duration: 0.4 }}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                                    <div>
                                        <span className="text-xs font-semibold text-slate-200">{label}</span>
                                        <span className="text-xs text-muted-text ml-1.5">· {sublabel}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <GapBadge user={userScore} market={marketDemand} />
                                    {/* IA Insights button */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setSelectedSkill(skills[idx])}
                                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/20"
                                    >
                                        <BrainCircuit className="w-3 h-3" />
                                        IA
                                    </motion.button>
                                </div>
                            </div>

                            {/* User skill bar */}
                            <div className="mb-1">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-muted-text">Mis habilidades</span>
                                    <span className="text-xs font-bold" style={{ color }}>{userScore}%</span>
                                </div>
                                <AnimatedBar value={userScore} color={color} delay={idx * 0.15} />
                            </div>

                            {/* Market demand bar */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-muted-text">Demanda mercado</span>
                                    <span className="text-xs text-muted-text">{marketDemand}%</span>
                                </div>
                                <AnimatedBar value={marketDemand} color="#374151" delay={idx * 0.15 + 0.1} />
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-5 pt-4 border-t border-border">
                    <p className="text-xs text-muted-text leading-relaxed">
                        <span className="text-accent font-semibold">IA recomendación: </span>
                        Enfócate en <span className="text-white font-medium">AI/ML</span> y{" "}
                        <span className="text-white font-medium">Blockchain</span> para maximizar tu match
                        con las próximas convocatorias.{" "}
                        <button
                            onClick={() => setSelectedSkill(skills[3])}
                            className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                        >
                            Ver análisis IA →
                        </button>
                    </p>
                </div>
            </div>

            {/* AI Insights Modal */}
            <AnimatePresence>
                {selectedSkill && (
                    <AIInsightsModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
                )}
            </AnimatePresence>
        </>
    );
}
