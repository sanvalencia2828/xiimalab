"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    LayoutDashboard,
    FolderKanban,
    Zap,
    BarChart3,
    ShoppingBag,
    Settings,
    Cpu,
    ChevronRight,
    Wallet,
    CheckCircle2,
    Brain,
    Target,
    Briefcase,
    Database,
    Menu,
    X,
} from "lucide-react";
import { useWallet } from "@/lib/WalletContext";

// -------------------------------------------------------
// NAV ITEMS CONFIG
// -------------------------------------------------------
const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Inicio" },
  { href: "/dashboard", icon: Cpu, label: "Dashboard Estudiante" },
  { href: "/skills", icon: Brain, label: "Skills" },
  { href: "/hackathons", icon: Zap, label: "Hackatones", badgeKey: "hackathons" },
  { href: "/aggregated", icon: Database, label: "Aggregated" },
  { href: "/portfolio", icon: Briefcase, label: "Portfolio" },
  { href: "/match", icon: BarChart3, label: "Market Match", badgeKey: "insights" },
  { href: "/profile", icon: Target, label: "Mi Perfil" },
  { href: "/ecommerce", icon: ShoppingBag, label: "Staking" },
  { href: "/projects", icon: FolderKanban, label: "Proyectos" },
  { href: "/settings", icon: Settings, label: "Configuración" },
];

// -------------------------------------------------------
// SIDEBAR NAV
// -------------------------------------------------------
export default function SidebarNav() {
    const pathname   = usePathname();
    const { isConnected, publicKey, displayName } = useWallet();
    const isLoaded = true; // WalletContext is always ready client-side
    const [badges, setBadges] = useState<Record<string, number>>({});
    const [isOpen, setIsOpen] = useState(false);

    // Fetch badge counts from Supabase on mount
    useEffect(() => {
        const fetchBadges = async () => {
            try {
                const res = await fetch("/api/insights/priorities?days_window=30");
                if (!res.ok) return;
                const data = await res.json();
                const urgent = data?.insights?.urgent_hackathons ?? 0;
                const total  = data?.insights?.total_hackathons ?? 0;
                setBadges({ hackathons: total, insights: urgent });
            } catch { /* ignore */ }
        };
        fetchBadges();
    }, []);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed top-4 left-4 z-[60] block md:hidden bg-card border border-border rounded-xl p-2.5 shadow-lg"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-5 h-5 text-slate-300" /> : <Menu className="w-5 h-5 text-slate-300" />}
      </button>

      {/* Overlay (mobile only) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[45] bg-black/60 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

    <aside className={`
      fixed left-0 top-0 h-full w-72 md:w-64 bg-card border-r border-border flex flex-col z-50 overflow-hidden
      transition-transform duration-300 ease-in-out
      -translate-x-full md:translate-x-0
      ${isOpen ? "translate-x-0 shadow-2xl" : ""}
    `}>
      {/* Subtle gradient overlay at top */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />

      {/* Logo area */}
      <div className="p-6 border-b border-border relative">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="relative w-9 h-9 shrink-0">
            <img
              src="/xiimalab-logo.png"
              alt="Xiimalab"
              className="w-9 h-9 object-contain"
            />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Xiimalab</h1>
            <p className="text-xs text-muted-text">AI · Blockchain · Web3</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-widest px-3 py-2 mt-1">
          Menú principal
        </p>
        {navItems.map(({ href, icon: Icon, label, badgeKey }) => {
          const isActive = pathname === href;
          const badgeCount = badgeKey ? (badges[badgeKey] ?? 0) : 0;
          return (
            <Link key={href} href={href} onClick={() => setIsOpen(false)}>
              <motion.div
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer group relative ${isActive
                    ? "bg-accent/15 text-accent border border-accent/20"
                    : "text-slate-400 hover:text-slate-100 hover:bg-muted/50"
                  }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-accent" : "group-hover:text-slate-200"}`} />
                <span className="flex-1">{label}</span>
                {badgeCount > 0 && !isActive && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    badgeKey === "insights"
                      ? "bg-rose-500/20 text-rose-400"
                      : "bg-accent/20 text-accent"
                  }`}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="w-1.5 h-1.5 rounded-full bg-accent"
                  />
                )}
                {!isActive && badgeCount === 0 && (
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

            {/* System status footer */}
            <div className="p-4 border-t border-border">
                <div className="bg-background rounded-xl p-3 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                        </span>
                        <span className="text-xs font-semibold text-emerald-400">Sistemas operativos</span>
                    </div>
                    <div className="space-y-1.5">
                        {[
                            { label: "AURA Engine", status: "online" },
                            { label: "DoraHacks Bot", status: "online" },
                            { label: "Devfolio MCP", status: "online" },
                            { label: "Match API", status: "online" },
                        ].map(({ label, status }) => (
                            <div key={label} className="flex items-center justify-between">
                                <span className="text-xs text-muted-text">{label}</span>
                                <span className="text-xs text-emerald-400 font-medium capitalize">{status}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Wallet pill */}
                <Link href="/settings">
                    <div className={`mt-3 flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors cursor-pointer ${
                        isConnected ? "hover:bg-emerald-500/5" : "hover:bg-amber-500/5"
                    }`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                            isConnected
                                ? "bg-emerald-500/15 border border-emerald-500/30"
                                : "bg-amber-500/10 border border-amber-500/25"
                        }`}>
                            {isConnected
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                : <Wallet className="w-3.5 h-3.5 text-amber-400" />
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            {!isLoaded ? (
                                <div className="space-y-1.5 animate-pulse">
                                    <div className="h-3 bg-white/10 rounded w-20"></div>
                                    <div className="h-2 bg-white/5 rounded w-16"></div>
                                </div>
                            ) : isConnected ? (
                                <>
                                    <p className="text-xs font-semibold text-emerald-400 truncate">
                                        {displayName ?? "Wallet conectada"}
                                    </p>
                                    <p className="text-xs text-muted-text font-mono truncate">
                                        {publicKey?.slice(0, 8)}…{publicKey?.slice(-4)}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs font-semibold text-amber-400">Sin wallet</p>
                                    <p className="text-xs text-muted-text">Conectar en Ajustes</p>
                                </>
                            )}
                        </div>
                    </div>
                </Link>
            </div>
        </aside>
    </>
    );
}
