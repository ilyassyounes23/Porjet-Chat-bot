import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { useMovieFilters } from '@/hooks/useMovieFilters';
import { useDebounce } from '@/hooks/useDebounce';
import { MovieCard } from '@/components/movies/MovieCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PosterSkeleton } from '@/components/ui/Skeleton';
import type { DurationFilter, MovieFilterState, SortOption } from '@/types/movie';

const PAGE_SIZE = 36;

export function MoviesPage() {
  const { movies, loading } = useCatalog();
  const {
    filters,
    updateFilter,
    clearFilters,
    facets,
    filteredMovies,
    activeFilterCount,
  } = useMovieFilters(movies);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  const debouncedInput = useDebounce(filters.query, 120);

  // Instant suggestions across title, director, actor
  const suggestions = useMemo(() => {
    const q = debouncedInput.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const items: Array<{ label: string; kind: string; value: string }> = [];
    const seen = new Set<string>();

    for (const m of movies) {
      if (m.title.toLowerCase().includes(q) && !seen.has(`t:${m.title}`)) {
        seen.add(`t:${m.title}`);
        items.push({ label: m.title, kind: `${m.releaseYear}`, value: m.title });
      }
      if (m.director && m.director.toLowerCase().includes(q) && !seen.has(`d:${m.director}`)) {
        seen.add(`d:${m.director}`);
        items.push({ label: m.director, kind: 'Director', value: m.director });
      }
      for (const actor of m.actors) {
        if (actor.toLowerCase().includes(q) && !seen.has(`a:${actor}`)) {
          seen.add(`a:${actor}`);
          items.push({ label: actor, kind: 'Actor', value: actor });
        }
      }
      if (items.length >= 8) break;
    }
    return items.slice(0, 8);
  }, [movies, debouncedInput]);

  const visibleMovies = filteredMovies.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMovies.length;

  const activeChips: Array<{ label: string; onClear: () => void }> = [];
  if (filters.query.trim()) {
    activeChips.push({
      label: `Search: "${filters.query.trim()}"`,
      onClear: () => updateFilter('query', ''),
    });
  }
  if (filters.collection) {
    activeChips.push({
      label: `Collection: ${filters.collection}`,
      onClear: () => updateFilter('collection', ''),
    });
  }
  if (filters.genre !== 'all') {
    activeChips.push({ label: `Genre: ${filters.genre}`, onClear: () => updateFilter('genre', 'all') });
  }
  if (filters.year !== 'all') {
    activeChips.push({
      label: `Era: ${filters.year === 'classic' ? 'Pre-1985 Classic' : filters.year}`,
      onClear: () => updateFilter('year', 'all'),
    });
  }
  if (filters.minImdbRating > 0) {
    activeChips.push({
      label: `IMDb >= ${filters.minImdbRating.toFixed(1)}`,
      onClear: () => updateFilter('minImdbRating', 0),
    });
  }
  if (filters.duration !== 'all') {
    const durLabel: Record<DurationFilter, string> = {
      all: '',
      under_90: 'Under 90 min',
      '90_to_120': '90–120 min',
      '120_to_150': '120–150 min',
      over_150: 'Over 150 min',
    };
    activeChips.push({
      label: `Runtime: ${durLabel[filters.duration]}`,
      onClear: () => updateFilter('duration', 'all'),
    });
  }
  if (filters.language !== 'all') {
    activeChips.push({
      label: `Language: ${filters.language}`,
      onClear: () => updateFilter('language', 'all'),
    });
  }
  if (filters.country !== 'all') {
    activeChips.push({
      label: `Country: ${filters.country}`,
      onClear: () => updateFilter('country', 'all'),
    });
  }
  if (filters.popularityFloor !== 'all') {
    activeChips.push({
      label: `Curated: ${filters.popularityFloor.replace('_', ' ')}`,
      onClear: () => updateFilter('popularityFloor', 'all'),
    });
  }

  return (
    <main className="min-h-screen bg-[#090909] pt-28 pb-20 px-5 sm:px-8 lg:px-14 max-w-[1600px] mx-auto">
      {/* Editorial Archive Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border-b border-white/[0.08] pb-8 mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#C6A46A]" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#C6A46A]">
              Complete Film Index
            </span>
          </div>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-medium text-[#F5F5F5] tracking-tight">
            Discover Archive
          </h1>
          <p className="text-sm text-[#929292] max-w-xl">
            Filter across {movies.length} real feature films by title, director, cast, era, runtime,
            origin, and verified IMDb rating.
          </p>
        </div>

        {/* Search Input with Live Autocomplete Suggestions */}
        <div className="relative w-full lg:w-[440px]">
          <div className="flex items-center bg-[#121212] border border-white/15 focus-within:border-[#C6A46A] transition-colors px-4 py-3">
            <Search className="w-4 h-4 text-[#C6A46A] shrink-0 mr-3" />
            <input
              type="text"
              value={filters.query}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 160)}
              onChange={(e) => {
                updateFilter('query', e.target.value);
                setVisibleCount(PAGE_SIZE);
                setSuggestionsOpen(true);
              }}
              placeholder="Title, actor, director, genre, or year..."
              className="flex-1 bg-transparent text-sm text-[#F5F5F5] placeholder:text-[#666666] focus:outline-none"
            />
            {filters.query && (
              <button
                type="button"
                aria-label="Clear search text"
                onClick={() => updateFilter('query', '')}
                className="text-[#929292] hover:text-[#F5F5F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {suggestionsOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-[#141414] border border-white/15 shadow-2xl z-30 divide-y divide-white/[0.06]">
              {suggestions.map((s) => (
                <button
                  key={`${s.kind}-${s.label}`}
                  type="button"
                  onMouseDown={() => {
                    updateFilter('query', s.value);
                    setSuggestionsOpen(false);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left text-xs hover:bg-white/[0.05] cursor-pointer"
                >
                  <span className="text-[#F5F5F5] truncate">{s.label}</span>
                  <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#C6A46A] shrink-0 ml-3">
                    {s.kind}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Toolbar: Filter Toggle, Result Counter, Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 bg-[#121212] px-3.5 py-2 text-xs uppercase tracking-[0.14em] text-[#F5F5F5] cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#C6A46A]" />
            <span>{filtersOpen ? 'Hide Filters' : 'Show Filters'}</span>
            {activeFilterCount > 0 && (
              <span className="font-mono-tech text-[10px] px-1.5 py-0.5 bg-[#C6A46A] text-[#090909] font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                clearFilters();
                setVisibleCount(PAGE_SIZE);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#929292] hover:text-[#C6A46A] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <span className="font-mono-tech text-xs text-[#929292]">
            {filteredMovies.length} {filteredMovies.length === 1 ? 'Film' : 'Films'}
          </span>

          <div className="flex items-center gap-2">
            <label
              htmlFor="sort-select"
              className="text-[11px] font-mono-tech uppercase tracking-[0.14em] text-[#929292] hidden sm:inline"
            >
              Sort
            </label>
            <select
              id="sort-select"
              value={filters.sort}
              onChange={(e) => updateFilter('sort', e.target.value as SortOption)}
              className="bg-[#121212] border border-white/15 focus:border-[#C6A46A] px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none cursor-pointer"
            >
              <option value="most_popular">Most Popular</option>
              <option value="highest_rated">Highest Rated</option>
              <option value="latest_releases">Latest Releases</option>
              <option value="oldest_releases">Oldest Releases</option>
              <option value="alphabetical">Alphabetical (A–Z)</option>
              <option value="shortest_duration">Shortest Duration</option>
              <option value="longest_duration">Longest Duration</option>
            </select>
          </div>
        </div>
      </div>

      {/* Collapsible Multi-Facet Filter Console */}
      {filtersOpen && (
        <div className="bg-[#111111] border border-white/10 p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {/* Genre */}
          <div className="space-y-1.5">
            <label className="block font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#929292]">
              Genre
            </label>
            <select
              value={filters.genre}
              onChange={(e) => {
                updateFilter('genre', e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="w-full bg-[#181818] border border-white/12 px-3 py-2 text-xs text-[#F5F5F5] focus:border-[#C6A46A] focus:outline-none"
            >
              <option value="all">All Genres</option>
              {facets.genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Release Era / Year */}
          <div className="space-y-1.5">
            <label className="block font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#929292]">
              Release Period
            </label>
            <select
              value={filters.year}
              onChange={(e) => {
                updateFilter('year', e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="w-full bg-[#181818] border border-white/12 px-3 py-2 text-xs text-[#F5F5F5] focus:border-[#C6A46A] focus:outline-none"
            >
              <option value="all">All Eras &amp; Years</option>
              <optgroup label="Decades">
                <option value="2020s">2020s</option>
                <option value="2010s">2010s</option>
                <option value="2000s">2000s</option>
                <option value="1990s">1990s</option>
                <option value="1980s">1980s</option>
                <option value="classic">Classic (Pre-1985)</option>
              </optgroup>
              <optgroup label="Exact Release Year">
                {facets.years.map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Min IMDb Rating */}
          <div className="space-y-1.5">
            <label className="block font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#929292]">
              Min IMDb Score
            </label>
            <select
              value={filters.minImdbRating}
              onChange={(e) => {
                updateFilter('minImdbRating', Number.parseFloat(e.target.value));
                setVisibleCount(PAGE_SIZE);
              }}
              className="w-full bg-[#181818] border border-white/12 px-3 py-2 text-xs text-[#F5F5F5] focus:border-[#C6A46A] focus:outline-none"
            >
              <option value={0}>Any Rating</option>
              <option value={6}>6.0+ IMDb</option>
              <option value={7}>7.0+ IMDb</option>
              <option value={7.5}>7.5+ IMDb</option>
              <option value={8}>8.0+ IMDb</option>
              <option value={8.5}>8.5+ IMDb</option>
            </select>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <label className="block font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#929292]">
              Duration
            </label>
            <select
              value={filters.duration}
              onChange={(e) => {
                updateFilter('duration', e.target.value as DurationFilter);
                setVisibleCount(PAGE_SIZE);
              }}
              className="w-full bg-[#181818] border border-white/12 px-3 py-2 text-xs text-[#F5F5F5] focus:border-[#C6A46A] focus:outline-none"
            >
              <option value="all">Any Runtime</option>
              <option value="under_90">Under 90 min</option>
              <option value="90_to_120">90 – 120 min</option>
              <option value="120_to_150">120 – 150 min</option>
              <option value="over_150">Over 150 min</option>
            </select>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="block font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#929292]">
              Language
            </label>
            <select
              value={filters.language}
              onChange={(e) => {
                updateFilter('language', e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="w-full bg-[#181818] border border-white/12 px-3 py-2 text-xs text-[#F5F5F5] focus:border-[#C6A46A] focus:outline-none"
            >
              <option value="all">All Languages</option>
              {facets.languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <label className="block font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#929292]">
              Country
            </label>
            <select
              value={filters.country}
              onChange={(e) => {
                updateFilter('country', e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="w-full bg-[#181818] border border-white/12 px-3 py-2 text-xs text-[#F5F5F5] focus:border-[#C6A46A] focus:outline-none"
            >
              <option value="all">All Countries</option>
              {facets.countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Popularity Profile */}
          <div className="space-y-1.5">
            <label className="block font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#929292]">
              Popularity
            </label>
            <select
              value={filters.popularityFloor}
              onChange={(e) => {
                updateFilter(
                  'popularityFloor',
                  e.target.value as MovieFilterState['popularityFloor']
                );
                setVisibleCount(PAGE_SIZE);
              }}
              className="w-full bg-[#181818] border border-white/12 px-3 py-2 text-xs text-[#F5F5F5] focus:border-[#C6A46A] focus:outline-none"
            >
              <option value="all">All Releases</option>
              <option value="mainstream">Wide Acclaim (150K+ votes)</option>
              <option value="acclaimed">Critically Acclaimed (7.8+)</option>
              <option value="hidden_gems">Hidden Gems</option>
            </select>
          </div>
        </div>
      )}

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {activeChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onClear}
              className="inline-flex items-center gap-2 border border-[#C6A46A]/45 bg-[#C6A46A]/10 px-3 py-1 text-[11px] font-mono-tech text-[#F5F5F5] hover:bg-[#C6A46A]/20 transition-colors cursor-pointer"
            >
              <span>{chip.label}</span>
              <X className="w-3 h-3 text-[#C6A46A]" />
            </button>
          ))}
        </div>
      )}

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {Array.from({ length: 18 }).map((_, idx) => (
            <PosterSkeleton key={idx} />
          ))}
        </div>
      ) : visibleMovies.length === 0 ? (
        <EmptyState
          title="No Matching Works"
          description="No films in the catalog satisfy your active filter combination. Broaden one or more constraints to restore the archive."
          actionLabel="Reset All Filters"
          onAction={() => {
            clearFilters();
            setVisibleCount(PAGE_SIZE);
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-5">
            {visibleMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} fluid />
            ))}
          </div>

          {hasMore && (
            <div className="mt-14 flex flex-col items-center gap-3">
              <p className="font-mono-tech text-[11px] text-[#929292] uppercase tracking-[0.16em]">
                Showing {visibleMovies.length} of {filteredMovies.length} Films
              </p>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              >
                Load More Films
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
