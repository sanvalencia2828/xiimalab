/**
 * app/settings/page.tsx — SERVER COMPONENT
 * Configuración: wallets, integraciones y datos. El estado de las
 * integraciones se lee aquí, en el servidor, y solo viaja al cliente si cada
 * una está configurada o no (nunca el valor de una clave).
 */
import type { Metadata } from "next";
import SettingsClient from "@/components/settings/SettingsClient";
import { getIntegrationStatus } from "@/lib/settings/integrations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Configuración | Xiimalab",
    description: "Vincula tus wallets, revisa el estado de las integraciones y exporta o borra tus datos.",
};

export default function SettingsPage() {
    return (
        <div className="p-6 pt-20 md:pt-6 min-h-screen">
            <div className="max-w-3xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-1">Configuración</h1>
                    <p className="text-slate-400 text-sm">Wallets, integraciones y datos</p>
                </div>
                <SettingsClient integrations={getIntegrationStatus()} />
            </div>
        </div>
    );
}
