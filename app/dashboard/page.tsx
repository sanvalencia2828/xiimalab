/**
 * app/dashboard/page.tsx — SERVER COMPONENT
 * Dashboard del Estudiante. Los datos se calculan en el servidor
 * (app/actions/dashboard.ts) a partir del avance de los tracks, los proyectos
 * del portafolio y las hackatones abiertas.
 */
import type { Metadata } from "next";
import DashboardClient from "./components/DashboardClient";

export const metadata: Metadata = {
    title: "Dashboard del Estudiante | Xiimalab",
    description: "Tu avance en los tracks, tus proyectos, tu mapa de skills y las hackatones abiertas donde aplicarlo.",
};

export default function StudentDashboardPage() {
    return (
        <div className="p-6 pt-20 md:pt-6 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-1">Dashboard del Estudiante</h1>
                    <p className="text-slate-400 text-sm">Lo que sabes, lo que aprendes y dónde aplicarlo</p>
                </div>
                <DashboardClient />
            </div>
        </div>
    );
}
