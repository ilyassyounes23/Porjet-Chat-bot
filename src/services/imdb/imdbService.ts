import type { MovieRatings } from '@/types/movie';

const RATINGS_CACHE_KEY = 'noir_omdb_ratings_cache_v1';

interface CachedRatingPayload {
  imdbRating: number | null;
  imdbVotes: number | null;
  rottenTomatoes: string | null;
  fetchedAt: number;
}

const memoryCache = new Map<string, CachedRatingPayload>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

function readStorageCache(): Record<string, CachedRatingPayload> {
  try {
    const raw = localStorage.getItem(RATINGS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CachedRatingPayload>) : {};
  } catch {
    return {};
  }
}

function writeStorageCache(key: string, value: CachedRatingPayload) {
  try {
    const all = readStorageCache();
    all[key] = value;
    // Keep cache bounded to ~400 entries
    const keys = Object.keys(all);
    if (keys.length > 400) {
      delete all[keys[0]];
    }
    localStorage.setItem(RATINGS_CACHE_KEY, JSON.stringify(all));
  } catch {
    // Ignore quota errors
  }
}

export async function fetchVerifiedExternalRatings(params: {
  imdbId?: string | null;
  title: string;
  year?: number;
}): Promise<{ imdbRating: number | null; imdbVotes: number | null; rottenTomatoes: string | null } | null> {
  const cacheKey = params.imdbId || `${params.title.toLowerCase()}:${params.year ?? ''}`;
  const mem = memoryCache.get(cacheKey);
  if (mem && Date.now() - mem.fetchedAt < CACHE_TTL) {
    return mem;
  }

  const stored = readStorageCache()[cacheKey];
  if (stored && Date.now() - stored.fetchedAt < CACHE_TTL) {
    memoryCache.set(cacheKey, stored);
    return stored;
  }

  try {
    const qs = new URLSearchParams();
    if (params.imdbId) qs.set('imdbId', params.imdbId);
    qs.set('title', params.title);
    if (params.year) qs.set('year', String(params.year));

    const res = await fetch(`/api/ratings?${qs.toString()}`);
    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      configured?: boolean;
      imdbRating?: number | null;
      imdbVotes?: number | null;
      rottenTomatoes?: string | null;
    };

    if (!data.configured) return null;

    const payload: CachedRatingPayload = {
      imdbRating: typeof data.imdbRating === 'number' ? data.imdbRating : null,
      imdbVotes: typeof data.imdbVotes === 'number' ? data.imdbVotes : null,
      rottenTomatoes: typeof data.rottenTomatoes === 'string' ? data.rottenTomatoes : null,
      fetchedAt: Date.now(),
    };

    memoryCache.set(cacheKey, payload);
    writeStorageCache(cacheKey, payload);
    return payload;
  } catch {
    return null;
  }
}

export async function fetchImdbRating(params: {
  imdbId?: string | null;
  title: string;
  year?: number;
  existing?: MovieRatings;
}): Promise<{ imdb: number | null; imdbVotes: number | null }> {
  const external = await fetchVerifiedExternalRatings(params);
  if (external && external.imdbRating !== null) {
    return { imdb: external.imdbRating, imdbVotes: external.imdbVotes };
  }
  return {
    imdb: params.existing?.imdb ?? null,
    imdbVotes: params.existing?.imdbVotes ?? null,
  };
}
