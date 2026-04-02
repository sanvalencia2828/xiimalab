"use client";

import { useEffect, useState } from "react";

export default function SystemStatus() {
    const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
    const [lastCheck, setLastCheck] = useState<Date | null>(null);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const fastapiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const res = await fetch(`${fastapiUrl}/api/health`, {
                    method: "GET",
                    cache: "no-store",
                });
                
                if (res.ok) {
                    setStatus("online");
                } else {
                    setStatus("offline");
                }
            } catch {
                setStatus("offline");
            }
            setLastCheck(new Date());
        };

        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg card-premium">
            {status === "checking" && (
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                    <span className="text-[10px] text-slate-500 font-mono">CHECK...</span>
                </div>
            )}

            {status === "online" && (
                <div className="flex items-center gap-1.5" title={`Última verificación: ${lastCheck?.toLocaleTimeString()}`}>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium font-mono">API: ONLINE</span>
                </div>
            )}

            {status === "offline" && (
                <div className="flex items-center gap-1.5" title="API no responde">
                    <span className="w-2 h-2 rounded-full bg-rose-500 glow-rose" />
                    <span className="text-[10px] text-rose-400 font-medium font-mono">API: OFFLINE</span>
                </div>
            )}
        </div>
    );
}
