"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Trophy, Clock, Tag } from "lucide-react";
import type { AggregatedHackathon } from "@/lib/types";
import { SourceBadges } from "./SourceBadges";

interface HackathonComparisonModalProps {
  hackathon: AggregatedHackathon | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal that displays detailed info about a hackathon
 * with links to each source it appears on.
 */
export function HackathonComparisonModal({
  hackathon,
  isOpen,
  onClose,
}: HackathonComparisonModalProps) {
  if (!hackathon) return null;

  const matchColor = (score: number | undefined | null) => {
    if (!score) return "text-slate-400";
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-sky-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1 pr-4">
                  <h2 className="text-xl font-bold text-slate-200 mb-2">
                    {hackathon.title}
                  </h2>
                  <SourceBadges
                    sources={hackathon.source_metadata.sources}
                    sourceUrls={hackathon.source_metadata.source_urls}
                    primarySource={hackathon.source_metadata.primary_source}
                  />
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5 text-muted-text" />
                </button>
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-3 mb-6 pb-6 border-b border-border">
                <div>
                  <p className="text-xs text-muted-text mb-1">Prize Pool</p>
                  <p className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    ${(hackathon.prize_pool / 1000).toFixed(0)}k
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-text mb-1">Deadline</p>
                  <p className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500" />
                    {new Date(hackathon.deadline).toLocaleDateString()}
                  </p>
                </div>
                {hackathon.personalized_score != null && (
                  <div>
                    <p className="text-xs text-muted-text mb-1">Match Score</p>
                    <p className={`text-lg font-semibold ${matchColor(hackathon.personalized_score)}`}>
                      {Math.round(hackathon.personalized_score)}%
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-text mb-1">Sources</p>
                  <p className="text-lg font-semibold text-slate-200">
                    {hackathon.source_metadata.sources.length}
                  </p>
                </div>
              </div>

              {/* Description */}
              {hackathon.description && (
                <div className="mb-6 pb-6 border-b border-border">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3">Description</h3>
                  <p className="text-sm text-muted-text leading-relaxed">
                    {hackathon.description}
                  </p>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-border">
                {hackathon.difficulty && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1">Difficulty</p>
                    <p className="text-sm text-slate-200 capitalize">{hackathon.difficulty}</p>
                  </div>
                )}
                {hackathon.event_type && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1">Format</p>
                    <p className="text-sm text-slate-200 capitalize">{hackathon.event_type}</p>
                  </div>
                )}
                {hackathon.organizer && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1">Organizer</p>
                    <p className="text-sm text-slate-200">{hackathon.organizer}</p>
                  </div>
                )}
                {hackathon.city && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1">City</p>
                    <p className="text-sm text-slate-200">{hackathon.city}</p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {hackathon.tags && hackathon.tags.length > 0 && (
                <div className="mb-6 pb-6 border-b border-border">
                  <p className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-1.5">
                    <Tag className="w-3 h-3" />
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {hackathon.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 bg-slate-700/30 text-slate-300 text-xs rounded-lg border border-slate-600/30"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tech Stack */}
              {hackathon.tech_stack && hackathon.tech_stack.length > 0 && (
                <div className="mb-6 pb-6 border-b border-border">
                  <p className="text-xs font-medium text-slate-400 mb-3">Recommended Tech Stack</p>
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

              {/* Source Links */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Available on:</h3>
                <div className="grid grid-cols-1 gap-2">
                  {hackathon.source_metadata.sources.map((source) => {
                    const url = hackathon.source_metadata.source_urls[source];
                    const isPrimary = source === hackathon.source_metadata.primary_source;
                    return url ? (
                      <a
                        key={source}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`
                          flex items-center justify-between p-3 rounded-lg border
                          transition-all duration-200
                          ${
                            isPrimary
                              ? "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20"
                              : "bg-slate-800/30 border-slate-700/30 text-slate-300 hover:bg-slate-800/50"
                          }
                        `}
                      >
                        <span className="text-sm font-medium capitalize">
                          {source}
                          {isPrimary && " (Primary)"}
                        </span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Personalized Scoring (if available) */}
              {hackathon.match_breakdown && (
                <div className="mb-6 pb-6 border-b border-border">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3">
                    Match Breakdown
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/30 rounded-lg p-3">
                      <p className="text-xs text-muted-text mb-1">Skill Match</p>
                      <p className="text-sm font-semibold text-sky-400">
                        {Math.round(hackathon.match_breakdown.skill_overlap_score)}%
                      </p>
                    </div>
                    <div className="bg-slate-800/30 rounded-lg p-3">
                      <p className="text-xs text-muted-text mb-1">Urgency</p>
                      <p className="text-sm font-semibold text-amber-400">
                        {Math.round(hackathon.match_breakdown.urgency_score)}%
                      </p>
                    </div>
                    <div className="bg-slate-800/30 rounded-lg p-3">
                      <p className="text-xs text-muted-text mb-1">Prize Value</p>
                      <p className="text-sm font-semibold text-yellow-400">
                        {Math.round(hackathon.match_breakdown.value_score)}%
                      </p>
                    </div>
                    <div className="bg-slate-800/30 rounded-lg p-3">
                      <p className="text-xs text-muted-text mb-1">Tech Match</p>
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
