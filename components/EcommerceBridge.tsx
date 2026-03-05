"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ArrowRight, Sparkles, Zap } from "lucide-react";

// -------------------------------------------------------
// COMPONENT
// -------------------------------------------------------
export default function EcommerceBridge() {
    const [hovered, setHovered] = useState(false);
    const [clicked, setClicked] = useState(false);

    function handleClick() {
        setClicked(true);
        setTimeout(() => setClicked(false), 1200);
    }

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            {/* Header */}
            <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Xiima Ecommerce</h3>
                </div>
                <p className="text-xs text-muted-text leading-relaxed">
                    Bridge hacia la plataforma de productos y servicios digitales de Xiima. Conecta tus proyectos IA con el mercado real.
                </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mb-5">
                {["NFT Marketplace", "AI Tools", "Templates", "Consulting"].map((f) => (
                    <span
                        key={f}
                        className="text-xs px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium"
                    >
                        {f}
                    </span>
                ))}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                    { label: "Productos", value: "—" },
                    { label: "Revenue", value: "$0" },
                    { label: "Clientes", value: "0" },
                ].map(({ label, value }) => (
                    <div key={label} className="text-center py-2.5 rounded-xl bg-background border border-border">
                        <p className="text-base font-bold text-white">{value}</p>
                        <p className="text-xs text-muted-text">{label}</p>
                    </div>
                ))}
            </div>

            {/* CTA Button — main micro-interaction */}
            <motion.button
                onClick={handleClick}
                onHoverStart={() => setHovered(true)}
                onHoverEnd={() => setHovered(false)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="relative w-full py-3.5 rounded-xl font-semibold text-sm overflow-hidden cursor-pointer select-none"
                style={{
                    background: hovered
                        ? "linear-gradient(135deg, #f59e0b, #d97706)"
                        : "linear-gradient(135deg, #92400e44, #b45309aa)",
                    border: "1px solid rgba(245,158,11,0.35)",
                    color: hovered ? "#030712" : "#fde68a",
                    boxShadow: hovered
                        ? "0 0 30px rgba(245,158,11,0.4), 0 0 60px rgba(245,158,11,0.15)"
                        : "0 0 12px rgba(245,158,11,0.1)",
                    transition: "background 0.3s, color 0.25s, box-shadow 0.3s",
                }}
            >
                {/* Shimmer overlay on hover */}
                <AnimatePresence>
                    {hovered && (
                        <motion.div
                            initial={{ x: "-100%", opacity: 0 }}
                            animate={{ x: "100%", opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="absolute inset-0 shimmer-bg pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                {/* Click ripple */}
                <AnimatePresence>
                    {clicked && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0.6 }}
                            animate={{ scale: 3.5, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                            className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-amber-400 pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                <span className="relative flex items-center justify-center gap-2">
                    <AnimatePresence mode="wait">
                        {clicked ? (
                            <motion.span
                                key="clicked"
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 8 }}
                                className="flex items-center gap-2"
                            >
                                <Sparkles className="w-4 h-4" />
                                ¡Próximamente!
                            </motion.span>
                        ) : (
                            <motion.span
                                key="idle"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="flex items-center gap-2"
                            >
                                <Zap className="w-4 h-4" />
                                Acceder al Ecommerce
                                <motion.span
                                    animate={{ x: hovered ? 4 : 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                    <ArrowRight className="w-4 h-4" />
                                </motion.span>
                            </motion.span>
                        )}
                    </AnimatePresence>
                </span>
            </motion.button>

            {/* Coming soon note */}
            <p className="text-center text-xs text-muted-text mt-3">
                Lanzamiento estimado — <span className="text-amber-400">Q3 2025</span>
            </p>
        </div>
    );
}
