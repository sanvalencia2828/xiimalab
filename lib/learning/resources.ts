/**
 * lib/learning/resources.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Recursos reconocidos: cursos, rutas de carrera y certificaciones de terceros
 * que encajan con una fase de un track.
 *
 * Solo se guarda el enlace y una descripción propia de por qué encaja; nunca
 * contenido copiado del proveedor.
 *
 *   • `skills` usa las etiquetas de lib/hackathons/match.ts.
 *   • `phaseId` es el id de la fase en lib/learning/tracks.ts; sin él, el
 *     recurso aplica al track entero (p. ej. una certificación).
 *   • `ecosystem` permite avisar cuando el recurso enseña con una cadena
 *     distinta de la que el track usa para la práctica.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ResourceType = "curso" | "ruta de carrera" | "certificación";

export interface ResourceProvider {
    id: string;
    name: string;
    url: string;
}

export interface LearningResource {
    id: string;
    provider: ResourceProvider;
    title: string;
    url: string;
    type: ResourceType;
    free: boolean;
    /** Cadena o tecnología con la que enseña, p. ej. "EVM/Solidity" */
    ecosystem?: string;
    skills: string[];
    trackId: string;
    phaseId?: string;
    /** Por qué encaja en esa fase (texto propio) */
    description: string;
}

export const CYFRIN: ResourceProvider = { id: "cyfrin", name: "Cyfrin Updraft", url: "https://updraft.cyfrin.io" };

export const RESOURCES: LearningResource[] = [
    {
        id: "cyfrin-blockchain-foundations",
        provider: CYFRIN,
        title: "Blockchain Foundations",
        url: "https://updraft.cyfrin.io/career-tracks/blockchain-foundations",
        type: "ruta de carrera",
        free: true,
        ecosystem: "EVM/Solidity",
        skills: ["blockchain", "web3"],
        trackId: "blockchain",
        phaseId: "fundamentos",
        description: "Para afianzar cuentas, firmas y transacciones antes de marcar los hitos de la fase.",
    },
    {
        id: "cyfrin-smart-contract-security-auditor",
        provider: CYFRIN,
        title: "Smart Contract Security Auditor",
        url: "https://updraft.cyfrin.io/career-tracks/smart-contract-security-auditor",
        type: "ruta de carrera",
        free: true,
        ecosystem: "EVM/Solidity",
        skills: ["smart contract", "blockchain"],
        trackId: "blockchain",
        phaseId: "primer-contrato",
        description: "Escribir contratos pensando en cómo se rompen: útil para los tests que deben fallar de esta fase.",
    },
    {
        id: "cyfrin-defi-developer",
        provider: CYFRIN,
        title: "DeFi Developer",
        url: "https://updraft.cyfrin.io/career-tracks/defi-developer",
        type: "ruta de carrera",
        free: true,
        ecosystem: "EVM/Solidity",
        skills: ["defi", "smart contract"],
        trackId: "blockchain",
        phaseId: "tokens-defi",
        description: "Cómo funcionan por dentro los intercambios y pools que esta fase pide integrar.",
    },
    {
        id: "cyfrin-web3-wallet-security",
        provider: CYFRIN,
        title: "Web3 Wallet Security",
        url: "https://updraft.cyfrin.io/career-tracks/web3-wallet-security",
        type: "ruta de carrera",
        free: true,
        ecosystem: "EVM/Solidity",
        skills: ["web3", "blockchain"],
        trackId: "blockchain",
        phaseId: "seguridad-mainnet",
        description: "Custodia de claves y cuentas multifirma, lo que necesitas antes de desplegar con fondos reales.",
    },
    {
        id: "cyfrin-certifications",
        provider: { ...CYFRIN, name: "Cyfrin" },
        title: "Certificaciones Cyfrin",
        url: "https://www.cyfrin.io/products/certifications",
        type: "certificación",
        free: false,
        ecosystem: "EVM/Solidity",
        skills: ["smart contract", "blockchain"],
        trackId: "blockchain",
        description: "Examen supervisado que acredita desarrollo y seguridad de contratos; puedes añadirlo como evidencia en Mi Perfil.",
    },
];

/** Recursos de una fase del track. */
export function resourcesForPhase(trackId: string, phaseId: string): LearningResource[] {
    return RESOURCES.filter((r) => r.trackId === trackId && r.phaseId === phaseId);
}

/** Recursos del track que no pertenecen a una fase concreta (certificaciones). */
export function trackWideResources(trackId: string): LearningResource[] {
    return RESOURCES.filter((r) => r.trackId === trackId && !r.phaseId);
}

/** Proveedores con recursos en el track, sin repetir. */
export function providersForTrack(trackId: string): ResourceProvider[] {
    const byId = new Map(RESOURCES.filter((r) => r.trackId === trackId).map((r) => [r.provider.id, r.provider]));
    // El nombre largo del proveedor ("Cyfrin Updraft") gana al de una entrada concreta
    for (const provider of [CYFRIN]) if (byId.has(provider.id)) byId.set(provider.id, provider);
    return Array.from(byId.values());
}

/** Primer recurso que enseña una skill: antes los gratuitos y los cursos o rutas que las certificaciones. */
export function resourceForSkill(skill: string): LearningResource | null {
    return (
        RESOURCES.filter((r) => r.skills.includes(skill)).sort(
            (a, b) => Number(b.free) - Number(a.free) || Number(a.type === "certificación") - Number(b.type === "certificación"),
        )[0] ?? null
    );
}

/** "Ruta EVM; el track usa Stellar para la práctica", o null si coinciden o falta el dato. */
export function ecosystemNote(resource: LearningResource, trackEcosystem?: string): string | null {
    if (!resource.ecosystem || !trackEcosystem) return null;
    if (resource.ecosystem.toLowerCase().includes(trackEcosystem.toLowerCase())) return null;
    const kind = resource.type === "certificación" ? "Certificación" : resource.type === "curso" ? "Curso" : "Ruta";
    return `${kind} ${resource.ecosystem.split("/")[0]}; el track usa ${trackEcosystem} para la práctica`;
}

/** "ruta gratuita en Cyfrin Updraft" · "certificación en Cyfrin" */
export function resourceSummary(resource: LearningResource): string {
    const noun = resource.type === "ruta de carrera" ? "ruta" : resource.type;
    const free = resource.free ? (noun === "curso" ? " gratuito" : " gratuita") : "";
    return `${noun}${free} en ${resource.provider.name}`;
}
