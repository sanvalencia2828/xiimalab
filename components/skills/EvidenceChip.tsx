import { BadgeCheck } from "lucide-react";
import { EVIDENCE_LEVEL_LABELS, type EvidenceLevel } from "@/lib/skills/types";

export const EVIDENCE_LEVEL_STYLE: Record<EvidenceLevel, string> = {
    certified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    demonstrated: "bg-accent/10 text-accent border-accent/30",
    learning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    declared: "bg-slate-700/30 text-slate-300 border-slate-600/30",
    none: "bg-slate-800/40 text-slate-500 border-slate-700/40",
};

const chipBase = "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border";

/** Dominio de la URL de verificación, sin "www.": lo que de verdad respalda la certificación. */
function verificationDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return "";
    }
}

/** "Certificada · cyfrin.io", con enlace a la verificación. Si la URL no se puede leer, muestra el proveedor. */
export function CertifiedChip({ provider, url }: { provider: string; url: string }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Abrir la verificación de la certificación de ${provider}`}
            className={`${chipBase} ${EVIDENCE_LEVEL_STYLE.certified} hover:underline`}
        >
            <BadgeCheck className="w-3 h-3" />
            Certificada · {verificationDomain(url) || provider}
        </a>
    );
}

/** Chip del nivel de evidencia de una skill; el de "Certificada" enlaza a su verificación. */
export function EvidenceChip({ level, certification }: { level: EvidenceLevel; certification?: { provider: string; url: string } | null }) {
    if (level === "certified" && certification) return <CertifiedChip provider={certification.provider} url={certification.url} />;
    return <span className={`${chipBase} ${EVIDENCE_LEVEL_STYLE[level]}`}>{EVIDENCE_LEVEL_LABELS[level]}</span>;
}
