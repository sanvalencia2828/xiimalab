"use client";

<<<<<<< HEAD
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
=======
/**
 * app/settings/page.tsx
 * Página de configuración — Wallet Stellar + perfil de skills.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
    Settings, Wallet, CheckCircle2, AlertCircle,
    Copy, ExternalLink, Trash2, User, Zap, ShieldCheck,
} from "lucide-react";
import { useWallet } from "@/lib/WalletContext";

// ── Validación básica de clave pública Stellar ────────────────────
function isStellarPubKey(key: string): boolean {
    return /^G[A-Z2-7]{55}$/.test(key.trim());
}

// ── Componente CopyButton ─────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handle = async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };
    return (
        <button onClick={handle}
            className="p-1.5 rounded-lg text-slate-500 hover:text-accent hover:bg-accent/10 transition-colors">
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
}

// ── Sección: Wallet ────────────────────────────────────────────────
function WalletSection() {
    const { isConnected, publicKey, displayName, connectedAt, connect, disconnect } = useWallet();
    const [input, setInput]   = useState("");
    const [name, setName]     = useState("");
    const [error, setError]   = useState("");
    const [saving, setSaving] = useState(false);

    const handleConnect = async () => {
        const key = input.trim();
        if (!isStellarPubKey(key)) {
            setError("La clave debe comenzar con G y tener 56 caracteres (formato Stellar).");
            return;
        }
        setError("");
        setSaving(true);
        // Pequeño delay para feedback visual
        await new Promise(r => setTimeout(r, 600));
        connect(key, name.trim() || undefined);
        setSaving(false);
        setInput("");
        setName("");
    };

    return (
        <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
                    <Wallet className="w-4.5 h-4.5 text-accent" />
                </div>
                <div>
                    <h2 className="font-semibold text-white">Wallet Stellar</h2>
                    <p className="text-xs text-slate-500">
                        Tu identidad blockchain para Proof of Skill y MarketMatch
                    </p>
                </div>
                {isConnected && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Conectada
                    </span>
                )}
            </div>

            {isConnected ? (
                /* ── Wallet conectada ─────────────────────────── */
                <div className="space-y-4">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                        <p className="text-xs text-slate-500 mb-1">Clave pública</p>
                        <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-emerald-400 break-all flex-1">
                                {publicKey}
                            </code>
                            <CopyBtn text={publicKey!} />
                            <a href={`https://stellar.expert/explorer/testnet/account/${publicKey}`}
                                target="_blank" rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-400/10 transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                        {displayName && (
                            <p className="text-xs text-slate-400 mt-2">
                                Nombre: <span className="text-slate-200">{displayName}</span>
                            </p>
                        )}
                        {connectedAt && (
                            <p className="text-xs text-slate-500 mt-1">
                                Conectada: {new Date(connectedAt).toLocaleDateString("es", {
                                    day: "numeric", month: "long", year: "numeric",
                                })}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
                        <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0" />
                        <p className="text-xs text-slate-400">
                            Tu clave pública es segura — nunca pedimos la clave privada.
                            Los pagos de escrow se envían automáticamente a esta dirección.
                        </p>
                    </div>

                    <button
                        onClick={disconnect}
                        className="flex items-center gap-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/5 px-3 py-2 rounded-lg border border-red-500/20 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Desconectar wallet
                    </button>
                </div>
            ) : (
                /* ── Formulario de conexión ───────────────────── */
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Nombre o alias (opcional)
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="ej. Santiago Valencia"
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Clave pública Stellar <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={input}
                            onChange={e => { setInput(e.target.value); setError(""); }}
                            placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                            className={`w-full bg-slate-800/50 border rounded-xl px-4 py-2.5 text-sm font-mono placeholder-slate-600 focus:outline-none focus:ring-1 transition-all ${
                                error
                                    ? "border-red-500/50 text-red-300 focus:border-red-500 focus:ring-red-500/20"
                                    : "border-slate-700/50 text-slate-200 focus:border-accent/50 focus:ring-accent/20"
                            }`}
                        />
                        {error && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-400">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                {error}
                            </div>
                        )}
                        <p className="text-xs text-slate-500 mt-1.5">
                            ¿No tienes wallet?{" "}
                            <a href="https://stellar.org/learn/stellar-wallets"
                                target="_blank" rel="noopener noreferrer"
                                className="text-accent hover:underline">
                                Crea una gratis en Stellar.org
                            </a>
                        </p>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleConnect}
                        disabled={saving || !input}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <span className="animate-pulse">Guardando...</span>
                        ) : (
                            <><Wallet className="w-4 h-4" /> Conectar Wallet</>
                        )}
                    </motion.button>
                </div>
            )}
        </div>
    );
}

