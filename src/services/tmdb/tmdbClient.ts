import type { Movie } from '@/types/movie';

interface TmdbMovieSummary {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  genre_ids?: number[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  original_language?: string;
  popularity?: number;
  vote_average?: number;
}

interface TmdbListResponse {
  page: number;
  total_pages: number;
  results: TmdbMovieSummary[];
}

interface TmdbDetailResponse extends TmdbMovieSummary {
  runtime?: number | null;
  imdb_id?: string | null;
  genres?: Array<{ id: number; name: string }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages?: Array<{ iso_639_1: string; english_name?: string; name?: string }>;
  credits?: {
    cast?: Array<{ name: string; order: number }>;
    crew?: Array<{ name: string; job: string }>;
  };
  videos?: {
    results?: Array<{ site: string; type: string; key: string; official?: boolean }>;
  };
  external_ids?: {
    imdb_id?: string | null;
  };
}

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  fr: 'French',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  it: 'Italian',
  de: 'German',
  zh: 'Mandarin',
  cn: 'Cantonese',
  pt: 'Portuguese',
  ru: 'Russian',
  sv: 'Swedish',
  da: 'Danish',
  hi: 'Hindi',
  fa: 'Persian',
  pl: 'Polish',
  ar: 'Arabic',
};

export function tmdbPosterUrl(path: string | null | undefined, size: 'w342' | 'w500' | 'w780' = 'w500'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function tmdbBackdropUrl(path: string | null | undefined, size: 'w780' | 'w1280' | 'original' = 'w1280'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

async function fetchTmdbJson<T>(subPath: string): Promise<T> {
  const res = await fetch(`/api/tmdb/${subPath}`);
  if (!res.ok) {
    throw new Error(`TMDB proxy returned ${res.status}`);
  }
  return (await res.json()) as T;
}

function mapTmdbSummaryToMovie(
  item: TmdbMovieSummary,
  genreLookup: Map<number, string>,
  tag: NonNullable<Movie['tags']>[number]
): Movie {
  const releaseDate = item.release_date || '1900-01-01';
  const releaseYear = Number.parseInt(releaseDate.slice(0, 4), 10) || 0;
  const langCode = (item.original_language || 'en').toLowerCase();
  const genres = (item.genre_ids ?? [])
    .map((id) => genreLookup.get(id))
    .filter((g): g is string => Boolean(g));

  const tags: NonNullable<Movie['tags']> = [tag];
  if (releaseYear > 0 && releaseYear <= 1984) {
    tags.push('classic');
  }
  if (releaseYear >= 2024) {
    tags.push('new_release');
  }

  return {
    id: `tmdb-${item.id}`,
    imdbId: null,
    tmdbId: item.id,
    title: item.title,
    originalTitle:
      item.original_title && item.original_title !== item.title ? item.original_title : null,
    description: item.overview?.trim() || 'Synopsis pending retrieval from TMDB.',
    releaseDate,
    releaseYear,
    duration: null,
    genres: genres.length > 0 ? genres : ['Drama'],
    posterUrl: tmdbPosterUrl(item.poster_path, 'w500'),
    backdropUrl: tmdbBackdropUrl(item.backdrop_path, 'w1280'),
    director: null,
    actors: [],
    ratings: {
      // Strictly never assign TMDB vote_average as IMDb rating
      imdb: null,
      imdbVotes: null,
      rottenTomatoes: null,
      tmdbScore:
        typeof item.vote_average === 'number' && item.vote_average > 0
          ? Number(item.vote_average.toFixed(1))
          : null,
      source: 'unavailable',
    },
    language: LANGUAGE_MAP[langCode] ?? langCode.toUpperCase(),
    languageCode: langCode,
    country: 'International',
    trailerUrl: null,
    youtubeTrailerId: null,
    playableStream: null,
    popularity: item.popularity ?? 0,
    tags,
    detailsLoaded: false,
  };
}

/**
 * Retrieves 500+ real movies from TMDB using multi-page pagination across curated endpoints.
 */
export async function fetchPaginatedTmdbCatalog(): Promise<Movie[]> {
  const genreList = await fetchTmdbJson<{ genres: Array<{ id: number; name: string }> }>(
    'genre/movie/list?language=en-US'
  );
  const genreLookup = new Map<number, string>(genreList.genres.map((g) => [g.id, g.name]));

  const endpointPlan: Array<{ path: string; pages: number; tag: NonNullable<Movie['tags']>[number] }> = [
    { path: 'trending/movie/week?language=en-US', pages: 4, tag: 'trending' },
    { path: 'movie/popular?language=en-US', pages: 10, tag: 'popular' },
    { path: 'movie/top_rated?language=en-US', pages: 10, tag: 'top_rated' },
    { path: 'movie/now_playing?language=en-US', pages: 4, tag: 'new_release' },
    { path: 'discover/movie?language=en-US&sort_by=vote_average.desc&vote_count.gte=400&primary_release_date.lte=1984-12-31', pages: 5, tag: 'classic' },
    { path: 'discover/movie?language=en-US&sort_by=vote_average.desc&vote_count.gte=150&vote_count.lte=1200', pages: 5, tag: 'hidden_gem' },
    // Genre-targeted pages to guarantee rich representation across all 15 homepage rows
    { path: 'discover/movie?language=en-US&with_genres=28&sort_by=popularity.desc', pages: 3, tag: 'popular' }, // Action
    { path: 'discover/movie?language=en-US&with_genres=878&sort_by=popularity.desc', pages: 3, tag: 'popular' }, // Sci-Fi
    { path: 'discover/movie?language=en-US&with_genres=53&sort_by=popularity.desc', pages: 3, tag: 'popular' }, // Thriller
    { path: 'discover/movie?language=en-US&with_genres=27&sort_by=popularity.desc', pages: 3, tag: 'popular' }, // Horror
    { path: 'discover/movie?language=en-US&with_genres=18&sort_by=popularity.desc', pages: 3, tag: 'popular' }, // Drama
    { path: 'discover/movie?language=en-US&with_genres=35&sort_by=popularity.desc', pages: 3, tag: 'popular' }, // Comedy
    { path: 'discover/movie?language=en-US&with_genres=12&sort_by=popularity.desc', pages: 3, tag: 'popular' }, // Adventure
    { path: 'discover/movie?language=en-US&with_genres=16&sort_by=popularity.desc', pages: 3, tag: 'popular' }, // Animation
    { path: 'discover/movie?language=en-US&with_genres=99&sort_by=vote_count.desc', pages: 3, tag: 'top_rated' }, // Documentary
  ];

  const requestUrls: Array<{ url: string; tag: NonNullable<Movie['tags']>[number] }> = [];
  for (const plan of endpointPlan) {
    for (let page = 1; page <= plan.pages; page++) {
      const separator = plan.path.includes('?') ? '&' : '?';
      requestUrls.push({ url: `${plan.path}${separator}page=${page}`, tag: plan.tag });
    }
  }

  const movieMap = new Map<number, Movie>();
  const batchSize = 4;

  for (let i = 0; i < requestUrls.length; i += batchSize) {
    const batch = requestUrls.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async ({ url, tag }) => {
        const res = await fetchTmdbJson<TmdbListResponse>(url);
        return { results: res.results ?? [], tag };
      })
    );

    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      for (const item of outcome.value.results) {
        if (!item.poster_path && !item.backdrop_path) continue;
        const existing = movieMap.get(item.id);
        if (existing) {
          const nextTags = new Set([...(existing.tags ?? []), outcome.value.tag]);
          existing.tags = Array.from(nextTags);
        } else {
          movieMap.set(item.id, mapTmdbSummaryToMovie(item, genreLookup, outcome.value.tag));
        }
      }
    }

    if (movieMap.size >= 620) break;
  }

  return Array.from(movieMap.values());
}

