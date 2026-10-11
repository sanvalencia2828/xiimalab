import { EVIDENCE_LEVEL_STYLE } from "@/components/skills/EvidenceChip";
import { EVIDENCE_LEVEL_HELP, EVIDENCE_LEVEL_LABELS, type EvidenceLevel } from "@/lib/skills/types";

// "Sin evidencia" no es un nivel que se alcance: queda fuera de la leyenda
const LEGEND_LEVELS: EvidenceLevel[] = ["certified", "demonstrated", "learning", "declared"];

/** Leyenda de los niveles de evidencia, del más fuerte al más débil. */
export function EvidenceLegend() {
    return (
        <section className="card-premium p-4" aria-label="Niveles de evidencia de una skill">
            <p className="section-label mb-3">Niveles, de más a menos evidencia</p>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {LEGEND_LEVELS.map((level, index) => (
                    <li key={level}>
                        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-md border ${EVIDENCE_LEVEL_STYLE[level]}`}>
                            {index + 1}. {EVIDENCE_LEVEL_LABELS[level]}
                        </span>
                        <p className="text-xs text-muted-text mt-1.5">{EVIDENCE_LEVEL_HELP[level]}</p>
                    </li>
                ))}
            </ol>
        </section>
    );
}
