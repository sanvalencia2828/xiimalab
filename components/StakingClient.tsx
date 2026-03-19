"use client";

import { motion } from "framer-motion";
import { Coins, Trophy, Calendar, ExternalLink, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface Escrow {
    id: string;
    title: string;
    amount: number;
    deadline: string;
    status: "active" | "completed" | "released";
    progress: number;
}

interface StakingClientProps {
    initialData: {
        escrows?: Escrow[];
        totalStaked?: number;
        rewards?: number;
    } | null;
    userId: string;
}

export default function StakingClient({ initialData, userId }: StakingClientProps) {
    const escrows = initialData?.escrows || [];
    const totalStaked = initialData?.totalStaked || 0;
    const rewards = initialData?.rewards || 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-2xl p-5"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Coins className="w-5 h-5 text-amber-400" />
                        </div>
                        <span className="text-xs text-slate-500">Total Staked</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{totalStaked} XiiMA</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-card border border-border rounded-2xl p-5"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-xs text-slate-500">Recompensas</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">+{rewards} XiiMA</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card border border-border rounded-2xl p-5"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-purple-400" />
                        </div>
                        <span className="text-xs text-slate-500">Próximo desbloqueo</span>
                    </div>
                    <p className="text-2xl font-bold text-white">--</p>
                </motion.div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-card border border-border rounded-2xl p-6"
            >
                <h3 className="text-lg font-bold text-white mb-4">Escrows Activos</h3>
                
                {escrows.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                            <Coins className="w-8 h-8 text-slate-600" />
                        </div>
                        <p className="text-slate-400 mb-2">No hay escrows activos</p>
                        <p className="text-xs text-slate-500">Completa hitos educacionales para desbloquear staking</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {escrows.map((escrow) => (
                            <div key={escrow.id} className="p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            escrow.status === "completed" ? "bg-emerald-500/20" : "bg-amber-500/20"
                                        }`}>
                                            {escrow.status === "completed" ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            ) : (
                                                <Trophy className="w-5 h-5 text-amber-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{escrow.title}</p>
                                            <p className="text-xs text-slate-500">{escrow.amount} XiiMA</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        escrow.status === "completed" 
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : "bg-amber-500/20 text-amber-400"
                                    }`}>
                                        {escrow.status === "completed" ? "Completado" : "Activo"}
                                    </span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${escrow.progress}%` }}
                                        transition={{ duration: 0.5 }}
                                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card border border-border rounded-2xl p-6"
            >
                <h3 className="text-lg font-bold text-white mb-4">¿Cómo funciona?</h3>
                <div className="space-y-3">
                    {[
                        { step: 1, title: "Stake XiiMA", desc: "Bloquea tokens para demostrar compromiso" },
                        { step: 2, title: "Completa hitos", desc: "Finaliza cursos y proyectos educacionales" },
                        { step: 3, title: "Recibe recompensas", desc: "Desbloquea tokens + bonuses por logros" },
                    ].map((item) => (
                        <div key={item.step} className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-accent">{item.step}</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">{item.title}</p>
                                <p className="text-xs text-slate-500">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <Link
                    href="/skills"
                    className="mt-4 flex items-center justify-center gap-2 py-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg transition-colors"
                >
                    <ExternalLink className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-accent">Explorar hitos disponibles</span>
                </Link>
            </motion.div>
        </div>
    );
}