// ── Sección: Perfil de skills ──────────────────────────────────────
const SKILL_OPTIONS = [
    "Python", "TypeScript", "Rust", "Solidity",
    "AI / Machine Learning", "Computer Vision", "NLP", "LLM / Agents",
    "Stellar", "Blockchain", "DeFi", "Web3", "NFT",
    "Docker", "FastAPI", "Next.js", "React",
    "PostgreSQL", "pgvector", "Redis",
    "Data Analytics", "Image Processing",
];

function SkillsSection() {
    const [selected, setSelected] = useState<string[]>(() => {
        if (typeof window === "undefined") return [];
        try {
            const raw = localStorage.getItem("xiimalab_skills");
            return raw ? JSON.parse(raw) : ["Python", "Stellar", "AI / Machine Learning", "Computer Vision"];
        } catch { return []; }
    });
    const [saved, setSaved] = useState(false);

    const toggle = (skill: string) => {
        setSelected(prev =>
            prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
        );
        setSaved(false);
    };

    const save = () => {
        localStorage.setItem("xiimalab_skills", JSON.stringify(selected));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <Zap className="w-4.5 h-4.5 text-violet-400" />
                </div>
                <div>
                    <h2 className="font-semibold text-white">Perfil de Skills</h2>
                    <p className="text-xs text-slate-500">
                        El Agent Crew usa este perfil para calcular tu MarketMatch
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
                {SKILL_OPTIONS.map(skill => (
                    <button
                        key={skill}
                        onClick={() => toggle(skill)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                            selected.includes(skill)
                                ? "bg-accent/15 text-accent border-accent/40"
                                : "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200 hover:border-slate-600"
                        }`}
                    >
                        {skill}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-3">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={save}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors"
                >
                    {saved ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" />Guardado</> : "Guardar skills"}
                </motion.button>
                <span className="text-xs text-slate-500">{selected.length} skills seleccionadas</span>
>>>>>>> 818308f5dd3f39122c8e46bc57ee372d2f05d9ba
            </div>
        </div>
    );
}

<<<<<<< HEAD
=======
// ── Page ───────────────────────────────────────────────────────────
const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function SettingsPage() {
    return (
        <div className="p-6 min-h-screen max-w-2xl">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-xs font-medium text-accent uppercase tracking-widest">
                        Configuración
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <Settings className="w-7 h-7 text-slate-400" />
                    <div>
                        <h1 className="text-3xl font-bold text-white">
                            Ajustes<span className="gradient-text"> & Identidad</span>
                        </h1>
                        <p className="text-slate-400 text-sm mt-0.5">
                            Wallet · Skills · Preferencias
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Secciones */}
            <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                className="space-y-5"
            >
                <motion.div variants={itemVariants}><WalletSection /></motion.div>
                <motion.div variants={itemVariants}><SkillsSection /></motion.div>

                {/* Info */}
                <motion.div variants={itemVariants}
                    className="bg-card border border-border rounded-2xl p-5 flex items-start gap-3">
                    <User className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-slate-300">Más configuración próximamente</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Notificaciones · GitHub integration · Preferencias de idioma · Tema
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
>>>>>>> 818308f5dd3f39122c8e46bc57ee372d2f05d9ba
