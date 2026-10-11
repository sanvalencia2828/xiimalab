"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Database } from "lucide-react";
import { isUsdPrize } from "@/lib/hackathons/format";
import { buildTagOptions, hackathonTagKeys } from "@/lib/hackathons/tags";
import type { AggregatedHackathon } from "@/lib/types";
import { AggregatedHackathonCard } from "./AggregatedHackathonCard";
import { HackathonComparisonModal } from "./HackathonComparisonModal";

type SortBy = "deadline" | "prize" | "match";

interface AggregatedHackathonsClientProps {
  /** Todas las hackatones abiertas; los filtros, el orden y la paginación se aplican aquí */
  hackathons: AggregatedHackathon[];
}

const PAGE_SIZE = 50;
const TOP_TAGS = 12;

const SORTS: { key: SortBy; label: string }[] = [
  { key: "deadline", label: "Cierra antes" },
  { key: "prize", label: "Mayor premio" },
  { key: "match", label: "Mejor match" },
];

const MIN_PRIZES = [
  { value: 0, label: "Cualquiera" },
  { value: 5000, label: "$5.000 o más" },
  { value: 10000, label: "$10.000 o más" },
  { value: 25000, label: "$25.000 o más" },
  { value: 50000, label: "$50.000 o más" },
];

const fieldClass =
  "w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

/** Importe comparable: solo premios en USD; el resto va al final al ordenar y no pasa el premio mínimo. */
function usdPrize(h: AggregatedHackathon): number {
  return isUsdPrize(h.prize_pool, h.prize_currency) ? h.prize_pool : -1;
}

export function AggregatedHackathonsClient({ hackathons }: AggregatedHackathonsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minPrize, setMinPrize] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("deadline");
  const [showAllTags, setShowAllTags] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedHackathon, setSelectedHackathon] = useState<AggregatedHackathon | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const tagOptions = useMemo(() => buildTagOptions(hackathons), [hackathons]);
  const shownTags = showAllTags ? tagOptions : tagOptions.slice(0, TOP_TAGS);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = hackathons.filter((h) => {
      if (minPrize > 0 && usdPrize(h) < minPrize) return false;
      if (selectedTags.length > 0) {
        const keys = hackathonTagKeys(h);
        if (!selectedTags.some((t) => keys.includes(t))) return false;
      }
      if (!query) return true;
      return (
        h.title.toLowerCase().includes(query) ||
        (h.organizer ?? "").toLowerCase().includes(query) ||
        (h.tags ?? []).some((t) => t.toLowerCase().includes(query))
      );
    });
    return [...list].sort((a, b) => {
      // Sin fecha de cierre → al final
      const byDeadline = (a.deadline || "9999").localeCompare(b.deadline || "9999");
      if (sortBy === "prize") return usdPrize(b) - usdPrize(a) || byDeadline;
      if (sortBy === "match") return (b.match_score ?? 0) - (a.match_score ?? 0) || byDeadline;
      return byDeadline;
    });
  }, [hackathons, searchQuery, selectedTags, minPrize, sortBy]);

  // Al cambiar filtros u orden se vuelve a la primera página
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedTags, minPrize, sortBy]);

  const visible = filtered.slice(0, visibleCount);
  const hasFilters = searchQuery.trim() !== "" || selectedTags.length > 0 || minPrize > 0;
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTags([]);
    setMinPrize(0);
  };

  // Sin datos: ninguna fuente devolvió convocatorias
  if (hackathons.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card border border-border rounded-2xl text-center py-12 px-6"
      >
        <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-200 font-medium mb-2">No hay hackatones abiertas ahora mismo</p>
        <p className="text-muted-text text-sm">
          Devpost, DoraHacks y Devfolio no devolvieron convocatorias. Vuelve a intentarlo en unos minutos.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" />
          <input
            type="search"
            aria-label="Buscar hackatones"
            placeholder="Buscar por título, organizador o etiqueta"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${fieldClass} pl-9`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="hack-min-prize" className="block text-xs font-medium text-slate-400 mb-1.5">Premio mínimo</label>
            <select id="hack-min-prize" value={minPrize} onChange={(e) => setMinPrize(Number(e.target.value))} className={fieldClass}>
              {MIN_PRIZES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hack-sort" className="block text-xs font-medium text-slate-400 mb-1.5">Ordenar por</label>
            <select id="hack-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className={fieldClass}>
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {tagOptions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">
              Etiquetas
              {selectedTags.length > 0 && (
                <span className="ml-2 text-accent">
                  {selectedTags.length} seleccionada{selectedTags.length === 1 ? "" : "s"}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {shownTags.map((tag) => {
                const selected = selectedTags.includes(tag.key);
                return (
                  <button
                    key={tag.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setSelectedTags((prev) => (selected ? prev.filter((t) => t !== tag.key) : [...prev, tag.key]))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-accent text-card border-accent"
                        : "bg-slate-700/50 text-slate-300 border-slate-600/30 hover:border-accent/50"
                    }`}
                  >
                    {tag.label}
                    <span className={`ml-1.5 font-mono ${selected ? "opacity-70" : "text-muted-text"}`}>{tag.count}</span>
                  </button>
                );
              })}
              {tagOptions.length > TOP_TAGS && (
                <button
                  type="button"
                  onClick={() => setShowAllTags((v) => !v)}
                  className="px-3 py-1.5 text-xs font-medium text-accent hover:underline"
                >
                  {showAllTags ? "Ver menos" : `Ver todas (${tagOptions.length})`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filtros sin resultados */}
      {filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card border border-border rounded-2xl text-center py-12 px-6"
        >
          <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-200 font-medium mb-2">Ninguna hackatón coincide con tus filtros</p>
          <p className="text-muted-text text-sm">Prueba con otra búsqueda, menos etiquetas o un premio mínimo más bajo.</p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30 hover:border-accent/50 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </motion.div>
      )}

      {/* Lista */}
      {filtered.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visible.map((hackathon, idx) => (
              <AggregatedHackathonCard
                key={hackathon.id}
                hackathon={hackathon}
                index={idx % PAGE_SIZE}
                onExpandClick={(h) => {
                  setSelectedHackathon(h);
                  setIsModalOpen(true);
                }}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-xs text-muted-text">
              Mostrando {visible.length} de {filtered.length}
              {filtered.length !== hackathons.length ? ` (${hackathons.length} abiertas en total)` : ""}
            </p>
            {visible.length < filtered.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="btn-ghost text-sm px-4 py-2"
              >
                Cargar más
              </button>
            )}
          </div>
        </>
      )}

      <HackathonComparisonModal
        hackathon={selectedHackathon}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
