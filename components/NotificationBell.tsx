"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCircle2, Clock, ExternalLink, RefreshCw, X } from "lucide-react";
import { describeClosing } from "@/lib/hackathons/format";
import type { ClosingNotification, ClosingResult } from "@/lib/notifications/closing";

export const NOTIFICATIONS_READ_KEY = "xiimalab_notifications_read";
const REFRESH_MS = 10 * 60 * 1000;
// Las leídas se guardan por id; se conservan solo las últimas para no crecer sin fin
const MAX_READ_IDS = 300;

function readIds(): string[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(NOTIFICATIONS_READ_KEY) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
        return [];
    }
}

/** "Cierra mañana · AIC Internal Competition · 85 % match" */
function message(n: ClosingNotification): string {
    return `${describeClosing(n.deadline).label} · ${n.title} · ${n.matchScore} % match`;
}

/** Campana del menú: convocatorias que cierran en 72 h y encajan con tus skills. */
export default function NotificationBell() {
    const [notifications, setNotifications] = useState<ClosingNotification[]>([]);
    const [read, setRead] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/notifications/closing");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as ClosingResult;
            setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
            setFailed(data.origin === "none");
        } catch {
            setFailed(true);
        }
        setRead(readIds());
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, REFRESH_MS);
        return () => clearInterval(interval);
    }, [load]);

    const markAsRead = (ids: string[]) => {
        const merged = Array.from(new Set([...readIds(), ...ids])).slice(-MAX_READ_IDS);
        try {
            localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(merged));
        } catch { /* almacenamiento bloqueado: se marca solo en esta sesión */ }
        setRead(merged);
    };

    const unread = notifications.filter((n) => !read.includes(n.id));

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-label={unread.length > 0 ? `Notificaciones: ${unread.length} sin leer` : "Notificaciones"}
                aria-expanded={isOpen}
                className="relative p-2.5 card-premium"
            >
                <Bell className="w-5 h-5 text-slate-400" />
                {unread.length > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                    >
                        {unread.length > 9 ? "9+" : unread.length}
                    </motion.span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
                        >
                            <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-white">Cierran pronto</h3>
                                    <p className="text-[11px] text-muted-text">En las próximas 72 h, con más del 50 % de match</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={load}
                                        disabled={loading}
                                        aria-label="Actualizar"
                                        className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        aria-label="Cerrar"
                                        className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-96 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                        <p className="text-sm text-slate-300">
                                            {failed ? "No se pudieron consultar las convocatorias" : "Nada cierra en las próximas 72 h"}
                                        </p>
                                        <p className="text-xs text-muted-text mt-1">
                                            {failed ? "Vuelve a intentarlo en unos minutos." : "Te avisaremos cuando una convocatoria que encaje contigo esté por cerrar."}
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="p-2 space-y-2">
                                        {notifications.map((n, index) => {
                                            const isRead = read.includes(n.id);
                                            const closing = describeClosing(n.deadline);
                                            return (
                                                <motion.li
                                                    key={n.id}
                                                    initial={{ opacity: 0, x: 16 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.2, ease: "easeOut" }}
                                                    className={`p-3 rounded-xl border ${isRead ? "border-white/5 opacity-60" : "border-accent/20 bg-white/5"}`}
                                                >
                                                    <div className="flex items-start gap-2.5">
                                                        <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${closing.urgent ? "text-rose-400" : "text-amber-400"}`} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm text-slate-200 leading-snug" suppressHydrationWarning>{message(n)}</p>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]">
                                                                <span className="text-muted-text">{n.kind === "bounty" ? "Bounty" : "Hackatón"}</span>
                                                                {n.url && (
                                                                    <a
                                                                        href={n.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={() => markAsRead([n.id])}
                                                                        className="inline-flex items-center gap-1 text-accent hover:underline"
                                                                    >
                                                                        Abrir
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </a>
                                                                )}
                                                                {!isRead && (
                                                                    <button type="button" onClick={() => markAsRead([n.id])} className="text-slate-400 hover:text-white">
                                                                        Marcar como leída
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            {unread.length > 0 && (
                                <div className="p-3 border-t border-border">
                                    <button
                                        type="button"
                                        onClick={() => markAsRead(unread.map((n) => n.id))}
                                        className="w-full text-xs text-slate-400 hover:text-white"
                                    >
                                        Marcar todas como leídas
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
