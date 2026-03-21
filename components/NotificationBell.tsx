"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bell, X, Trophy, Clock, Target, Zap, CheckCircle2,
    AlertCircle, Loader2, RefreshCw, ExternalLink
} from "lucide-react";

interface Notification {
    id: number;
    type: string;
    hackathon_id?: string;
    message: string;
    created_at: string;
    is_read: boolean;
}

interface NotificationBellProps {
    walletAddress?: string;
    onNotificationClick?: (notification: Notification) => void;
}

export default function NotificationBell({ 
    walletAddress, 
    onNotificationClick 
}: NotificationBellProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const loadNotifications = useCallback(async () => {
        if (!walletAddress) return;
        
        setLoading(true);
        try {
            
            const response = await fetch(`/api/notifications/${walletAddress}`);
            
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.pending || []);
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error("Error loading notifications:", error);
            // Fallback: cargar de localStorage
            const saved = localStorage.getItem("user_notifications");
            if (saved) {
                setNotifications(JSON.parse(saved));
            }
        }
        setLoading(false);
    }, [walletAddress]);

    useEffect(() => {
        if (walletAddress) {
            loadNotifications();
            
            // Poll cada 5 minutos
            const interval = setInterval(loadNotifications, 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [walletAddress, loadNotifications]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const markAsRead = async (ids: number[]) => {
        if (!walletAddress) return;
        
        try {
            
            await fetch(`/api/notifications/${walletAddress}/mark-read`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notification_ids: ids }),
            });
            
            setNotifications(prev => prev.map(n => 
                ids.includes(n.id) ? { ...n, is_read: true } : n
            ));
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case "urgency": return <Clock className="w-4 h-4 text-rose-400" />;
            case "high_match": return <Target className="w-4 h-4 text-emerald-400" />;
            case "deadline": return <AlertCircle className="w-4 h-4 text-amber-400" />;
            default: return <Zap className="w-4 h-4 text-accent" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "urgency": return "Urgente";
            case "high_match": return "Match";
            case "deadline": return "Deadline";
            default: return "Info";
        }
    };

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
            >
                <Bell className="w-5 h-5 text-slate-400" />
                
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                    >
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </motion.span>
                )}
            </button>

            {/* Dropdown Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        
                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-border">
                                <div className="flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-accent" />
                                    <h3 className="text-sm font-bold text-white">Notificaciones</h3>
                                    {unreadCount > 0 && (
                                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-bold rounded-full">
                                            {unreadCount} nuevas
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={loadNotifications}
                                        className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                        disabled={loading}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                                    </button>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="max-h-96 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <EmptyState />
                                ) : (
                                    <div className="p-2 space-y-2">
                                        {notifications.map((notif, idx) => (
                                            <motion.div
                                                key={notif.id}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className={`p-3 rounded-xl border transition-all cursor-pointer hover:bg-white/5 ${
                                                    notif.is_read 
                                                        ? "bg-transparent border-white/5 opacity-60" 
                                                        : "bg-white/5 border-accent/20"
                                                }`}
                                                onClick={() => {
                                                    if (!notif.is_read) {
                                                        markAsRead([notif.id]);
                                                    }
                                                    onNotificationClick?.(notif);
                                                    setIsOpen(false);
                                                }}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-1.5 rounded-lg ${
                                                        notif.type === "urgency" ? "bg-rose-500/10" :
                                                        notif.type === "high_match" ? "bg-emerald-500/10" :
                                                        "bg-accent/10"
                                                    }`}>
                                                        {getIcon(notif.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-slate-200 leading-relaxed">
                                                            {notif.message}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                                notif.type === "urgency" ? "bg-rose-500/10 text-rose-400" :
                                                                notif.type === "high_match" ? "bg-emerald-500/10 text-emerald-400" :
                                                                "bg-accent/10 text-accent"
                                                            }`}>
                                                                {getTypeLabel(notif.type)}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500">
                                                                {formatTime(notif.created_at)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {!notif.is_read && (
                                                        <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            {notifications.length > 0 && (
                                <div className="p-3 border-t border-border">
                                    <button
                                        onClick={() => {
                                            const allIds = notifications.map(n => n.id);
                                            markAsRead(allIds);
                                        }}
                                        className="w-full py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                    >
                                        Marcar todas como leídas
                                    </button>
                                </div>
                            )}

                            {/* Last update */}
                            {lastUpdate && (
                                <div className="px-4 pb-2 text-[10px] text-slate-600">
                                    Actualizado: {lastUpdate.toLocaleTimeString("es")}
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-300">¡Todo al día!</p>
            <p className="text-xs text-slate-500 mt-1">
                No hay notificaciones pendientes
            </p>
        </div>
    );
}

function formatTime(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return "Ahora";
        if (minutes < 60) return `Hace ${minutes}m`;
        if (hours < 24) return `Hace ${hours}h`;
        if (days < 7) return `Hace ${days}d`;
        
        return date.toLocaleDateString("es", { day: "numeric", month: "short" });
    } catch {
        return "";
    }
}
