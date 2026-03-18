"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { syncHackathons } from "@/app/actions/sync";
import { useRouter } from "next/navigation";

export function SyncButton() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const router = useRouter();

    const handleSync = async () => {
        setIsSyncing(true);
        setStatus("idle");
        
        try {
            const result = await syncHackathons();
            if (result.status === "success") {
                setStatus("success");
                router.refresh(); // Refresh the page data
                setTimeout(() => setStatus("idle"), 3000);
            } else {
                setStatus("error");
                console.error("Sync error:", result.message);
            }
        } catch (error) {
            setStatus("error");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`
                flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300
                ${isSyncing 
                    ? "bg-blue-500/20 text-blue-400 cursor-not-allowed" 
                    : status === "success"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : status === "error"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-blue-500/50 shadow-lg shadow-black/20"
                }
            `}
        >
            {isSyncing ? (
                <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sincronizando...</span>
                </>
            ) : status === "success" ? (
                <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Sincronizado!</span>
                </>
            ) : status === "error" ? (
                <>
                    <AlertCircle className="w-4 h-4" />
                    <span>Reintenta</span>
                </>
            ) : (
                <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Sincronizar DoraHacks</span>
                </>
            )}
        </button>
    );
}
