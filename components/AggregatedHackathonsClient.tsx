"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Filter, TrendingUp, Database, AlertCircle } from "lucide-react";
import type { AggregatedHackathon } from "@/lib/types";
import { useAggregatedHackathons } from "@/hooks/useAggregatedHackathons";
import { AggregatedHackathonCard } from "./AggregatedHackathonCard";
import { HackathonComparisonModal } from "./HackathonComparisonModal";
import { SourceBadges } from "./SourceBadges";
import { useWallet } from "@/lib/WalletContext";

export function AggregatedHackathonsClient() {
  // Wallet context
  const { publicKey: wallet } = useWallet();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minPrize, setMinPrize] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"personalized_score" | "urgency" | "value" | "match" | "prize">(
    wallet ? "personalized_score" : "urgency"
  );

  // Track which hackathon is expanded
  const [selectedHackathon, setSelectedHackathon] = useState<AggregatedHackathon | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch data
  const { hackathons, total, isLoading, error } = useAggregatedHackathons({
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    minPrize: minPrize > 0 ? minPrize : undefined,
    wallet: wallet ?? undefined,
    sortBy,
    limit: 50,
  });

  // Filter by search query (client-side)
  const filteredHackathons = hackathons.filter((h) =>
    h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.organizer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // All unique tags from current data
  const allTags = Array.from(
    new Set(hackathons.flatMap((h) => h.tags || []))
  ).sort() as string[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-xs font-medium text-accent uppercase tracking-widest">
            Multi-Source Discovery
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-5 h-5 text-slate-400" />
          <h1 className="text-3xl font-bold text-slate-200">
            Aggregated Opportunities
          </h1>
        </div>
        <p className="text-sm text-muted-text">
          {total > 0
            ? `${total} hackathons from Devfolio, DoraHacks, and Devpost`
            : "Searching for hackathons..."}
        </p>
      </div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" />
          <input
            type="text"
            placeholder="Search by title, organizer, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 placeholder-muted-text focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Min Prize */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Min Prize
            </label>
            <select
              value={minPrize}
              onChange={(e) => setMinPrize(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value={0}>Any amount</option>
              <option value={5000}>$5k+</option>
              <option value={10000}>$10k+</option>
              <option value={25000}>$25k+</option>
              <option value={50000}>$50k+</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Sort by
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {wallet && (
                <option value="personalized_score">My Match (Personalized)</option>
              )}
              <option value="urgency">Most Urgent</option>
              <option value="value">Highest Prize</option>
              <option value="match">Best Match</option>
            </select>
          </div>

          {/* Tag Filter Info */}
          <div className="flex items-end">
            <div className="text-xs text-muted-text">
              {selectedTags.length > 0 && (
                <span>
                  Filtering by {selectedTags.length} tag
                  {selectedTags.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tag Selection */}
        {allTags.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Filter by Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {allTags.slice(0, 12).map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setSelectedTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                    )
                  }
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${
                      selectedTags.includes(tag)
                        ? "bg-accent text-card border border-accent"
                        : "bg-slate-700/50 text-slate-300 border border-slate-600/30 hover:border-accent/50"
                    }
                  `}
                >
                  {tag}
                </button>
              ))}
              {allTags.length > 12 && (
                <span className="text-xs text-muted-text self-center">
                  +{allTags.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      {wallet && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-lg text-accent text-xs font-medium"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Showing personalized recommendations based on your wallet
        </motion.div>
      )}

      {/* Grid or Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-5 animate-pulse"
            >
              <div className="h-4 w-3/4 rounded bg-slate-700 mb-3" />
              <div className="h-3 w-full rounded bg-slate-700 mb-2" />
              <div className="h-3 w-2/3 rounded bg-slate-700" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredHackathons.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-2">No hackathons found</p>
          <p className="text-muted-text text-sm">
            Try adjusting your filters or check back later for new opportunities
          </p>
        </motion.div>
      )}

      {/* Hackathons Grid */}
      {!isLoading && filteredHackathons.length > 0 && (
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.05 },
            },
          }}
        >
          {filteredHackathons.map((hackathon, idx) => (
            <AggregatedHackathonCard
              key={hackathon.id}
              hackathon={hackathon}
              index={idx}
              onExpandClick={(h) => {
                setSelectedHackathon(h);
                setIsModalOpen(true);
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Pagination Info */}
      {!isLoading && filteredHackathons.length > 0 && (
        <div className="text-center py-4 text-xs text-muted-text">
          Showing {filteredHackathons.length} of {total} hackathons
        </div>
      )}

      {/* Comparison Modal */}
      <HackathonComparisonModal
        hackathon={selectedHackathon}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
