"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Wallet, AlertCircle, Loader2, CheckCircle2,
    Brain, Target, Zap, ArrowRight, Shield,
    ChevronRight,
} from "lucide-react";
import { useWallet } from "@/lib/WalletContext";
import { useRouter } from "next/navigation";

// ── Helpers ───────────────────────────────────────────────────────────
function isStellarPubKey(key: string) {
    return /^G[A-Z2-7]{55}$/.test(key.trim());
}

// ── Feature Cards (left panel) ────────────────────────────────────────
const FEATURES = [
    {
        icon: Brain,
        title: "Agent Crew",
        desc: "IA multiagente monitorea oportunidades en tiempo real.",
        color: "sky",
    },
    {
        icon: Target,
        title: "Market Match",
        desc: "Empareja tus skills con hackathons y roles del mercado.",
        color: "violet",
    },
    {
        icon: Zap,
        title: "Proof of Skill",
        desc: "Certifica logros en blockchain con escrow Stellar.",
        color: "amber",
    },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    sky:    { bg: "rgba(14,165,233,0.07)",   border: "rgba(14,165,233,0.18)",   text: "#38bdf8", icon: "rgba(14,165,233,0.15)" },
    violet: { bg: "rgba(139,92,246,0.07)",   border: "rgba(139,92,246,0.18)",   text: "#a78bfa", icon: "rgba(139,92,246,0.15)" },
    amber:  { bg: "rgba(245,158,11,0.07)",   border: "rgba(245,158,11,0.18)",   text: "#fbbf24", icon: "rgba(245,158,11,0.15)" },
};

