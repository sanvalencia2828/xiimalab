"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, UploadCloud, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useRouter } from "next/navigation";
import { processImageAction } from "@/app/actions/aura";

type AuraState = "idle" | "uploading" | "processing" | "success" | "missing_wallet";

export default function AuraUploader() {
    const [state, setState] = useState<AuraState>("idle");
    const [dragActive, setDragActive] = useState(false);
    const { studentAddress, isLoaded } = useWallet();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileProcess = async (file: File) => {
        if (!isLoaded) return;
        
        if (!studentAddress) {
            setState("missing_wallet");
            setTimeout(() => router.push("/settings"), 2500);
            return;
        }

        // Fake formData packaging 
        const formData = new FormData();
        formData.append("image", file);

        setState("processing");
        const result = await processImageAction(formData, studentAddress);
        
        if (result.success) {
            setState("success");
            setTimeout(() => setState("idle"), 4000); // Back to normal after a while gracefully
        } else {
            console.error("Error procesando con AURA:", result.error);
            setState("idle");
        }
    };

    // UI Handle events
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await handleFileProcess(e.dataTransfer.files[0]);
        }
    };

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            await handleFileProcess(e.target.files[0]);
        }
    };

    return (
        <section className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
            {/* Fondo visual estático para diseño */}
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <ImageIcon size={120} />
            </div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full w-max text-xs font-semibold tracking-wider uppercase mb-4">
                    Herramienta Interna
                </div>
                
                <h3 className="text-2xl font-bold mb-2">Proyecto AURA</h3>
                <p className="text-purple-200 mb-6 max-w-sm text-sm">
                    AURA es el módulo donde integramos las aportaciones de engagement. Su función primordial es aplicar redimensionamiento inteligente a estos formatos para impulsar tu primera publicación, permitiendo sostener contenido continuo que llegará a Xiimalab para mostrar los proyectos que estamos escalando.
                </p>

                {/* Drag and Drop Zone interactiva */}
                <form 
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => { if(state === 'idle') fileInputRef.current?.click(); }}
                    className={`mt-auto relative rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-6 cursor-pointer overflow-hidden ${
                        dragActive 
                            ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                            : state === "missing_wallet"
                            ? "border-amber-400 bg-amber-500/10"
                            : state === "processing" || state === "uploading"
                            ? "border-purple-400 bg-purple-500/20"
                            : state === "success"
                            ? "border-emerald-400 bg-emerald-500/20 cursor-default"
                            : "border-purple-300/30 bg-purple-900/40 hover:bg-purple-800/60 hover:border-purple-300/50"
                    }`}
                >
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        onChange={handleChange}
                        disabled={state !== "idle"}
                    />

                    <AnimatePresence mode="wait">
                        {state === "idle" && (
                            <motion.div 
                                key="idle"
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                                className="flex flex-col items-center text-center gap-2 pointer-events-none"
                            >
                                <div className={`p-3 rounded-full ${dragActive ? 'bg-emerald-500/20 text-emerald-400 scale-110 transition-transform' : 'bg-purple-500/20 text-purple-300'}`}>
                                    <UploadCloud className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-semibold text-purple-100">
                                        Arrastra una imagen o haz clic
                                    </p>
                                    <p className="text-xs text-purple-300/80 mt-1">PNG, JPG, WEBP (Máx. 5MB)</p>
                                </div>
                            </motion.div>
                        )}

                        {state === "processing" && (
                            <motion.div 
                                key="processing"
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center text-center gap-3 pointer-events-none"
                            >
                                <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
                                <div className="space-y-1">
                                    <p className="font-bold text-white tracking-wide">AURA Procesando (IA)...</p>
                                    <p className="text-xs text-purple-200">Ejecutando transferencia de estilo y recortes</p>
                                </div>
                            </motion.div>
                        )}

                        {state === "success" && (
                            <motion.div 
                                key="success"
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center text-center gap-2 pointer-events-none"
                            >
                                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-full">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <p className="font-bold text-emerald-300">¡Completado! +1 Hito</p>
                            </motion.div>
                        )}

                        {state === "missing_wallet" && (
                            <motion.div 
                                key="warning"
                                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center text-center gap-2 pointer-events-none"
                            >
                                <AlertCircle className="w-8 h-8 text-amber-400" />
                                <p className="font-bold text-amber-300">Conecta tu Wallet para Staking</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>
            </div>
        </section>
    );
}
