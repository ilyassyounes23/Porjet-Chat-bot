import { fetchVerifiedExternalRatings } from '@/services/imdb/imdbService';
import { fetchPaginatedTmdbCatalog, fetchTmdbMovieDetails } from '@/services/tmdb/tmdbClient';
import type { Movie } from '@/types/movie';

const CATALOG_CACHE_KEY = 'noir_tmdb_catalog_cache_v2';
const CATALOG_TTL_MS = 1000 * 60 * 30;

function titleYearKey(title: string, year: number): string {
  return `${title.toLowerCase().replace(/[^a-z0-9]/g, '')}:${year}`;
}

/**
 * Merges legitimate IMDb non-commercial dataset ratings, RT scores, and verified
 * public-domain Archive.org streams from the curated index into live TMDB entries
 * on exact title+year match, while preserving playable public-domain screenings.
 */
function hydrateLiveWithVerifiedIndex(liveMovies: Movie[], curated: Movie[]): Movie[] {
  const curatedByKey = new Map<string, Movie>();
  for (const item of curated) {
    curatedByKey.set(titleYearKey(item.title, item.releaseYear), item);
  }

  const seenKeys = new Set<string>();
  const enrichedLive = liveMovies.map((m) => {
    const key = titleYearKey(m.title, m.releaseYear);
    seenKeys.add(key);
    const match = curatedByKey.get(key);
    if (!match) return m;

    return {
      ...m,
      imdbId: m.imdbId ?? match.imdbId,
      duration: m.duration ?? match.duration,
      director: m.director ?? match.director,
      actors: m.actors.length > 0 ? m.actors : match.actors,
      youtubeTrailerId: m.youtubeTrailerId ?? match.youtubeTrailerId,
      playableStream: m.playableStream ?? match.playableStream,
      ratings: {
        ...m.ratings,
        imdb: m.ratings.imdb ?? match.ratings.imdb,
        imdbVotes: m.ratings.imdbVotes ?? match.ratings.imdbVotes,
        rottenTomatoes: m.ratings.rottenTomatoes ?? match.ratings.rottenTomatoes,
        source:
          match.ratings.imdb !== null || match.ratings.rottenTomatoes !== null
            ? match.ratings.source
            : m.ratings.source,
      },
    };
  });

  // Always include verified full-feature public-domain archive films if absent from TMDB batch
  const extraPlayable = curated.filter(
    (item) => Boolean(item.playableStream) && !seenKeys.has(titleYearKey(item.title, item.releaseYear))
  );

  return [...enrichedLive, ...extraPlayable];
}

export type CatalogSourceMode = 'tmdb-live' | 'demo-curated';

export interface LoadedCatalogResult {
  movies: Movie[];
  mode: CatalogSourceMode;
  omdbEnabled: boolean;
}

async function loadDemoMovies(): Promise<Movie[]> {
  const mod = await import('@/data/demoCatalog.json');
  return mod.default as Movie[];
}

let inFlightCatalogLoad: Promise<LoadedCatalogResult> | null = null;

export async function loadMovieCatalog(): Promise<LoadedCatalogResult> {
  if (inFlightCatalogLoad) return inFlightCatalogLoad;
  inFlightCatalogLoad = (async () => {
    try {
      return await loadMovieCatalogInternal();
    } finally {
      inFlightCatalogLoad = null;
    }
  })();
  return inFlightCatalogLoad;
}

async function loadMovieCatalogInternal(): Promise<LoadedCatalogResult> {
  let tmdbConfigured = false;
  let omdbEnabled = false;

  try {
    const statusRes = await fetch('/api/config/status');
    if (statusRes.ok) {
      const status = (await statusRes.json()) as {
        tmdbConfigured?: boolean;
        omdbConfigured?: boolean;
      };
      tmdbConfigured = Boolean(status.tmdbConfigured);
      omdbEnabled = Boolean(status.omdbConfigured);
    }
  } catch {
    // Use demo catalog if server middleware isn't responding
  }

  if (tmdbConfigured) {
    try {
      const cachedRaw = localStorage.getItem(CATALOG_CACHE_KEY);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as { fetchedAt: number; movies: Movie[] };
        if (Date.now() - parsed.fetchedAt < CATALOG_TTL_MS && parsed.movies.length >= 500) {
          return { movies: parsed.movies, mode: 'tmdb-live', omdbEnabled };
        }
      }

      const liveMovies = await fetchPaginatedTmdbCatalog();
      if (liveMovies.length >= 500) {
        const curated = await loadDemoMovies();
        const combined = hydrateLiveWithVerifiedIndex(liveMovies, curated);
        try {
          localStorage.setItem(
            CATALOG_CACHE_KEY,
            JSON.stringify({ fetchedAt: Date.now(), movies: combined })
          );
        } catch {
          // Ignore storage quota if catalog exceeds 5MB
        }
        return { movies: combined, mode: 'tmdb-live', omdbEnabled };
      }
    } catch {
      // Gracefully fall back to curated demo catalog on network errors
    }
  }

  return {
    movies: await loadDemoMovies(),
    mode: 'demo-curated',
    omdbEnabled,
  };
}

/**
 * Enriches a movie on demand:
 * - For live TMDB items: pulls credits, runtime, countries, IMDB ID & YouTube trailers.
 * - When OMDb is configured: fetches genuine IMDb & Rotten Tomatoes ratings.
 */
export async function enrichMovieMetadata(
  movie: Movie,
  options: { omdbEnabled: boolean }
): Promise<Movie> {
  let enriched = { ...movie };

  if (movie.tmdbId && !movie.detailsLoaded) {
    try {
      const tmdbDetails = await fetchTmdbMovieDetails(movie.tmdbId);
      enriched = {
        ...enriched,
        ...tmdbDetails,
        genres: tmdbDetails.genres && tmdbDetails.genres.length > 0 ? tmdbDetails.genres : enriched.genres,
        actors: tmdbDetails.actors && tmdbDetails.actors.length > 0 ? tmdbDetails.actors : enriched.actors,
      };
    } catch {
      enriched.detailsLoaded = true;
    }
  }

  if (options.omdbEnabled && (enriched.ratings.imdb === null || enriched.ratings.rottenTomatoes === null)) {
    const ext = await fetchVerifiedExternalRatings({
      imdbId: enriched.imdbId,
      title: enriched.title,
      year: enriched.releaseYear,
    });
    if (ext) {
      enriched.ratings = {
        ...enriched.ratings,
        imdb: ext.imdbRating ?? enriched.ratings.imdb,
        imdbVotes: ext.imdbVotes ?? enriched.ratings.imdbVotes,
        rottenTomatoes: ext.rottenTomatoes ?? enriched.ratings.rottenTomatoes,
        source: ext.imdbRating !== null || ext.rottenTomatoes !== null ? 'omdb' : enriched.ratings.source,
      };
    }
  }

  enriched.detailsLoaded = true;
  return enriched;
}
