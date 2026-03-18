"use client";

import { Lock, Wallet, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function StellarEscrowWidget() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-xl bg-amber-500/15">
          <Lock className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-200">Stellar Escrow</h3>
          <p className="text-xs text-muted-text">Fondos bloqueados en Testnet</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5 px-3 py-2.5 rounded-xl border text-xs font-medium bg-slate-700/30 border-slate-600/30 text-slate-500">
        <Wallet className="w-3.5 h-3.5 shrink-0" />
        <span>Wallet no conectada — configura en /settings</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-background rounded-xl p-3 border border-border text-center">
          <p className="text-lg font-bold text-amber-400">100 XLM</p>
          <p className="text-xs text-muted-text">Bloqueados</p>
        </div>
        <div className="bg-background rounded-xl p-3 border border-border text-center">
          <p className="text-lg font-bold text-emerald-400">50 XLM</p>
          <p className="text-xs text-muted-text">Liberados</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Escrows activos</p>
        <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">AURA Pro — Domina el resize inteligente</p>
            <p className="text-xs text-muted-text">4/10 imágenes · 100 XLM</p>
          </div>
          <span className="text-xs text-amber-400 font-bold shrink-0">40%</span>
        </div>
      </div>

      <Link
        href="https://laboratory.stellar.org/#explorer?resource=claimable_balances&endpoint=all&network=test"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-accent/30 text-accent text-xs font-medium hover:bg-accent/10 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Ver en Stellar Explorer
      </Link>
    </div>
  );
}