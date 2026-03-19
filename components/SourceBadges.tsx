"use client";

import { Globe, Zap, Trophy } from "lucide-react";

interface SourceBadgesProps {
  sources: string[];
  sourceUrls: Record<string, string>;
  primarySource: string;
  compact?: boolean;
}

/**
 * Displays source badges for a hackathon.
 * Shows primary source highlighted, with links to each platform.
 */
export function SourceBadges({
  sources,
  sourceUrls,
  primarySource,
  compact = false,
}: SourceBadgesProps) {
  const sourceConfig: Record<
    string,
    {
      icon: React.ComponentType<{ className?: string }>;
      label: string;
      color: string;
      hoverColor: string;
    }
  > = {
    devfolio: {
      icon: Globe,
      label: "Devfolio",
      color: "bg-sky-500/10 text-sky-400 border-sky-500/30",
      hoverColor: "hover:bg-sky-500/20 hover:border-sky-500/50",
    },
    dorahacks: {
      icon: Zap,
      label: "DoraHacks",
      color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      hoverColor: "hover:bg-purple-500/20 hover:border-purple-500/50",
    },
    devpost: {
      icon: Trophy,
      label: "Devpost",
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      hoverColor: "hover:bg-emerald-500/20 hover:border-emerald-500/50",
    },
  };

  return (
    <div className={`flex flex-wrap gap-2 items-center ${compact ? "" : ""}`}>
      {sources.map((source) => {
        const config = sourceConfig[source.toLowerCase()] || sourceConfig.devpost;
        const Icon = config.icon;
        const url = sourceUrls[source];
        const isPrimary = source === primarySource;

        const badge = (
          <div
            className={`
              flex items-center gap-1.5 px-2.5 py-1
              border rounded-lg text-xs font-medium shrink-0
              transition-colors duration-200
              ${isPrimary ? `${config.color} ring-1 ring-offset-1 ring-offset-card ring-current` : config.color}
              ${url ? config.hoverColor : "cursor-default"}
            `}
          >
            <Icon className="w-3 h-3" />
            <span>{config.label}</span>
            {isPrimary && <span className="ml-0.5 text-xs">★</span>}
          </div>
        );

        if (url) {
          return (
            <a
              key={source}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
              title={`View on ${config.label}`}
            >
              {badge}
            </a>
          );
        }

        return <div key={source}>{badge}</div>;
      })}
    </div>
  );
}
