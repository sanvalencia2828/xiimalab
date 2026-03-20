import { Metadata } from "next";
import AgentControlPanel from "@/components/AgentControlPanel";
import AgentActivityFeed from "@/components/AgentActivityFeed";

export const metadata: Metadata = {
    title: "Agentes IA | Xiimalab",
    description: "Panel de control del escuadrón de agentes de inteligencia artificial de Xiimalab.",
};

export default function AgentsDashboardPage() {
    return (
        <div className="min-h-screen bg-background font-sans selection:bg-accent/30 flex flex-col relative overflow-hidden">
            <div className="flex-grow pt-10 pb-20 px-6 sm:px-10 max-w-7xl mx-auto w-full relative z-10 flex gap-8 flex-col xl:flex-row">
                
                {/* Panel Principal */}
                <div className="flex-1 space-y-8">
                    <div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
                            Centro de <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-emerald-400">Agentes</span>
                        </h1>
                        <p className="text-lg text-slate-400 max-w-2xl">
                            Administra, monitorea y supervisa las tareas delegadas al escuadrón de IA. Los agentes trabajan en segundo plano para identificar oportunidades, recolectar feedback y escalar tu impacto.
                        </p>
                    </div>

                    <AgentControlPanel />
                </div>

                {/* Sidebar: Activity Feed */}
                <div className="w-full xl:w-96 shrink-0">
                    <div className="sticky top-10">
                        <AgentActivityFeed />
                    </div>
                </div>

            </div>
        </div>
    );
}
