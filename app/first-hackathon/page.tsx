/**
 * app/first-hackathon/page.tsx — SERVER COMPONENT
 * Modo primera hackatón: un plan de 7 días para elegir, construir y enviar.
 * Los datos se calculan en el servidor (app/actions/firstHackathon.ts) y el
 * plan se guarda en el navegador.
 */
import type { Metadata } from "next";
import FirstHackathonWizard from "@/components/first-hackathon/FirstHackathonWizard";

export const metadata: Metadata = {
    title: "Modo primera hackatón | Xiimalab",
    description: "Un plan de 7 días para elegir, construir y enviar tu primera hackatón, contado hacia atrás desde el cierre.",
};

export default function FirstHackathonPage() {
    return (
        <div className="p-6 pt-20 md:pt-6 min-h-screen">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-2 h-2 rounded-full bg-accent" />
                        <span className="text-xs font-medium text-accent uppercase tracking-widest">Plan de 7 días</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-1">Modo primera hackatón</h1>
                    <p className="text-slate-400 text-sm max-w-2xl">
                        Un paso por día: eliges una hackatón pensada para empezar, defines un MVP pequeño y lo envías con margen.
                    </p>
                </div>
                <FirstHackathonWizard />
            </div>
        </div>
    );
}
