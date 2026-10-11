import { ExternalLink } from "lucide-react";
import type { LearningResource } from "@/lib/learning/resources";

/** Recurso con la nota de ecosistema ya calculada para su track. */
export type PhaseResource = LearningResource & { note: string | null };

const chipBase = "px-2 py-0.5 text-[11px] rounded-md border";

/** Recursos reconocidos: proveedor, título, chips de tipo, precio y ecosistema, y enlace externo. */
export function ResourceList({ resources }: { resources: PhaseResource[] }) {
    return (
        <ul className="space-y-2">
            {resources.map((resource) => (
                <li key={resource.id}>
                    <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg border border-border hover:border-accent/40 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[11px] text-muted-text">{resource.provider.name}</p>
                                <p className="text-sm font-medium text-slate-200">{resource.title}</p>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-muted-text shrink-0 mt-1" />
                        </div>
                        <p className="text-xs text-muted-text mt-1">{resource.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className={`${chipBase} capitalize bg-slate-700/30 text-slate-300 border-slate-600/30`}>{resource.type}</span>
                            {resource.free && (
                                <span className={`${chipBase} bg-emerald-500/10 text-emerald-400 border-emerald-500/30`}>Gratis</span>
                            )}
                            {resource.ecosystem && (
                                <span className={`${chipBase} bg-sky-500/10 text-sky-300 border-sky-500/20`}>{resource.ecosystem}</span>
                            )}
                        </div>
                        {resource.note && <p className="text-[11px] text-amber-400 mt-2">{resource.note}</p>}
                    </a>
                </li>
            ))}
        </ul>
    );
}
