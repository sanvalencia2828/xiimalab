"use client";

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
            </div>
        </div>
    );
}

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
