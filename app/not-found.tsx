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

                <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
                    <Compass className="w-6 h-6 text-accent" />
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
                            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-background text-sm font-bold rounded-xl transition-all hover:bg-accent/90"
                        >
                            <Home className="w-4 h-4" />
                            Ir a Inicio
                        </motion.button>
                    </Link>
                    <button
                        onClick={() => window.history.back()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-slate-300 text-sm font-medium rounded-xl hover:bg-white/10 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