// ── Step Indicator ────────────────────────────────────────────────────
function StepDot({ active, done }: { active: boolean; done: boolean }) {
    return (
        <div
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
                background: done || active ? "#38bdf8" : "rgba(255,255,255,0.12)",
                boxShadow: active ? "0 0 8px rgba(56,189,248,0.6)" : "none",
                transform: active ? "scale(1.3)" : "scale(1)",
            }}
        />
    );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function LoginPage() {
    const router = useRouter();
    const { isConnected, connect } = useWallet();

    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [walletKey, setWalletKey] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (isConnected) router.replace("/");
    }, [isConnected, router]);

    const handleStep1 = () => setStep(2);

    const handleConnect = async () => {
        const key = walletKey.trim().toUpperCase();
        if (!isStellarPubKey(key)) {
            setError("La clave debe comenzar con G y tener 56 caracteres (formato Stellar).");
            return;
        }
        setError("");
        setSaving(true);
        await new Promise(r => setTimeout(r, 800));
        connect(key, name.trim() || undefined);
        setSaving(false);
        setDone(true);
        setTimeout(() => router.replace("/"), 1200);
    };

    return (
        <div
            className="min-h-screen flex"
            style={{ background: "#030712", fontFamily: "'Inter', system-ui, sans-serif" }}
        >
            {/* ── LEFT PANEL ─────────────────────────────────────── */}
            <div
                className="hidden lg:flex flex-col justify-between w-[58%] relative overflow-hidden p-12"
                style={{
                    background: "linear-gradient(135deg, #030712 0%, #050e1a 100%)",
                    borderRight: "1px solid rgba(255,255,255,0.04)",
                }}
            >
                {/* Grid background */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: `
                            linear-gradient(rgba(56,189,248,0.035) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(56,189,248,0.035) 1px, transparent 1px)
                        `,
                        backgroundSize: "48px 48px",
                    }}
                />
                {/* Radial glows */}
                <div className="absolute inset-0 pointer-events-none">
                    <div style={{
                        position: "absolute", top: "-10%", left: "-10%",
                        width: "60%", height: "60%",
                        background: "radial-gradient(ellipse, rgba(56,189,248,0.07) 0%, transparent 70%)",
                    }} />
                    <div style={{
                        position: "absolute", bottom: "0", right: "0",
                        width: "50%", height: "50%",
                        background: "radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 70%)",
                    }} />
                </div>

                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative flex items-center gap-3"
                >
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: "rgba(56,189,248,0.08)",
                        border: "1px solid rgba(56,189,248,0.18)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <img src="/xiimalab-logo.png" alt="Xiimalab" style={{ width: 28, height: 28, objectFit: "contain" }} />
                    </div>
                    <span style={{
                        fontSize: 18, fontWeight: 700,
                        background: "linear-gradient(135deg, #7dd3fc 0%, #38bdf8 40%, #818cf8 100%)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    }}>
                        Xiimalab
                    </span>
                </motion.div>

                {/* Hero copy */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative"
                >
                    <p style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
                        textTransform: "uppercase", color: "rgba(56,189,248,0.7)", marginBottom: 16,
                    }}>
                        Plataforma de Inteligencia
                    </p>
                    <h1 style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.1, color: "#f1f5f9", letterSpacing: "-1px", marginBottom: 20 }}>
                        Tu copiloto de{" "}
                        <span style={{
                            background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        }}>
                            AI & Web3
                        </span>
                    </h1>
                    <p style={{ fontSize: 16, color: "rgba(148,163,184,0.85)", lineHeight: 1.6, maxWidth: 420 }}>
                        Conecta tu wallet Stellar para acceder a inteligencia de mercado, matchmaking con hackathons y certificación de habilidades en blockchain.
                    </p>

                    {/* Feature cards */}
                    <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 12 }}>
                        {FEATURES.map((f, i) => {
                            const c = COLOR_MAP[f.color];
                            return (
                                <motion.div
                                    key={f.title}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + i * 0.1 }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 14,
                                        padding: "14px 18px",
                                        background: c.bg,
                                        border: `1px solid ${c.border}`,
                                        borderRadius: 14,
                                        backdropFilter: "blur(8px)",
                                    }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10,
                                        background: c.icon,
                                        border: `1px solid ${c.border}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        flexShrink: 0,
                                    }}>
                                        <f.icon size={17} color={c.text} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>{f.title}</p>
                                        <p style={{ fontSize: 11.5, color: "rgba(148,163,184,0.75)", lineHeight: 1.4 }}>{f.desc}</p>
                                    </div>
                                    <ChevronRight size={14} color="rgba(148,163,184,0.3)" style={{ marginLeft: "auto" }} />
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    style={{ fontSize: 11, color: "rgba(100,116,139,0.6)", position: "relative" }}
                >
                    © 2025 Xiimalab · AI · Blockchain · Web3
                </motion.p>
            </div>

            {/* ── RIGHT PANEL ────────────────────────────────────── */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
                <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 400, height: 400,
                    background: "radial-gradient(ellipse, rgba(56,189,248,0.06) 0%, transparent 70%)",
                    pointerEvents: "none",
                }} />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{
                        width: "100%", maxWidth: 420,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 24,
                        backdropFilter: "blur(20px)",
                        padding: 36,
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {/* Card top shine */}
                    <div style={{
                        position: "absolute", top: 0, left: "10%", right: "10%",
                        height: 1,
                        background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.3), transparent)",
                    }} />

                    {/* Mobile logo */}
                    <div className="flex lg:hidden items-center gap-2.5 mb-8">
                        <img src="/xiimalab-logo.png" alt="Xiimalab" style={{ width: 28, height: 28, objectFit: "contain" }} />
                        <span style={{
                            fontSize: 16, fontWeight: 700,
                            background: "linear-gradient(135deg, #7dd3fc, #818cf8)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        }}>Xiimalab</span>
                    </div>

                    {/* Step dots */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
                        <StepDot active={step === 1} done={step > 1 || done} />
                        <div style={{ height: 1, width: 20, background: step > 1 ? "rgba(56,189,248,0.5)" : "rgba(255,255,255,0.1)", transition: "all 0.3s" }} />
                        <StepDot active={step === 2} done={done} />
                        <p style={{ marginLeft: "auto", fontSize: 11, color: "rgba(100,116,139,0.7)", fontWeight: 500 }}>
                            Paso {step} de 2
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {done ? (
                            <motion.div
                                key="done"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{ textAlign: "center", padding: "24px 0" }}
                            >
                                <div style={{
                                    width: 64, height: 64, borderRadius: "50%",
                                    background: "rgba(52,211,153,0.1)",
                                    border: "1px solid rgba(52,211,153,0.3)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    margin: "0 auto 20px",
                                    boxShadow: "0 0 30px rgba(52,211,153,0.2)",
                                }}>
                                    <CheckCircle2 size={28} color="#34d399" />
                                </div>
                                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
                                    ¡Wallet vinculada!
                                </h2>
                                <p style={{ fontSize: 13, color: "rgba(148,163,184,0.7)" }}>
                                    Redirigiendo a tu dashboard…
                                </p>
                            </motion.div>
                        ) : step === 1 ? (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -16 }}
                                transition={{ duration: 0.25 }}
                            >
                                <div style={{ marginBottom: 6 }}>
                                    <Wallet size={22} color="#38bdf8" />
                                </div>
                                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 6, lineHeight: 1.2 }}>
                                    Conecta tu identidad
                                </h2>
                                <p style={{ fontSize: 13.5, color: "rgba(148,163,184,0.7)", marginBottom: 28, lineHeight: 1.5 }}>
                                    Empieza con un alias. Tu wallet Stellar la vincularás en el siguiente paso.
                                </p>

                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "rgba(148,163,184,0.8)", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                                        Nombre o alias
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && handleStep1()}
                                        placeholder="ej. Santiago Valencia"
                                        autoFocus
                                        style={{
                                            width: "100%", padding: "12px 16px",
                                            background: "rgba(255,255,255,0.04)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            borderRadius: 12, fontSize: 14, color: "#f1f5f9",
                                            outline: "none", transition: "border-color 0.2s", fontFamily: "inherit",
                                        }}
                                        onFocus={e => (e.target.style.borderColor = "rgba(56,189,248,0.4)")}
                                        onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                                    />
                                    <p style={{ fontSize: 11, color: "rgba(100,116,139,0.6)", marginTop: 6 }}>
                                        Opcional — puedes saltarte este paso.
                                    </p>
                                </div>

                                <button
                                    onClick={handleStep1}
                                    style={{
                                        width: "100%", padding: "13px 20px",
                                        background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
                                        border: "none", borderRadius: 12,
                                        fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                        boxShadow: "0 4px 20px rgba(14,165,233,0.3)", transition: "all 0.2s",
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 30px rgba(14,165,233,0.5)";
                                        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(14,165,233,0.3)";
                                        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                                    }}
                                >
                                    Continuar <ArrowRight size={16} />
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -16 }}
                                transition={{ duration: 0.25 }}
                            >
                                <div style={{ marginBottom: 6 }}>
                                    <Shield size={22} color="#38bdf8" />
                                </div>
                                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 6, lineHeight: 1.2 }}>
                                    Tu clave pública
                                </h2>
                                <p style={{ fontSize: 13.5, color: "rgba(148,163,184,0.7)", marginBottom: 28, lineHeight: 1.5 }}>
                                    Ingresa tu clave pública Stellar. Nunca pedimos la clave privada.
                                </p>

                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "rgba(148,163,184,0.8)", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                                        Clave pública Stellar *
                                    </label>
                                    <input
                                        type="text"
                                        value={walletKey}
                                        onChange={e => { setWalletKey(e.target.value); setError(""); }}
                                        onKeyDown={e => e.key === "Enter" && handleConnect()}
                                        placeholder="GXXXXXXXX…"
                                        autoFocus
                                        style={{
                                            width: "100%", padding: "12px 16px",
                                            background: error ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.04)",
                                            border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`,
                                            borderRadius: 12, fontSize: 12.5,
                                            color: error ? "#fca5a5" : "#f1f5f9",
                                            outline: "none", fontFamily: "'JetBrains Mono', monospace",
                                            transition: "border-color 0.2s", letterSpacing: "0.02em",
                                        }}
                                        onFocus={e => !error && (e.target.style.borderColor = "rgba(56,189,248,0.4)")}
                                        onBlur={e => !error && (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                                    />
                                    {error && (
                                        <p style={{ fontSize: 11, color: "#f87171", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                            <AlertCircle size={11} /> {error}
                                        </p>
                                    )}
                                    <p style={{ fontSize: 11, color: "rgba(100,116,139,0.6)", marginTop: 6 }}>
                                        ¿No tienes wallet?{" "}
                                        <a href="https://stellar.org/learn/stellar-wallets" target="_blank" rel="noopener noreferrer"
                                            style={{ color: "#38bdf8", textDecoration: "none" }}>
                                            Crea una gratis →
                                        </a>
                                    </p>
                                </div>

                                <div style={{
                                    display: "flex", gap: 10, padding: "10px 14px",
                                    background: "rgba(139,92,246,0.06)",
                                    border: "1px solid rgba(139,92,246,0.15)",
                                    borderRadius: 10, marginBottom: 20,
                                }}>
                                    <Shield size={13} color="#a78bfa" style={{ flexShrink: 0, marginTop: 1 }} />
                                    <p style={{ fontSize: 11, color: "rgba(148,163,184,0.65)", lineHeight: 1.5 }}>
                                        Solo la clave pública — tus fondos están siempre seguros.
                                    </p>
                                </div>

                                <div style={{ display: "flex", gap: 10 }}>
                                    <button
                                        onClick={() => setStep(1)}
                                        style={{
                                            padding: "13px 18px",
                                            background: "rgba(255,255,255,0.04)",
                                            border: "1px solid rgba(255,255,255,0.09)",
                                            borderRadius: 12, fontSize: 13, fontWeight: 600,
                                            color: "rgba(148,163,184,0.75)", cursor: "pointer",
                                            transition: "all 0.2s", whiteSpace: "nowrap",
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
                                    >
                                        ← Volver
                                    </button>
                                    <button
                                        onClick={handleConnect}
                                        disabled={saving || !walletKey}
                                        style={{
                                            flex: 1, padding: "13px 20px",
                                            background: saving || !walletKey ? "rgba(14,165,233,0.3)" : "linear-gradient(135deg, #0ea5e9, #0284c7)",
                                            border: "none", borderRadius: 12,
                                            fontSize: 14, fontWeight: 700, color: "#fff",
                                            cursor: saving || !walletKey ? "not-allowed" : "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                            boxShadow: saving || !walletKey ? "none" : "0 4px 20px rgba(14,165,233,0.3)",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        {saving ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <>Vincular Wallet <ArrowRight size={15} /></>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!done && (
                        <p style={{ fontSize: 11, color: "rgba(100,116,139,0.45)", textAlign: "center", marginTop: 24 }}>
                            Al continuar aceptas los{" "}
                            <span style={{ color: "rgba(56,189,248,0.6)" }}>Términos de uso</span>
                        </p>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
