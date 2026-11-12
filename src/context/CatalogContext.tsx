import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  enrichMovieMetadata,
  loadMovieCatalog,
  type CatalogSourceMode,
} from '@/services/catalog/catalogService';
import type { Movie } from '@/types/movie';
import { getGenreMatch } from '@/utils/formatters';

export interface CatalogSection {
  id: string;
  title: string;
  subtitle: string;
  filterParam: Record<string, string>;
  movies: Movie[];
}

interface CatalogContextValue {
  movies: Movie[];
  loading: boolean;
  error: string | null;
  mode: CatalogSourceMode;
  omdbEnabled: boolean;
  heroMovies: Movie[];
  sections: CatalogSection[];
  getMovieById: (id: string) => Movie | undefined;
  enrichMovie: (id: string) => Promise<Movie | undefined>;
  refreshCatalog: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

function uniqueTake(list: Movie[], limit: number, predicate?: (movie: Movie) => boolean): Movie[] {
  const seen = new Set<string>();
  const out: Movie[] = [];
  for (const m of list) {
    if (predicate && !predicate(m)) continue;
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
    if (out.length >= limit) break;
  }
  return out;
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<CatalogSourceMode>('demo-curated');
  const [omdbEnabled, setOmdbEnabled] = useState(false);

  const mountedRef = useRef(true);
  const attemptedEnrichRef = useRef<Set<string>>(new Set());
  const inFlightEnrichRef = useRef<Map<string, Promise<Movie | undefined>>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    attemptedEnrichRef.current.clear();
    try {
      const result = await loadMovieCatalog();
      if (!mountedRef.current) return;
      setMovies(result.movies);
      setMode(result.mode);
      setOmdbEnabled(result.omdbEnabled);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load film archive.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const movieIndex = useMemo(() => {
    const map = new Map<string, Movie>();
    for (const m of movies) {
      map.set(m.id, m);
    }
    // Also index secondary identifiers (imdbId, tmdb-<id>) so cross-source links resolve reliably
    for (const m of movies) {
      if (m.imdbId && !map.has(m.imdbId)) {
        map.set(m.imdbId, m);
      }
      if (m.tmdbId && !map.has(`tmdb-${m.tmdbId}`)) {
        map.set(`tmdb-${m.tmdbId}`, m);
      }
    }
    return map;
  }, [movies]);

  const movieIndexRef = useRef(movieIndex);
  movieIndexRef.current = movieIndex;

  const getMovieById = useCallback((id: string) => movieIndexRef.current.get(id), []);

  const enrichMovie = useCallback(
    async (id: string): Promise<Movie | undefined> => {
      const existing = movieIndexRef.current.get(id);
      if (!existing) return undefined;

      const attemptKey = `${existing.id}:${omdbEnabled ? 'omdb' : 'base'}`;
      if (
        existing.detailsLoaded &&
        (!omdbEnabled || existing.ratings.source === 'omdb' || attemptedEnrichRef.current.has(attemptKey))
      ) {
        return existing;
      }

      const activePromise = inFlightEnrichRef.current.get(attemptKey);
      if (activePromise) return activePromise;

      attemptedEnrichRef.current.add(attemptKey);
      const task = (async () => {
        try {
          const updated = await enrichMovieMetadata(existing, { omdbEnabled });
          if (mountedRef.current) {
            setMovies((prev) => prev.map((m) => (m.id === existing.id ? updated : m)));
          }
          return updated;
        } finally {
          inFlightEnrichRef.current.delete(attemptKey);
        }
      })();

      inFlightEnrichRef.current.set(attemptKey, task);
      return task;
    },
    [omdbEnabled]
  );

  // Curated hero showcase: films with rich backdrop/trailer or playable stream + high visual presence
  const heroMovies = useMemo(() => {
    if (movies.length === 0) return [];
    const prioritized = movies
      .filter((m) => (m.backdropUrl || m.posterUrl) && m.description.length > 60)
      .sort((a, b) => {
        const aBackdrop = a.backdropUrl ? 1 : 0;
        const bBackdrop = b.backdropUrl ? 1 : 0;
        if (aBackdrop !== bBackdrop) return bBackdrop - aBackdrop;
        const aScore =
          (a.ratings.imdb ?? 7) * 15 +
          Math.log10(Math.max(a.popularity, 10)) * 20 +
          (a.releaseYear >= 2014 ? 12 : 0) +
          (a.director ? 25 : 0) +
          (a.ratings.rottenTomatoes ? 10 : 0);
        const bScore =
          (b.ratings.imdb ?? 7) * 15 +
          Math.log10(Math.max(b.popularity, 10)) * 20 +
          (b.releaseYear >= 2014 ? 12 : 0) +
          (b.director ? 25 : 0) +
          (b.ratings.rottenTomatoes ? 10 : 0);
        return bScore - aScore;
      });
    return uniqueTake(prioritized, 5);
  }, [movies]);

  // Lazily hydrate Hero showcase movies once per session in a single batched state update
  useEffect(() => {
    if (heroMovies.length === 0) return;
    const pendingHero = heroMovies.filter((m) => {
      const attemptKey = `${m.id}:${omdbEnabled ? 'omdb' : 'base'}`;
      if (attemptedEnrichRef.current.has(attemptKey) || inFlightEnrichRef.current.has(attemptKey)) {
        return false;
      }
      return !m.detailsLoaded || (omdbEnabled && m.ratings.source !== 'omdb');
    });
    if (pendingHero.length === 0) return;

    for (const m of pendingHero) {
      attemptedEnrichRef.current.add(`${m.id}:${omdbEnabled ? 'omdb' : 'base'}`);
    }

    void Promise.all(
      pendingHero.map(async (m) => {
        try {
          return await enrichMovieMetadata(m, { omdbEnabled });
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (!mountedRef.current) return;
      const updatesById = new Map<string, Movie>();
      for (const updated of results) {
        if (updated) updatesById.set(updated.id, updated);
      }
      if (updatesById.size === 0) return;
      setMovies((prev) => prev.map((m) => updatesById.get(m.id) ?? m));
    });
  }, [heroMovies, omdbEnabled]);

  // All 15 mandatory horizontal cinema shelves
  const sections = useMemo<CatalogSection[]>(() => {
    if (movies.length === 0) return [];

    const byPopularity = [...movies].sort((a, b) => b.popularity - a.popularity);

    const trending = uniqueTake(
      byPopularity,
      22,
      (m) => Boolean(m.tags?.includes('trending')) || m.releaseYear >= 2021
    );

    const popular = uniqueTake(byPopularity, 22);

    const topRated = uniqueTake(
      [...movies]
        .filter((m) => (m.ratings.imdb ?? 0) > 0 || (m.ratings.tmdbScore ?? 0) > 0)
        .sort((a, b) => {
          const sa = a.ratings.imdb ?? a.ratings.tmdbScore ?? 0;
          const sb = b.ratings.imdb ?? b.ratings.tmdbScore ?? 0;
          return sb - sa;
        }),
      22
    );

    const newReleases = uniqueTake(
      [...movies]
        .filter((m) => m.releaseYear >= 2022)
        .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)),
      22
    );

    const hiddenGems = uniqueTake(
      [...movies]
        .filter((m) => {
          const score = m.ratings.imdb ?? m.ratings.tmdbScore ?? 0;
          const votes = m.ratings.imdbVotes ?? 25000;
          return (
            m.tags?.includes('hidden_gem') ||
            (score >= 7.2 && votes >= 2000 && votes <= 95000 && m.releaseYear >= 1985)
          );
        })
        .sort((a, b) => (b.ratings.imdb ?? 7) - (a.ratings.imdb ?? 7)),
      22
    );

    const classicCinema = uniqueTake(
      [...movies]
        .filter((m) => m.releaseYear > 0 && m.releaseYear <= 1984)
        .sort((a, b) => (b.ratings.imdb ?? 7) - (a.ratings.imdb ?? 7)),
      22
    );

    const byGenre = (genre: string) =>
      uniqueTake(byPopularity, 22, (m) => getGenreMatch(m, genre));

    const rawSections: CatalogSection[] = [
      {
        id: 'trending',
        title: 'Trending Now',
        subtitle: 'Films drawing the widest international conversation this week',
        filterParam: { collection: 'trending', sort: 'most_popular' },
        movies: trending,
      },
      {
        id: 'popular',
        title: 'Popular Movies',
        subtitle: 'Most watched features across the NOIR archive',
        filterParam: { sort: 'most_popular' },
        movies: popular,
      },
      {
        id: 'top-rated',
        title: 'Top Rated',
        subtitle: 'Highest critically acclaimed selections by verified scores',
        filterParam: { sort: 'highest_rated' },
        movies: topRated,
      },
      {
        id: 'new-releases',
        title: 'New Releases',
        subtitle: 'Contemporary theatrical debuts and festival arrivals',
        filterParam: { sort: 'latest_releases' },
        movies: newReleases,
      },
      {
        id: 'action',
        title: 'Action',
        subtitle: 'Kinetic choreography, espionage, and high-stakes set pieces',
        filterParam: { genre: 'Action' },
        movies: byGenre('Action'),
      },
      {
        id: 'sci-fi',
        title: 'Science Fiction',
        subtitle: 'Speculative futures, cosmic solitude, and synthetic memory',
        filterParam: { genre: 'Science Fiction' },
        movies: byGenre('Science Fiction'),
      },
      {
        id: 'thriller',
        title: 'Thriller',
        subtitle: 'Taut psychological tension, noir conspiracy, and moral shadows',
        filterParam: { genre: 'Thriller' },
        movies: byGenre('Thriller'),
      },
      {
        id: 'horror',
        title: 'Horror',
        subtitle: 'Atmospheric dread, folk horror, and midnight cinema',
        filterParam: { genre: 'Horror' },
        movies: byGenre('Horror'),
      },
      {
        id: 'drama',
        title: 'Drama',
        subtitle: 'Intimate character studies and human portraiture',
        filterParam: { genre: 'Drama' },
        movies: byGenre('Drama'),
      },
      {
        id: 'comedy',
        title: 'Comedy',
        subtitle: 'Sharp satire, deadpan farce, and screwball classics',
        filterParam: { genre: 'Comedy' },
        movies: byGenre('Comedy'),
      },
      {
        id: 'adventure',
        title: 'Adventure',
        subtitle: 'Expeditions, odysseys, and sweeping frontier epics',
        filterParam: { genre: 'Adventure' },
        movies: byGenre('Adventure'),
      },
      {
        id: 'animation',
        title: 'Animation',
        subtitle: 'Hand-drawn masterworks and boundary-pushing visual worlds',
        filterParam: { genre: 'Animation' },
        movies: byGenre('Animation'),
      },
      {
        id: 'documentary',
        title: 'Documentary',
        subtitle: 'Non-fiction portraiture, essay cinema, and investigative craft',
        filterParam: { genre: 'Documentary' },
        movies: byGenre('Documentary'),
      },
      {
        id: 'hidden-gems',
        title: 'Hidden Gems',
        subtitle: 'Overlooked festival favorites deserving a second screening',
        filterParam: { popularityFloor: 'hidden_gems', sort: 'highest_rated' },
        movies: hiddenGems,
      },
      {
        id: 'classic-cinema',
        title: 'Classic Cinema',
        subtitle: 'Restored pre-1985 milestones that shaped film grammar',
        filterParam: { year: 'classic', sort: 'highest_rated' },
        movies: classicCinema,
      },
    ];

    return rawSections.filter((s) => s.movies.length > 0);
  }, [movies]);

  const contextValue = useMemo<CatalogContextValue>(
    () => ({
      movies,
      loading,
      error,
      mode,
      omdbEnabled,
      heroMovies,
      sections,
      getMovieById,
      enrichMovie,
      refreshCatalog: load,
    }),
    [movies, loading, error, mode, omdbEnabled, heroMovies, sections, getMovieById, enrichMovie, load]
  );

  return (
    <CatalogContext.Provider value={contextValue}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}
