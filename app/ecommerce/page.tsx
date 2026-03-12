/**
 * app/ecommerce/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Staking Educativo — Dashboard principal
 *
 * Arquitectura de hidratación (ver AGENTS.md reglas):
 *   • Shell del layout → Server Component (no hay fetch, no hay window)
 *   • <CoursesPanel>   → "use client", datos de Hotmart via /api/escrow
 *   • <EscrowPanel>    → "use client", datos de Stellar — SIEMPRE dentro de
 *                        <ClientOnly> para prevenir hydration mismatch #418/#423
 *
 * Datos:
 *   • Cursos     → fetch /api/escrow?user=... (conecta con educational_escrows)
 *   • Escrow XLM → fetch /api/stellar/balance (proxy Horizon, sin exponer keys)
 *   • Progreso   → fetch /api/skills (user_skills_progress)
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BookOpen, ShoppingBag, Lock, Unlock, Zap,
    CheckCircle2, Clock, ImageIcon, Trophy, ChevronRight,
    Wallet, AlertCircle, ExternalLink,
} from "lucide-react";
import ClientOnly from "./_components/ClientOnly";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
type EscrowStatus = "active" | "released" | "pending" | "refunded";

interface Course {
    id:             string;
    title:          string;
    description:    string;
    platform:       "hotmart";
    auraProgress:   number;   // imágenes procesadas
    auraRequired:   number;   // milestone para liberar
    amountXlm:      number;
    escrowStatus:   EscrowStatus;
    balanceId:      string | null;
    purchasedAt:    string;
}

interface EscrowSummary {
    totalLocked:    number;
    totalReleased:  number;
    activeEscrows:  number;
}

// ─────────────────────────────────────────────
// Placeholders (se reemplazarán con fetch real)
// ─────────────────────────────────────────────
const PLACEHOLDER_COURSES: Course[] = [
    {
        id:           "course-aura-pro",
        title:        "AURA Pro — Domina el resize inteligente",
        description:  "Aprende a configurar pipelines de procesamiento de imágenes con IA. Al completar 10 imágenes con AURA, recibes tu staking de vuelta.",
        platform:     "hotmart",
        auraProgress: 4,
        auraRequired: 10,
        amountXlm:    100,
        escrowStatus: "active",
        balanceId:    null,
        purchasedAt:  new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    },
    {
        id:           "course-blockchain-basics",
        title:        "Blockchain & Stellar — Fundamentos para builders",
        description:  "Entiende Claimable Balances, DeFi en Stellar y cómo integrarlo con aplicaciones modernas. Aplica a 1 hackatón para liberar el staking.",
        platform:     "hotmart",
        auraProgress: 10,
        auraRequired: 10,
        amountXlm:    50,
        escrowStatus: "released",
        balanceId:    "00000000abc123def456",
        purchasedAt:  new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
];

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────
const containerVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};
const itemVariants = {
    hidden:  { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

// ─────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────
const escrowConfig: Record<EscrowStatus, {
    label: string; color: string; bg: string; border: string; icon: typeof Lock;
}> = {
    active:   { label: "Bloqueado",  color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/25",  icon: Lock },
    released: { label: "Liberado",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", icon: Unlock },
    pending:  { label: "Pendiente",  color: "text-slate-400",   bg: "bg-slate-700/30",  border: "border-slate-600/30",  icon: Clock },
    refunded: { label: "Reembolsado",color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/25",    icon: CheckCircle2 },
};

function ProgressBar({ value, max, color = "#f59e0b" }: { value: number; max: number; color?: string }) {
    const pct = Math.min((value / max) * 100, 100);
    return (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
                initial={{ width: "0%" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.0, ease: "easeOut", delay: 0.3 }}
            />
        </div>
    );
}

function CourseCard({ course }: { course: Course }) {
    const cfg  = escrowConfig[course.escrowStatus];
    const Icon = cfg.icon;
    const pct  = Math.round((course.auraProgress / course.auraRequired) * 100);
    const isComplete = course.escrowStatus === "released";

    return (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className={`relative bg-card border rounded-2xl p-6 overflow-hidden ${cfg.border}`}
        >
            {/* Top accent line */}
            <div
                className="absolute top-0 left-0 right-0 h-px opacity-50"
                style={{ background: `linear-gradient(90deg, transparent, ${isComplete ? "#34d399" : "#f59e0b"}80, transparent)` }}
            />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="w-4 h-4 text-accent shrink-0" />
                        <h3 className="text-sm font-bold text-white leading-tight">{course.title}</h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {course.description}
                    </p>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                </span>
            </div>

            {/* AURA Progress */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <ImageIcon className="w-3 h-3" />
                        <span>Progreso AURA</span>
                    </div>
                    <span className={`text-xs font-bold ${isComplete ? "text-emerald-400" : "text-amber-400"}`}>
                        {course.auraProgress}/{course.auraRequired} imágenes
                    </span>
                </div>
                <ProgressBar
                    value={course.auraProgress}
                    max={course.auraRequired}
                    color={isComplete ? "#34d399" : "#f59e0b"}
                />
                {!isComplete && (
                    <p className="text-xs text-slate-500 mt-1.5">
                        Faltan {course.auraRequired - course.auraProgress} imágenes para liberar el staking
                    </p>
                )}
            </div>

            {/* Metrics */}
            <div className="pt-4 border-t border-border grid grid-cols-3 gap-3">
                <div className="text-center">
                    <p className="text-sm font-bold text-amber-400">{course.amountXlm} XLM</p>
                    <p className="text-xs text-muted-text">En escrow</p>
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-white">{pct}%</p>
                    <p className="text-xs text-muted-text">Completado</p>
                </div>
                <div className="text-center">
                    {/* Fecha de compra — suppressHydrationWarning: timezone puede diferir */}
                    <p className="text-sm font-bold text-white" suppressHydrationWarning>
                        {new Date(course.purchasedAt).toLocaleDateString("es-CO", {
                            day: "numeric", month: "short",
                        })}
                    </p>
                    <p className="text-xs text-muted-text">Comprado</p>
                </div>
            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────
// EscrowPanel — DEBE estar dentro de <ClientOnly>
// Cualquier acceso a wallet/Stellar va aquí
// ─────────────────────────────────────────────
function EscrowPanelInner({ summary }: { summary: EscrowSummary }) {
    // Estado de conexión de wallet (localStorage — solo en cliente)
    const [walletAddress, setWalletAddress] = useState<string | null>(null);

    useEffect(() => {
        // Leer wallet guardada — NUNCA mover este código fuera del useEffect
        const saved = localStorage.getItem("stellar_pubkey");
        if (saved) setWalletAddress(saved);
    }, []);

    const escrows = PLACEHOLDER_COURSES.filter((c) => c.escrowStatus === "active");

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-amber-500/15">
                    <Lock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-200">Stellar Escrow</h3>
                    <p className="text-xs text-muted-text">Fondos bloqueados en Testnet</p>
                </div>
            </div>

            {/* Wallet status */}
            <div className={`flex items-center gap-2 mb-5 px-3 py-2.5 rounded-xl border text-xs font-medium ${
                walletAddress
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-slate-700/30 border-slate-600/30 text-slate-500"
            }`}>
                <Wallet className="w-3.5 h-3.5 shrink-0" />
                {walletAddress ? (
                    <span className="truncate font-mono">
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
                    </span>
                ) : (
                    <span>Wallet no conectada — configura en /settings</span>
                )}
            </div>

            {/* Summary metrics */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-background rounded-xl p-3 border border-border text-center">
                    <p className="text-lg font-bold text-amber-400">{summary.totalLocked} XLM</p>
                    <p className="text-xs text-muted-text">Bloqueados</p>
                </div>
                <div className="bg-background rounded-xl p-3 border border-border text-center">
                    <p className="text-lg font-bold text-emerald-400">{summary.totalReleased} XLM</p>
                    <p className="text-xs text-muted-text">Liberados</p>
                </div>
            </div>

            {/* Active escrows */}
            {escrows.length > 0 ? (
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Escrows activos
                    </p>
                    {escrows.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-200 truncate">{c.title}</p>
                                <p className="text-xs text-muted-text">
                                    {c.auraProgress}/{c.auraRequired} imágenes · {c.amountXlm} XLM
                                </p>
                            </div>
                            <span className="text-xs text-amber-400 font-bold shrink-0">
                                {Math.round((c.auraProgress / c.auraRequired) * 100)}%
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-xs text-emerald-400 font-medium">Todos los escrows liberados ✓</p>
                </div>
            )}

            {/* CTA */}
            <motion.a
                href="https://laboratory.stellar.org/#explorer?resource=claimable_balances&endpoint=all&network=test"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-accent/30 text-accent text-xs font-medium hover:bg-accent/10 transition-colors"
            >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver en Stellar Explorer
            </motion.a>
        </div>
    );
}

// Skeleton idéntico al EscrowPanelInner para el fallback de ClientOnly
function EscrowPanelSkeleton() {
    return (
        <div className="bg-card border border-border rounded-2xl p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-muted" />
                <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-28 rounded bg-muted" />
                    <div className="h-3 w-20 rounded bg-muted" />
                </div>
            </div>
            <div className="h-9 w-full rounded-xl bg-muted mb-5" />
            <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="h-16 rounded-xl bg-muted" />
                <div className="h-16 rounded-xl bg-muted" />
            </div>
            {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border mb-3">
                    <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-3/4 rounded bg-muted" />
                        <div className="h-3 w-1/2 rounded bg-muted" />
                    </div>
                    <div className="w-8 h-4 rounded bg-muted" />
                </div>
            ))}
            <div className="h-10 w-full rounded-xl bg-muted mt-4" />
        </div>
    );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function EcommercePage() {
    // Calcular summary desde placeholders
    const summary: EscrowSummary = {
        totalLocked:   PLACEHOLDER_COURSES.filter((c) => c.escrowStatus === "active").reduce((a, c) => a + c.amountXlm, 0),
        totalReleased: PLACEHOLDER_COURSES.filter((c) => c.escrowStatus === "released").reduce((a, c) => a + c.amountXlm, 0),
        activeEscrows: PLACEHOLDER_COURSES.filter((c) => c.escrowStatus === "active").length,
    };

    const stats = [
        { icon: BookOpen,  label: "Cursos adquiridos",  value: `${PLACEHOLDER_COURSES.length}`,     color: "text-accent" },
        { icon: Lock,      label: "XLM en escrow",      value: `${summary.totalLocked} XLM`,        color: "text-amber-400" },
        { icon: Trophy,    label: "XLM liberados",      value: `${summary.totalReleased} XLM`,      color: "text-emerald-400" },
    ];

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
                        Staking Educativo
                    </span>
                </div>
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">
                            Mi <span className="gradient-text">Aprendizaje</span>
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Cursos Hotmart · Escrow Stellar · Proof of Skill
                        </p>
                    </div>
                    <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Zap className="w-3.5 h-3.5" />
                        Testnet activa
                    </span>
                </div>
            </motion.div>

            {/* Stats bar */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-3 gap-4 mb-8"
            >
                {stats.map((s) => {
                    const Icon = s.icon;
                    return (
                        <motion.div
                            key={s.label}
                            variants={itemVariants}
                            className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
                        >
                            <div className="p-2 rounded-lg bg-muted">
                                <Icon className={`w-5 h-5 ${s.color}`} />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-white">{s.value}</p>
                                <p className="text-xs text-muted-text">{s.label}</p>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* Aviso de datos placeholder */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-start gap-2 mb-6 p-3 bg-sky-500/5 border border-sky-500/20 rounded-xl"
            >
                <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <p className="text-xs text-sky-400 leading-relaxed">
                    <span className="font-semibold">Modo demo</span> — Datos de ejemplo. Los cursos reales se
                    cargarán desde <code className="bg-sky-500/10 px-1 rounded">educational_escrows</code> en Supabase
                    una vez conectes tu wallet en{" "}
                    <a href="/settings" className="underline underline-offset-2 hover:text-sky-300">
                        /settings
                    </a>.
                </p>
            </motion.div>

            {/* Main layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
                {/* Left — Courses */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-accent/10">
                            <BookOpen className="w-4 h-4 text-accent" />
                        </div>
                        <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                            Mis Infoproductos
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                            {PLACEHOLDER_COURSES.length}
                        </span>
                    </div>

                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-4"
                    >
                        {PLACEHOLDER_COURSES.map((course) => (
                            <CourseCard key={course.id} course={course} />
                        ))}
                    </motion.div>

                    {/* CTA Hotmart */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="mt-5 p-4 bg-card border border-dashed border-border rounded-2xl flex items-center justify-between group cursor-pointer hover:border-accent/40 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                                <ShoppingBag className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-300">
                                    Explorar más cursos
                                </p>
                                <p className="text-xs text-muted-text">
                                    Hotmart · Con staking de vuelta garantizado
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-accent transition-colors" />
                    </motion.div>
                </div>

                {/* Right — Escrow Panel
                    ⚠️ DENTRO DE <ClientOnly> — accede localStorage (wallet address)
                    El fallback es un Skeleton con la misma estructura para evitar #418/#423 */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-amber-500/15">
                            <Lock className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                            Stellar Escrow
                        </span>
                    </div>

                    <ClientOnly fallback={<EscrowPanelSkeleton />}>
                        <EscrowPanelInner summary={summary} />
                    </ClientOnly>
                </div>
            </div>
        </div>
    );
}
