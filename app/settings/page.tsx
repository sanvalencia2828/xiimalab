"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Settings,
    Wallet,
    CheckCircle2,
    XCircle,
    Loader2,
    Copy,
    Bell,
    Shield,
    Cpu,
    Sparkles,
    Lock,
    Github,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";

// ─── Stellar key validation ───────────────────────────────────────────────────
function validateStellarKey(key: string): { valid: boolean; message: string } {
    if (!key) return { valid: false, message: "" };
    if (!key.startsWith("G")) return { valid: false, message: "La clave pública Stellar debe comenzar con 'G'." };
    if (key.length !== 56) return { valid: false, message: `Longitud incorrecta: ${key.length}/56 caracteres.` };
    if (!/^[A-Z2-7]+$/.test(key)) return { valid: false, message: "Solo se permiten caracteres Base32 (A–Z, 2–7)." };
    return { valid: true, message: "Clave válida ✓" };
}

// ─── Coming-soon section cards ────────────────────────────────────────────────
const SECTIONS = [
    { icon: Bell, title: "Notificaciones", description: "Alertas de hackatones y matches", color: "text-purple-400", bg: "bg-purple-500/10" },
    { icon: Shield, title: "Seguridad", description: "API keys y webhook secrets", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: Cpu, title: "Integraciones", description: "DoraHacks, Devfolio, AURA y Hotmart", color: "text-amber-400", bg: "bg-amber-500/10" },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
    const { studentAddress: savedKey, setStudentAddress } = useWallet();
    const [stellarKey, setStellarKey] = useState(savedKey || "");
    const [isSaving, setIsSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<"success" | "error" | null>(null);
    const [copied, setCopied] = useState(false);
    const [githubConnected, setGithubConnected] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const validation = validateStellarKey(stellarKey);
    const isDirty = stellarKey !== (savedKey ?? "");

    // Load from Context on mount/update
    useEffect(() => {
        if (savedKey && stellarKey === "") {
            setStellarKey(savedKey);
        }
    }, [savedKey]);

    const handleSave = async () => {
        if (!validation.valid) return;
        setIsSaving(true);
        setSaveResult(null);
        try {
            // Simulate async Supabase call (replace with real fetch later)
            await new Promise((r) => setTimeout(r, 1200));
            setStudentAddress(stellarKey);
            setSaveResult("success");
        } catch {
            setSaveResult("error");
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveResult(null), 4000);
        }
    };

    const handleCopy = async () => {
        if (!savedKey) return;
        await navigator.clipboard.writeText(savedKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-6 min-h-screen">
            {/* ── Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Sistema</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-1">
                    Configura<span className="gradient-text">ción</span>
                </h1>
                <p className="text-slate-400 text-sm">
                    Vincula tu wallet Stellar para recibir reembolsos del Staking Educativo.
                </p>
            </motion.div>

            <div className="max-w-2xl space-y-6">
                {/* ── Stellar Wallet Card ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                    {/* Card header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                        <div className="p-2 rounded-xl bg-accent/10">
                            <Wallet className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-200">Stellar Wallet</h2>
                            <p className="text-xs text-muted-text">Necesaria para recibir Claimable Balances en Testnet</p>
                        </div>
                        {savedKey && (
                            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Vinculada
                            </span>
                        )}
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Saved key display */}
                        <AnimatePresence>
                            {savedKey && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-4 py-3"
                                >
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span className="text-xs text-emerald-300 font-mono truncate flex-1">
                                        {savedKey}
                                    </span>
                                    <button
                                        onClick={handleCopy}
                                        className="shrink-0 text-emerald-400 hover:text-emerald-300 transition-colors"
                                        title="Copiar dirección"
                                    >
                                        {copied
                                            ? <CheckCircle2 className="w-3.5 h-3.5" />
                                            : <Copy className="w-3.5 h-3.5" />
                                        }
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Input */}
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                Clave Pública Stellar
                            </label>
                            <input
                                type="text"
                                value={stellarKey}
                                onChange={(e) => setStellarKey(e.target.value.trim().toUpperCase())}
                                placeholder="GABC...XYZ (56 caracteres)"
                                spellCheck={false}
                                className={`w-full bg-background border rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 placeholder:text-muted-text outline-none transition-all ${stellarKey
                                    ? validation.valid
                                        ? "border-emerald-500/40 focus:border-emerald-400"
                                        : "border-red-500/40 focus:border-red-400"
                                    : "border-border focus:border-accent/40"
                                    }`}
                            />
                            {/* Validation feedback */}
                            <AnimatePresence mode="wait">
                                {stellarKey && (
                                    <motion.div
                                        key={validation.valid ? "valid" : "invalid"}
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${validation.valid ? "text-emerald-400" : "text-red-400"
                                            }`}
                                    >
                                        {validation.valid
                                            ? <CheckCircle2 className="w-3.5 h-3.5" />
                                            : <XCircle className="w-3.5 h-3.5" />
                                        }
                                        {validation.message}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Save button + result */}
                        <div className="flex items-center gap-3 pt-1">
                            <motion.button
                                onClick={handleSave}
                                disabled={!validation.valid || isSaving || !isDirty}
                                whileHover={validation.valid && !isSaving && isDirty ? { scale: 1.02 } : {}}
                                whileTap={validation.valid && !isSaving && isDirty ? { scale: 0.98 } : {}}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent text-background transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isSaving
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                                    : <><Wallet className="w-4 h-4" /> Vincular Wallet</>
                                }
                            </motion.button>

                            <AnimatePresence>
                                {saveResult && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`text-xs font-medium ${saveResult === "success" ? "text-emerald-400" : "text-red-400"
                                            }`}
                                    >
                                        {saveResult === "success"
                                            ? "✓ Wallet vinculada correctamente"
                                            : "✗ Error al guardar — intenta de nuevo"
                                        }
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>

                        <p className="text-xs text-muted-text pt-1">
                            Esta dirección recibirá el Claimable Balance en Stellar Testnet cuando completes los hitos del curso.
                            <strong className="text-slate-400"> Nunca compartas tu clave secreta.</strong>
                        </p>
                    </div>
                </motion.div>

                {/* ── Stellar Escrow Information ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                    {/* Card header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                        <div className="p-2 rounded-xl bg-amber-500/15">
                            <Lock className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-200">Stellar Escrow</h2>
                            <p className="text-xs text-muted-text">Fondos bloqueados en Testnet</p>
                        </div>
                    </div>

                    <div className="p-5 space-y-5">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-background rounded-xl p-3 border border-border text-center">
                                <p className="text-lg font-bold text-amber-400">100 XLM</p>
                                <p className="text-xs text-muted-text">Bloqueados</p>
                            </div>
                            <div className="bg-background rounded-xl p-3 border border-border text-center">
                                <p className="text-lg font-bold text-emerald-400">50 XLM</p>
                                <p className="text-xs text-muted-text">Liberados</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Escrows activos</p>
                            <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-200 truncate">AURA Pro — Domina el resize inteligente</p>
                                    <p className="text-xs text-muted-text">4/10 imágenes · 100 XLM</p>
                                </div>
                                <span className="text-xs text-amber-400 font-bold shrink-0">40%</span>
                            </div>
                        </div>

                        <a
                            href="https://laboratory.stellar.org/#explorer?resource=claimable_balances&endpoint=all&network=test"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-accent/30 text-accent text-xs font-medium hover:bg-accent/10 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-external-link w-3.5 h-3.5">
                                <path d="M15 3h6v6"></path>
                                <path d="M10 14 21 3"></path>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            </svg>
                            Ver en Stellar Explorer
                        </a>
                    </div>
                </motion.div>

                {/* ── GitHub Integration Card ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.12 }}
                    className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                        <div className="p-2 rounded-xl bg-slate-800">
                            <Github className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-200">GitHub Connect</h2>
                            <p className="text-xs text-muted-text">Importa tus proyectos para entrenar a tu IA</p>
                        </div>
                        {githubConnected && (
                            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Conectado
                            </span>
                        )}
                    </div>

                    <div className="p-5">
                        {!githubConnected ? (
                            <div className="space-y-4">
                                <p className="text-xs text-slate-400">
                                    Al conectar tu cuenta de GitHub, Xiimalab podrá leer tus repositorios públicos para 
                                    personalizar aún más tus roadmaps y demostrar tu experiencia técnica.
                                </p>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setGithubConnected(true)} // Mocking connection for now
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-all w-full justify-center"
                                >
                                    <Github className="w-4 h-4" /> Conectar con GitHub
                                </motion.button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                                            <Github className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white">sanvalencia2828</p>
                                            <p className="text-[10px] text-emerald-400">Sincronización activa</p>
                                        </div>
                                    </div>
                                    <button 
                                        disabled={isSyncing}
                                        onClick={async () => {
                                            setIsSyncing(true);
                                            // Simulated sync call
                                            await new Promise(r => setTimeout(r, 2000));
                                            setIsSyncing(false);
                                        }}
                                        className="text-xs font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                                    >
                                        {isSyncing ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                                        {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
                                    </button>
                                </div>
                                <p className="text-[10px] text-muted-text">
                                    Última sincronización: Hace 5 minutos. Se han importado 12 proyectos exitosamente.
                                </p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* ── Coming-soon sections ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {SECTIONS.map(({ icon: Icon, title, description, color, bg }, i) => (
                        <motion.div
                            key={title}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                            className="bg-card border border-border rounded-2xl p-4 opacity-60 cursor-not-allowed"
                        >
                            <div className={`p-2 rounded-xl ${bg} w-fit mb-3`}>
                                <Icon className={`w-4 h-4 ${color}`} />
                            </div>
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-slate-300">{title}</h3>
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400">
                                    <Sparkles className="w-2 h-2" />
                                    Pronto
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-text">{description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}

