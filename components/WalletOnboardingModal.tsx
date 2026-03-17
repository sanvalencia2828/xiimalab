"use client";

/**
 * WalletOnboardingModal.tsx
 * Modal "Wallet-First": aparece cuando el usuario accede a /hackatones
 * sin tener su clave Stellar configurada.
 * - Puede ignorarse → redirige a /settings
 * - Puede cerrar → sigue sin personalización
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
    Wallet, Sparkles, ArrowRight, X,
    ShieldCheck, Zap, TrendingUp,
} from "lucide-react";
import { useWallet } from "@/lib/WalletContext";

const BENEFITS = [
    { icon: TrendingUp, text: "Match personalizado ML basado en tu stack real" },
    { icon: Zap,        text: "Pagos automáticos al completar milestones (Stellar)" },
    { icon: ShieldCheck,text: "Escrow educativo — tus fondos seguros en Blockchain" },
];

export default function WalletOnboardingModal() {
    const { isConnected } = useWallet();
    const router           = useRouter();
    const [open, setOpen]  = useState(false);

    // Mostrar solo si no está conectado y no lo ha ignorado esta sesión
    useEffect(() => {
        if (!isConnected) {
            const ignored = sessionStorage.getItem("wallet_modal_ignored");
            if (!ignored) setOpen(true);
        }
    }, [isConnected]);

    const handleIgnore = () => {
        sessionStorage.setItem("wallet_modal_ignored", "1");
        setOpen(false);
    };

    const handleGoToSettings = () => {
        sessionStorage.setItem("wallet_modal_ignored", "1");
        setOpen(false);
        router.push("/settings");
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleIgnore}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        key="modal"
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                    >
                        <div className="pointer-events-auto w-full max-w-md bg-card border border-border rounded-3xl p-7 shadow-2xl relative overflow-hidden">
                            {/* Glow top */}
                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

                            {/* Close */}
                            <button
                                onClick={handleIgnore}
                                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            {/* Icon */}
                            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 mx-auto mb-5">
                                <Wallet className="w-7 h-7 text-accent" />
                            </div>

                            {/* Title */}
                            <h2 className="text-xl font-bold text-white text-center mb-2">
                                Conecta tu Wallet Stellar
                            </h2>
                            <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed">
                                Sin tu llave pública de Stellar no podemos calcular tu{" "}
                                <span className="text-accent font-semibold">MarketMatch personalizado</span>{" "}
                                ni preparar tu escrow educativo (Proof of Skill).
                            </p>

                            {/* Benefits */}
                            <div className="space-y-3 mb-7">
                                {BENEFITS.map(({ icon: Icon, text }) => (
                                    <div key={text} className="flex items-start gap-3">
                                        <div className="shrink-0 w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                                            <Icon className="w-3.5 h-3.5 text-accent" />
                                        </div>
                                        <p className="text-sm text-slate-300 leading-snug">{text}</p>
                                    </div>
                                ))}
                            </div>

                            {/* CTAs */}
                            <div className="flex flex-col gap-2">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleGoToSettings}
                                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Configurar mi Wallet
                                    <ArrowRight className="w-4 h-4" />
                                </motion.button>
                                <button
                                    onClick={handleIgnore}
                                    className="text-xs text-slate-500 hover:text-slate-300 py-2 transition-colors"
                                >
                                    Continuar sin personalizar
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
