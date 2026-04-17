"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Home, Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center max-w-md"
            >
                {/* Animated glitch number */}
                <motion.div
                    animate={{ opacity: [1, 0.8, 1], x: [0, -2, 2, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    className="text-8xl font-black text-accent/20 select-none mb-2"
                >
                    404
                </motion.div>

                <div className="w-14 h-14 rounded-2xl card-premium flex items-center justify-center mx-auto mb-5 pulse-glow">
                    <Compass className="w-7 h-7 text-accent" />
                </div>

                <h1 className="text-2xl font-bold text-white mb-2">
                    Página no encontrada
                </h1>
                <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                    Esta ruta no existe en Xiimalab. Puede que el link esté roto
                    o la sección aún no se haya construido.
                </p>

                <div className="flex items-center justify-center gap-3">
                    <Link href="/">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
                        >
                            <Home className="w-4 h-4" />
                            Ir a Inicio
                        </motion.button>
                    </Link>
                    <button
                        onClick={() => window.history.back()}
                        className="btn-ghost flex items-center gap-2 px-5 py-2.5 text-slate-300 text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
