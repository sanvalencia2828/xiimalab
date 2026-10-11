/**
 * lib/settings/integrations.ts — SERVER ONLY
 * Estado de las integraciones del servidor. Solo dice si cada una está
 * configurada: los valores de las claves nunca salen de aquí.
 */
import { supabase } from "@/lib/supabase";

export interface IntegrationStatus {
    id: string;
    name: string;
    /** Para qué sirve y qué pasa sin ella */
    purpose: string;
    configured: boolean;
}

const isSet = (value: string | undefined) => Boolean(value && value.trim());

export function getIntegrationStatus(): IntegrationStatus[] {
    return [
        {
            id: "github",
            name: "GitHub",
            purpose: "Medir el avance de tus proyectos desde sus repos. Sin token funciona, pero con el límite público de 60 peticiones por hora.",
            configured: isSet(process.env.GITHUB_TOKEN),
        },
        {
            id: "devfolio",
            name: "Devfolio",
            purpose: "Sincronizar tu perfil y tus hackatones de Devfolio. Las hackatones abiertas se leen de su API pública y no la necesitan.",
            configured: isSet(process.env.DEVFOLIO_MCP_API_KEY) || isSet(process.env.DEVFOLIO_API_KEY),
        },
        {
            id: "anthropic",
            name: "Anthropic",
            purpose: "Análisis de match con IA entre tus skills y una hackatón. Sin clave se usa una estimación por coincidencia de etiquetas.",
            configured: isSet(process.env.ANTHROPIC_API_KEY),
        },
        {
            id: "supabase",
            name: "Supabase",
            purpose: "Base de datos: respaldo de hackatones cuando las fuentes en vivo fallan y registro de logros.",
            configured: supabase !== null,
        },
    ];
}
