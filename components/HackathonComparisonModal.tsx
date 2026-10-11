"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Trophy, Clock, Tag, BrainCircuit } from "lucide-react";
import type { AggregatedHackathon } from "@/lib/types";
import { SourceBadges } from "./SourceBadges";
import { ConnectorOutreach } from "./ConnectorOutreach";
import AIMatchModal from "./AIMatchModal";
import { formatPrize } from "@/lib/hackathons/format";

interface HackathonComparisonModalProps {
  hackathon: AggregatedHackathon | null;
  isOpen: boolean;
  onClose: () => void;
}

const MAX_TAGS = 8;
const LONG_DESCRIPTION = 220; // a partir de aquí se recorta con "Ver más"
const URGENT_DAYS = 3;

const SOURCE_LABELS: Record<string, string> = {
  devfolio: "Devfolio",
  dorahacks: "DoraHacks",
  devpost: "Devpost",
};

const FORMAT_LABELS: Record<string, string> = {
  virtual: "Virtual",
  online: "Virtual",
  "in-person": "Presencial",
  hybrid: "Híbrido",
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source.toLowerCase()] ?? source;
}

/** Fecha local a partir de "YYYY-MM-DD…" (sin desfase por zona horaria). */
function parseDeadline(iso: string | null | undefined): Date | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function describeDeadline(iso: string | null | undefined): { date: string; countdown: string; urgent: boolean } {
  const d = parseDeadline(iso);
  if (!d) return { date: "Sin fecha", countdown: "", urgent: false };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);

  const countdown =
    days < 0 ? "Convocatoria cerrada" :
    days === 0 ? "Cierra hoy" :
    days === 1 ? "Cierra mañana" :
    `Cierra en ${days} días`;

  return {
    date: `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    countdown,
    urgent: days >= 0 && days < URGENT_DAYS,
  };
}

const matchColor = (score: number | undefined | null) => {
  if (!score) return "text-slate-400";
  if (score >= 90) return "text-emerald-400";
  if (score >= 75) return "text-sky-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
};

/**
 * Modal de detalle de una hackatón: datos clave, etiquetas, descripción y,
 * en un pie fijo, el enlace oficial y el análisis de match con IA.
 */
export function HackathonComparisonModal({
  hackathon,
  isOpen,
  onClose,
}: HackathonComparisonModalProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAIMatch, setShowAIMatch] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const hackathonId = hackathon?.id;
  useEffect(() => {
    setExpanded(false);
    setShowAIMatch(false);
  }, [hackathonId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showAIMatch) setShowAIMatch(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, showAIMatch]);

  if (!hackathon || !mounted) return null;

  const sources = hackathon.source_metadata?.sources?.length
    ? hackathon.source_metadata.sources
    : hackathon.source ? [hackathon.source] : [];
  const sourceUrls = hackathon.source_metadata?.source_urls ?? {};
  const primarySource = hackathon.source_metadata?.primary_source || hackathon.source || sources[0] || "";
  const otherSources = sources.filter((s) => s !== primarySource);
  const officialUrl = sourceUrls[primarySource] ?? hackathon.source_url ?? null;

  const deadline = describeDeadline(hackathon.deadline);
  const tags = hackathon.tags ?? [];
  const description = hackathon.description?.trim() ?? "";
  const isLongDescription = description.length > LONG_DESCRIPTION;
  const format = hackathon.event_type
    ? FORMAT_LABELS[hackathon.event_type.toLowerCase()] ?? hackathon.event_type
    : null;

  // Portal: un ancestro con transform descoloca un `fixed` anidado
  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={hackathon.title}
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-card border border-border sm:rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-border shrink-0">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-slate-200 mb-2">{hackathon.title}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceBadges
                      sources={primarySource ? [primarySource] : []}
                      sourceUrls={sourceUrls}
                      primarySource=""
                    />
                    {otherSources.length > 0 && (
                      <span className="text-xs text-muted-text">
                        También en{" "}
                        {otherSources.map((s, i) => (
                          <span key={s}>
                            {i > 0 && (i === otherSources.length - 1 ? " y " : ", ")}
                            {sourceUrls[s] ? (
                              <a
                                href={sourceUrls[s]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:underline"
                              >
                                {sourceLabel(s)}
                              </a>
                            ) : (
                              <span className="text-slate-300">{sourceLabel(s)}</span>
                            )}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors shrink-0"
                >
                  <X className="w-5 h-5 text-muted-text" />
                </button>
              </div>

              {/* Cuerpo con scroll */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {/* Datos clave */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-text mb-1">Premio</p>
                    <p className={`text-lg font-semibold flex items-center gap-2 ${hackathon.prize_pool > 0 && !hackathon.prize_unverified ? "text-slate-200" : "text-slate-400"}`}>
                      <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                      {formatPrize(hackathon.prize_pool, hackathon.prize_currency, hackathon.prize_unverified)}
                    </p>
                    {hackathon.prize_unverified && (
                      <p className="text-xs text-muted-text mt-1">
                        El organizador declara {formatPrize(hackathon.prize_pool, hackathon.prize_currency)}; no se ha podido verificar.
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-text mb-1">Cierre</p>
                    <p className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                      <Clock className={`w-4 h-4 shrink-0 ${deadline.urgent ? "text-red-400" : "text-slate-400"}`} />
                      {deadline.date}
                    </p>
                    {deadline.countdown && (
                      <p className={`text-xs mt-0.5 ${deadline.urgent ? "text-red-400 font-semibold" : "text-muted-text"}`}>
                        {deadline.countdown}
                      </p>
                    )}
                  </div>
                  {format && (
                    <div>
                      <p className="text-xs text-muted-text mb-1">Formato</p>
                      <p className="text-sm text-slate-200">{format}</p>
                    </div>
                  )}
                  {hackathon.organizer && (
                    <div>
                      <p className="text-xs text-muted-text mb-1">Organizador</p>
                      <p className="text-sm text-slate-200">{hackathon.organizer}</p>
                    </div>
                  )}
                  {hackathon.city && (
                    <div>
                      <p className="text-xs text-muted-text mb-1">Ciudad</p>
                      <p className="text-sm text-slate-200">{hackathon.city}</p>
                    </div>
                  )}
                  {hackathon.difficulty && (
                    <div>
                      <p className="text-xs text-muted-text mb-1">Dificultad</p>
                      <p className="text-sm text-slate-200 capitalize">{hackathon.difficulty}</p>
                    </div>
                  )}
                  {hackathon.personalized_score != null && (
                    <div>
                      <p className="text-xs text-muted-text mb-1">Match</p>
                      <p className={`text-sm font-semibold ${matchColor(hackathon.personalized_score)}`}>
                        {Math.round(hackathon.personalized_score)}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Etiquetas */}
                {tags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                      <Tag className="w-3 h-3" />
                      Etiquetas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tags.slice(0, MAX_TAGS).map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 bg-slate-700/30 text-slate-300 text-xs rounded-lg border border-slate-600/30"
                        >
                          {tag}
                        </span>
                      ))}
                      {tags.length > MAX_TAGS && (
                        <span className="px-2.5 py-1 text-xs text-muted-text">+{tags.length - MAX_TAGS}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Descripción */}
                {description && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2">Descripción</p>
                    <p className={`text-sm text-muted-text leading-relaxed ${expanded ? "" : "line-clamp-4"}`}>
                      {description}
                    </p>
                    {isLongDescription && (
                      <button
                        onClick={() => setExpanded((v) => !v)}
                        className="mt-1 text-xs text-accent hover:underline"
                      >
                        {expanded ? "Ver menos" : "Ver más"}
                      </button>
                    )}
                  </div>
                )}

                {/* Stack recomendado */}
                {hackathon.tech_stack && hackathon.tech_stack.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2">Stack recomendado</p>
                    <div className="flex flex-wrap gap-2">
                      {hackathon.tech_stack.map((tech) => (
                        <span
                          key={tech}
                          className="px-2.5 py-1 bg-sky-500/10 text-sky-300 text-xs rounded-lg border border-sky-500/20"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Desglose del match personalizado */}
                {hackathon.match_breakdown && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2">Desglose del match</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800/30 rounded-lg p-3">
                        <p className="text-xs text-muted-text mb-1">Skills</p>
                        <p className="text-sm font-semibold text-sky-400">
                          {Math.round(hackathon.match_breakdown.skill_overlap_score)}%
                        </p>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-3">
                        <p className="text-xs text-muted-text mb-1">Urgencia</p>
                        <p className="text-sm font-semibold text-amber-400">
                          {Math.round(hackathon.match_breakdown.urgency_score)}%
                        </p>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-3">
                        <p className="text-xs text-muted-text mb-1">Valor del premio</p>
                        <p className="text-sm font-semibold text-yellow-400">
                          {Math.round(hackathon.match_breakdown.value_score)}%
                        </p>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-3">
                        <p className="text-xs text-muted-text mb-1">Stack</p>
                        <p className="text-sm font-semibold text-emerald-400">
                          {Math.round(hackathon.match_breakdown.tech_stack_score)}%
                        </p>
                      </div>
                    </div>
                    {hackathon.match_breakdown.reasoning && (
                      <p className="text-xs text-muted-text mt-3 italic">
                        {hackathon.match_breakdown.reasoning}
                      </p>
                    )}
                  </div>
                )}

                {/* Connector Outreach (XMTP) */}
                <ConnectorOutreach
                  hackathonTitle={hackathon.title}
                  matchScore={hackathon.personalized_score ?? hackathon.match_score ?? 0}
                  techStack={hackathon.tech_stack || []}
                />
              </div>

              {/* Pie fijo */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 p-4 sm:px-6 border-t border-border bg-card shrink-0">
                <button
                  onClick={() => setShowAIMatch(true)}
                  className="btn-ghost flex items-center justify-center gap-2 text-sm !border-purple-500/30 !text-purple-400 hover:!bg-purple-500/20"
                >
                  <BrainCircuit className="w-4 h-4" />
                  Analizar match
                </button>
                {officialUrl ? (
                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
                  >
                    Ir a la hackatón
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <span className="flex-1 flex items-center justify-center text-xs text-muted-text">
                    Sin enlace oficial disponible
                  </span>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && showAIMatch && (
        <AIMatchModal
          hackathonTitle={hackathon.title}
          hackathonTags={tags}
          hackathonPrize={hackathon.prize_pool ?? 0}
          hackathonDeadline={hackathon.deadline ?? ""}
          onClose={() => setShowAIMatch(false)}
        />
      )}
    </>,
    document.body,
  );
}
