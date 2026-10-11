"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Clock, TrendingUp, ExternalLink, Tag, Eye, BrainCircuit } from "lucide-react";
import AIMatchModal from "@/components/AIMatchModal";
import { recordHackathonAction } from "@/lib/hackathons/actions";
import { describeClosing, formatPrize } from "@/lib/hackathons/format";
import type { AggregatedHackathon } from "@/lib/types";
import { SourceBadges } from "./SourceBadges";

interface AggregatedHackathonCardProps {
  hackathon: AggregatedHackathon;
  index?: number;
  onExpandClick?: (hackathon: AggregatedHackathon) => void;
}

const MAX_TAGS = 4;
// Devpost usa "Self" cuando la hackatón no declara organizador
const NO_ORGANIZER = new Set(["", "self"]);

const matchColor = (score: number) => {
  if (score >= 90) return "text-emerald-400";
  if (score >= 75) return "text-sky-400";
  if (score >= 60) return "text-amber-400";
  return "text-slate-400";
};

/** Registra el clic de salida sin bloquear la navegación; si falla, el enlace se abre igual. */
function trackApply(hackathonId: string) {
  void fetch("/api/hackathons/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hackathon_id: hackathonId }),
    keepalive: true,
  }).catch(() => { /* el registro es opcional */ });
}

/** Tarjeta de una hackatón del listado. */
export function AggregatedHackathonCard({
  hackathon,
  index = 0,
  onExpandClick,
}: AggregatedHackathonCardProps) {
  const [showAIMatch, setShowAIMatch] = useState(false);

  const closing = describeClosing(hackathon.deadline);
  const sources = hackathon.source_metadata?.sources?.length
    ? hackathon.source_metadata.sources
    : hackathon.source ? [hackathon.source] : [];
  const sourceUrls = hackathon.source_metadata?.source_urls ?? {};
  const primarySource = hackathon.source_metadata?.primary_source || hackathon.source || "";
  const officialUrl = sourceUrls[primarySource] ?? hackathon.source_url ?? null;

  const organizer = hackathon.organizer?.trim() ?? "";
  const showOrganizer = !NO_ORGANIZER.has(organizer.toLowerCase());
  const match = Math.round(hackathon.personalized_score ?? hackathon.match_score ?? 0);
  const tags = Array.from(new Map((hackathon.tags ?? []).map((t) => [t.trim().toLowerCase(), t.trim()])).values()).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.05, duration: 0.3, ease: "easeOut" }}
      className="group"
    >
      <div className={`card-premium transition-all duration-300 p-5 h-full flex flex-col hover:!border-accent/30 ${closing.closed ? "opacity-60" : ""}`}>
        {/* Plataforma */}
        {sources.length > 0 && (
          <div className="mb-3">
            <SourceBadges sources={sources} sourceUrls={sourceUrls} primarySource="" compact />
          </div>
        )}

        {/* Título + organizador */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-200 line-clamp-2 group-hover:text-accent transition-colors">
            {hackathon.title}
          </h3>
          {showOrganizer && <p className="text-xs text-muted-text mt-1 truncate">{organizer}</p>}
        </div>

        {/* Premio + cierre + match */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4 text-xs">
          <div
            className="flex items-center gap-1.5 text-muted-text"
            title={hackathon.prize_unverified ? `El organizador declara ${formatPrize(hackathon.prize_pool, hackathon.prize_currency)}; no se ha podido verificar` : undefined}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>{formatPrize(hackathon.prize_pool, hackathon.prize_currency, hackathon.prize_unverified)}</span>
          </div>
          <div
            className={`flex items-center gap-1.5 font-medium ${closing.closed ? "text-slate-500" : closing.urgent ? "text-red-400" : "text-muted-text"}`}
            suppressHydrationWarning
          >
            <Clock className="w-3.5 h-3.5" />
            <span suppressHydrationWarning>{closing.label}</span>
          </div>
          {match > 0 && (
            <div className={`flex items-center gap-1.5 font-medium ${matchColor(match)}`} title="Coincidencia entre el título y las etiquetas de la hackatón y tus skills">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{match}% match</span>
            </div>
          )}
        </div>

        {/* Etiquetas */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.slice(0, MAX_TAGS).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/30 text-slate-300 text-xs rounded-md border border-slate-600/30"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
            {tags.length > MAX_TAGS && (
              <span className="inline-flex items-center px-2 py-1 text-muted-text text-xs">+{tags.length - MAX_TAGS}</span>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-auto pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => onExpandClick?.(hackathon)}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Ver detalles
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                recordHackathonAction({ id: hackathon.id, title: hackathon.title, matchScore: match }, "analyze");
                setShowAIMatch(true);
              }}
              className="btn-ghost !border-purple-500/30 !text-purple-400 hover:!bg-purple-500/20"
            >
              <BrainCircuit className="w-3 h-3" />
              Analizar match
            </button>
            {officialUrl && (
              <a
                href={officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  recordHackathonAction({ id: hackathon.id, title: hackathon.title, matchScore: match }, "apply");
                  trackApply(hackathon.id);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-accent/10 text-accent border-accent/30 hover:bg-accent/20 transition-all"
              >
                Ir a la hackatón
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {showAIMatch && (
          <AIMatchModal
            hackathonTitle={hackathon.title}
            hackathonTags={hackathon.tags ?? []}
            hackathonPrize={hackathon.prize_pool ?? 0}
            hackathonDeadline={hackathon.deadline ?? ""}
            onClose={() => setShowAIMatch(false)}
          />
        )}
      </div>
    </motion.div>
  );
}
