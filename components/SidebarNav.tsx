"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import SystemStatus from "./SystemStatus";
import { useWallet } from "@/lib/WalletContext";

// -------------------------------------------------------
// NAV ITEMS CONFIG
// -------------------------------------------------------
const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Inicio" },
  { href: "/dashboard", icon: Cpu, label: "Dashboard Estudiante" },
  { href: "/skills", icon: Brain, label: "Skills" },
  { href: "/hackathons", icon: Zap, label: "Hackatones" },
  { href: "/aggregated", icon: Database, label: "Aggregated" },
  { href: "/portfolio", icon: Briefcase, label: "Portfolio" },
  { href: "/match", icon: BarChart3, label: "Market Match" },
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
    const { isConnected, publicKey, displayName, isLoaded } = useWallet();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border flex flex-col z-50 overflow-hidden">
      {/* Subtle gradient overlay at top */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />

      {/* Logo area */}
      <div className="p-6 border-b border-border relative">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="relative w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-glow shrink-0">
            <Image
              src="/Xiima-logo.png"
              alt="Xiimalab Logo"
              width={36}
              height={36}
              className="object-contain"
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
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href}>
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
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="w-1.5 h-1.5 rounded-full bg-accent"
                  />
                )}
                {!isActive && (
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

            {/* System Status with real API ping */}
            <div className="p-4 border-t border-border">
                <SystemStatus />

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
    );
}