export async function fetchTmdbMovieDetails(tmdbId: number): Promise<Partial<Movie>> {
  const detail = await fetchTmdbJson<TmdbDetailResponse>(
    `movie/${tmdbId}?language=en-US&append_to_response=credits,videos,external_ids`
  );

  const director =
    detail.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null;

  const actors = (detail.credits?.cast ?? [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 8)
    .map((c) => c.name);

  const ytTrailer =
    detail.videos?.results?.find(
      (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official
    ) ??
    detail.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ??
    detail.videos?.results?.find((v) => v.site === 'YouTube');

  const imdbId = detail.imdb_id ?? detail.external_ids?.imdb_id ?? null;
  const country = detail.production_countries?.[0]?.name ?? 'International';
  const langName =
    detail.spoken_languages?.[0]?.english_name ??
    LANGUAGE_MAP[detail.original_language ?? 'en'] ??
    'English';

  return {
    imdbId,
    duration: typeof detail.runtime === 'number' && detail.runtime > 0 ? detail.runtime : null,
    genres: detail.genres?.map((g) => g.name),
    director,
    actors,
    country,
    language: langName,
    youtubeTrailerId: ytTrailer?.key ?? null,
    trailerUrl: ytTrailer ? `https://www.youtube.com/watch?v=${ytTrailer.key}` : null,
    detailsLoaded: true,
  };
}
