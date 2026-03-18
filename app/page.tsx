"use client";

import { 
  LayoutDashboard, 
  ShoppingCart, 
  Code2, 
  Settings, 
  Zap, 
  Image as ImageIcon, 
  TrendingUp, 
  Briefcase, 
  Database,
  Link as LinkIcon,
  Lock,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import AuraUploader from "@/components/AuraUploader";
import AgentActivityFeed from "@/components/AgentActivityFeed";

export default function DashboardPage() {
  return (
    <div className="bg-gray-50 text-gray-800 font-sans min-h-screen">
      {/* Main Content Area */}
      <main className="p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* 2. "Intelligence Dashboard" heading */}
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Intelligence Dashboard</h2>
              <p className="text-slate-500 mt-1">Tu centro de comando para Staking Educativo y validación de habilidades.</p>
            </div>
          </header>

          {/* 3. 3 stats cards */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">XLM Staked Activo</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">1,250 XLM</h3>
                <p className="text-xs text-emerald-500 mt-1 font-medium">+150 este mes</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Database size={24} /></div>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Imágenes Procesadas (AURA)</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">8 / 10</h3>
                <p className="text-xs text-slate-400 mt-1">2 restantes para unlock</p>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><ImageIcon size={24} /></div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Hackatones Aplicadas</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">2</h3>
                <p className="text-xs text-emerald-500 mt-1 font-medium">Proof of Skill validado</p>
              </div>
              <div className="p-3 bg-orange-50 text-orange-600 rounded-lg"><Zap size={24} /></div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 4. AURA project section (Interactive Components) */}
            <AuraUploader />

            {/* 6. DoraHacks hackathons feed */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Code2 className="text-orange-500" size={20} /> Feed DoraHacks
                </h3>
                <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-md flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live
                </span>
              </div>
              <div className="flex-1 space-y-4">
                {[
                  { title: "Web3 Cross-Chain Challenge", bounty: "$50k", days: "2 días" },
                  { title: "DeFi Innovation Hack", bounty: "$25k", days: "5 días" },
                  { title: "Zero Knowledge Proof Track", bounty: "$100k", days: "1 semana" }
                ].map((hack, i) => (
                  <div key={i} className="group flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all cursor-pointer">
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{hack.title}</p>
                      <p className="text-xs text-slate-500">Termina en {hack.days}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-emerald-600">{hack.bounty}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/hackatones" className="mt-4 text-sm text-center text-blue-600 font-medium hover:underline">
                Ver las 65 hackatones activas &rarr;
              </Link>
            </section>
          </div>

          {/* 7. MarketMatch, EcommerceBridge, and Stellar Escrow widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">

            {/* MarketMatch Widget */}
            <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
                <h3 className="text-lg font-bold text-slate-900">MarketMatch</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4">Cruzando tu perfil con la demanda laboral actual.</p>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-slate-800">Analista de Datos Web3</h4>
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">92% Match</span>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-md">Analítica NODO-EAFIT</span>
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-md">Stellar Bootcamp 2026</span>
                  </div>
                </div>
              </div>
            </section>

            {/* EcommerceBridge Widget */}
            <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><LinkIcon size={20} /></div>
                <h3 className="text-lg font-bold text-slate-900">EcommerceBridge</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4">Conexión de infoproductos a Smart Contracts.</p>

              <div className="flex items-center justify-between p-4 border border-slate-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#f3522b] flex items-center justify-center text-white font-bold text-xs">HM</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Webhook Activo</p>
                    <p className="text-xs text-slate-500">Escuchando ventas...</p>
                  </div>
                </div>
                <div className="h-px w-8 bg-slate-300 border-dashed border-t-2"></div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">Stellar Network</p>
                    <p className="text-xs text-slate-500">Testnet Conectada</p>
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-slate-800 flex items-center justify-center">
                    <Zap size={16} className="text-slate-800" />
                  </div>
                </div>
              </div>
            </section>

            {/* Stellar Escrow Widget */}
            <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Lock size={20} /></div>
                <h3 className="text-lg font-bold text-slate-900">Stellar Escrow</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4">Fondos bloqueados en Testnet.</p>

              <div className="space-y-4">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium bg-slate-50 border-slate-100 text-slate-500">
                  <Wallet size={14} />
                  <span>Wallet no conectada — configura en /settings</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                    <p className="text-lg font-bold text-amber-600">100 XLM</p>
                    <p className="text-xs text-slate-500">Bloqueados</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                    <p className="text-lg font-bold text-emerald-600">50 XLM</p>
                    <p className="text-xs text-slate-500">Liberados</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Escrows activos</p>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Lock size={14} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">AURA Pro — Domina el resize inteligente</p>
                      <p className="text-xs text-slate-500">4/10 imágenes · 100 XLM</p>
                    </div>
                    <span className="text-xs text-amber-600 font-bold shrink-0">40%</span>
                  </div>
                </div>

                <Link
                  href="/settings"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                >
                  Configurar Wallet Stellar
                </Link>
              </div>
            </section>
            {/* Agent Collaboration Feed */}
            <div className="pb-12">
              <AgentActivityFeed />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
