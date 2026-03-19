"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Settings,
    Wallet,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Copy,
    ExternalLink,
    Trash2,
    User,
    Zap,
    ShieldCheck,
    Lock,
    Github,
    Bell,
    Shield,
    Cpu,
    Sparkles,
    XCircle,
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
        const key = input.trim().toUpperCase();
        if (!isStellarPubKey(key)) {
            setError("La clave debe comenzar con G y tener 56 caracteres (formato Stellar).");
            return;
        }
        setError("");
        setSaving(true);
        // Pequeño delay para feedback visual
        await new Promise(r => setTimeout(r, 800));
        connect(key, name.trim() || undefined);
        setSaving(false);
        setInput("");
        setName("");
    };

    return (
        <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
                    <Wallet className="w-5 h-5 text-accent" />
                </div>
                <div>
                    <h2 className="font-semibold text-white">Wallet Stellar</h2>
                    <p className="text-xs text-slate-500">
                        Tu identidad blockchain para Proof of Skill y MarketMatch
                    </p>
                </div>
                {isConnected && (
                    <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Vinculada
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
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre o alias (opcional)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="ej. Santiago Valencia"
                            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-accent/50 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Clave pública Stellar *</label>
                        <input
                            type="text"
                            value={input}
                            onChange={e => { setInput(e.target.value); setError(""); }}
                            placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                            className={`w-full bg-background border rounded-xl px-4 py-2.5 text-sm font-mono transition-all ${error ? "border-red-500/50 text-red-300" : "border-border text-slate-200 focus:border-accent/50"}`}
                        />
                        {error && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</p>}
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
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={handleConnect}
                        disabled={saving || !input}
                        className="w-full py-3 rounded-xl bg-accent text-white font-bold text-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : "Vincular Wallet"}
                    </motion.button>
                </div>
            )}
        </div>
    );
}

// ── Sección: Escrow ────────────────────────────────────────────────
function EscrowSection() {
    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
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
                        <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0"><Lock className="w-3.5 h-3.5 text-amber-400" /></div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-200 truncate">AURA Pro — Domina el resize inteligente</p>
                            <p className="text-[10px] text-muted-text">4/10 imágenes · 100 XLM</p>
                        </div>
                        <span className="text-xs text-amber-400 font-bold shrink-0">40%</span>
                    </div>
                </div>
                <a href="https://laboratory.stellar.org/#explorer?resource=claimable_balances&endpoint=all&network=test" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-accent/30 text-accent text-xs font-medium hover:bg-accent/10 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Ver en Stellar Explorer
                </a>
            </div>
        </div>
    );
}

// ── Sección: GitHub ────────────────────────────────────────────────
function GitHubSection() {
    const [connected, setConnected] = useState(false);
    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="p-2 rounded-xl bg-slate-800"><Github className="w-5 h-5 text-white" /></div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-200">GitHub Connect</h2>
                    <p className="text-xs text-muted-text">Importa tus proyectos para entrenar a tu IA</p>
                </div>
                {connected && <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">Conectado</span>}
            </div>
            <div className="p-5">
                {!connected ? (
                    <button onClick={() => setConnected(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-all w-full justify-center">
                        <Github className="w-4 h-4" /> Conectar con GitHub
                    </button>
                ) : (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><Github className="w-4 h-4" /></div>
                            <div>
                                <p className="text-xs font-bold text-white">sanvalencia2828</p>
                                <p className="text-[10px] text-emerald-400 font-medium">Sincronización activa</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Sección: Skills ────────────────────────────────────────────────
const SKILL_OPTIONS = [
    "Python", "TypeScript", "Rust", "Solidity", "AI / Machine Learning", "LLM / Agents",
    "Stellar", "Blockchain", "DeFi", "Web3", "Docker", "FastAPI", "Next.js", "React",
    "PostgreSQL", "Redis", "Data Analytics",
];

function SkillsSection() {
    const [selected, setSelected] = useState<string[]>(["Python", "Stellar", "AI / Machine Learning"]);
    const [saved, setSaved] = useState(false);

    const toggle = (skill: string) => {
        setSelected(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
        setSaved(false);
    };

    return (
        <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20"><Zap className="w-5 h-5 text-violet-400" /></div>
                <div><h2 className="font-semibold text-white">Perfil de Skills</h2><p className="text-xs text-slate-500">Usado por el Agent Crew para optimizar tu MarketMatch</p></div>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
                {SKILL_OPTIONS.map(skill => (
                    <button key={skill} onClick={() => toggle(skill)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${selected.includes(skill) ? "bg-accent/15 text-accent border-accent/40" : "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200"}`}>{skill}</button>
                ))}
            </div>
            <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm font-bold">{saved ? "✓ Guardado" : "Guardar skills"}</button>
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────
export default function SettingsPage() {
    const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

    return (
        <div className="p-6 min-h-screen">
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-xs font-medium text-accent uppercase tracking-widest">Configuración</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-1">Ajustes<span className="gradient-text"> & Identidad</span></h1>
                <p className="text-slate-400 text-sm">Administra tu identidad blockchain, skills e integraciones.</p>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }} className="max-w-2xl space-y-6">
                <motion.div variants={itemVariants}><WalletSection /></motion.div>
                <motion.div variants={itemVariants}><EscrowSection /></motion.div>
                <motion.div variants={itemVariants}><GitHubSection /></motion.div>
                <motion.div variants={itemVariants}><SkillsSection /></motion.div>
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
