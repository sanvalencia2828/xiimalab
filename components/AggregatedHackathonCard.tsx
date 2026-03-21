"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Clock, TrendingUp, ExternalLink, Zap, Tag, Eye, Send, CheckCircle2, Loader2 } from "lucide-react";

type ApplyState = "idle" | "loading" | "applied";

function ApplyButton({ hackathonId, sourceUrl }: { hackathonId: string; sourceUrl: string | null }) {
    const [state, setState] = useState<ApplyState>("idle");

    const handleApply = async () => {
        if (state !== "idle") return;
        setState("loading");
        try {
            const res = await fetch("/api/hackathons/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hackathon_id: hackathonId }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setState("applied");
            if (sourceUrl) window.open(sourceUrl, "_blank", "noopener noreferrer");
        } catch {
            setState("idle");
        }
    };

    return (
        <motion.button
            whileHover={state === "idle" ? { scale: 1.03 } : {}}
            whileTap={state === "idle" ? { scale: 0.97 } : {}}
            onClick={handleApply}
            disabled={state !== "idle"}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                state === "applied"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 cursor-default"
                    : state === "loading"
                    ? "bg-accent/10 text-accent border-accent/20 cursor-not-allowed opacity-70"
                    : "bg-accent/10 text-accent border-accent/30 hover:bg-accent/20"
            }`}
        >
            {state === "applied" ? (
                <><CheckCircle2 className="w-3 h-3" /> ¡Aplicaste!</>
            ) : state === "loading" ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Aplicando...</>
            ) : (
                <><Send className="w-3 h-3" /> Aplicar</>
            )}
        </motion.button>
    );
}
import type { AggregatedHackathon } from "@/lib/types";
import { SourceBadges } from "./SourceBadges";

interface AggregatedHackathonCardProps {
  hackathon: AggregatedHackathon;
  index?: number;
  onExpandClick?: (hackathon: AggregatedHackathon) => void;
}

/**
 * Card component for aggregated hackathons.
 * Shows consolidated info from multiple sources.
 */
export function AggregatedHackathonCard({
  hackathon,
  index = 0,
  onExpandClick,
}: AggregatedHackathonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const daysLeft = Math.ceil(
    (new Date(hackathon.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isUrgent = daysLeft <= 7 && daysLeft >= 0;
  const isClosed = daysLeft < 0;

  const matchColor = (score: number | undefined | null) => {
    if (!score) return "text-slate-400";
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-sky-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const confidenceColor = (confidence: number) => {
    if (confidence >= 0.95) return "bg-emerald-500/10 text-emerald-400";
    if (confidence >= 0.85) return "bg-sky-500/10 text-sky-400";
    return "bg-slate-500/10 text-slate-400";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
      className="group"
    >
      <div
        className={`
          bg-card border transition-all duration-300 rounded-2xl p-5
          ${isExpanded ? "border-accent/50" : "border-border hover:border-accent/30"}
          ${isClosed ? "opacity-60" : ""}
        `}
      >
        {/* Header: Title + Primary Badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-200 truncate group-hover:text-accent transition-colors">
              {hackathon.title}
            </h3>
            {hackathon.organizer && (
              <p className="text-xs text-muted-text mt-1">{hackathon.organizer}</p>
            )}
          </div>
          {/* Confidence Badge */}
          <div className={`px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${confidenceColor(hackathon.source_metadata.source_confidence)}`}>
            {Math.round(hackathon.source_metadata.source_confidence * 100)}%
          </div>
        </div>

        {/* Prize + Deadline + Match Score */}
        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
          {/* Prize */}
          <div className="flex items-center gap-1.5 text-muted-text">
            <Trophy className="w-3.5 h-3.5" />
            <span>${(hackathon.prize_pool / 1000).toFixed(0)}k</span>
          </div>

          {/* Days Left */}
          <div
            className={`flex items-center gap-1.5 font-medium ${
              isClosed ? "text-slate-500" : isUrgent ? "text-red-400" : "text-muted-text"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              {isClosed ? "Closed" : isUrgent ? `${daysLeft}d left!` : `${daysLeft}d left`}
            </span>
          </div>

          {/* Match Score (if provided) */}
          {hackathon.personalized_score != null && (
            <div className={`flex items-center gap-1.5 font-medium ${matchColor(hackathon.personalized_score)}`}>
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{Math.round(hackathon.personalized_score)}%</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {hackathon.tags && hackathon.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {hackathon.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/30 text-slate-300 text-xs rounded-md border border-slate-600/30"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
            {hackathon.tags.length > 4 && (
              <span className="inline-flex items-center px-2 py-1 text-muted-text text-xs">
                +{hackathon.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Tech Stack (if available) */}
        {hackathon.tech_stack && hackathon.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {hackathon.tech_stack.slice(0, 3).map((tech) => (
              <span
                key={tech}
                className="px-2 py-1 bg-sky-500/10 text-sky-300 text-xs rounded-md border border-sky-500/20"
              >
                {tech}
              </span>
            ))}
          </div>
        )}

        {/* Source Badges */}
        <div className="flex items-center justify-between mb-4 pt-4 border-t border-border">
          <SourceBadges
            sources={hackathon.source_metadata.sources}
            sourceUrls={hackathon.source_metadata.source_urls}
            primarySource={hackathon.source_metadata.primary_source}
            compact
          />
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border pt-4 mt-4"
          >
            {hackathon.description && (
              <p className="text-xs text-muted-text mb-3 line-clamp-2">
                {hackathon.description}
              </p>
            )}
            {hackathon.difficulty && (
              <div className="mb-2">
                <span className="text-xs font-medium text-slate-400">
                  Difficulty:{" "}
                  <span className="text-slate-200 capitalize">{hackathon.difficulty}</span>
                </span>
              </div>
            )}
            {hackathon.event_type && (
              <div className="mb-2">
                <span className="text-xs font-medium text-slate-400">
                  Format:{" "}
                  <span className="text-slate-200 capitalize">{hackathon.event_type}</span>
                </span>
              </div>
            )}

            {/* Available On Links */}
            {hackathon.source_metadata.sources.length > 1 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-medium text-slate-400 mb-2">Available on:</p>
                <div className="flex flex-wrap gap-2">
                  {hackathon.source_metadata.sources.map((source) => {
                    const url = hackathon.source_metadata.source_urls[source];
                    return url ? (
                      <a
                        key={source}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent hover:bg-accent/20 text-xs rounded-md transition-colors"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        {source}
                      </a>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <button
            onClick={() => {
              setIsExpanded(!isExpanded);
              onExpandClick?.(hackathon);
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            {isExpanded ? "Less details" : "More details"}
          </button>

          {/* Primary CTA */}
          <ApplyButton
            hackathonId={hackathon.id}
            sourceUrl={hackathon.source_metadata?.source_urls?.[hackathon.source_metadata?.primary_source] ?? hackathon.source_url ?? null}
          />
        </div>
      </div>
    </motion.div>
  );
}
