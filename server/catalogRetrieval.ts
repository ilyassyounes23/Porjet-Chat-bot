import fs from 'node:fs';
import path from 'node:path';
import type {
  AiInteractionMode,
  AiMode,
  AiRecommendationCard,
  AttachedMovieContext,
  CinemaProfileContext,
  LlmPickSuggestion,
  Movie,
  MovieRatings,
  RetrievedCandidate,
} from './types';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const tmdbJsonCache = new Map<string, CacheEntry<unknown>>();
const omdbCache = new Map<string, CacheEntry<OmdbResult>>();
const CACHE_TTL_MS = 1000 * 60 * 30;

interface OmdbResult {
  configured: boolean;
  imdbRating: number | null;
  imdbVotes: number | null;
  rottenTomatoes: string | null;
}

interface TmdbSearchSummary {
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

interface TmdbDetailResult extends TmdbSearchSummary {
  runtime?: number | null;
  imdb_id?: string | null;
  genres?: Array<{ id: number; name: string }>;
  production_countries?: Array<{ name: string }>;
  credits?: {
    cast?: Array<{ name: string; order: number }>;
    crew?: Array<{ name: string; job: string }>;
  };
  external_ids?: { imdb_id?: string | null };
  videos?: { results?: Array<{ site: string; type: string; key: string; official?: boolean }> };
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'with', 'for', 'on', 'is', 'are', 'me',
  'like', 'similar', 'something', 'movies', 'movie', 'film', 'films', 'watch', 'next', 'give',
  'five', 'three', 'some', 'want', 'what', 'best', 'good', 'recommend', 'recommendations',
  'about', 'les', 'des', 'une', 'un', 'avec', 'pour', 'sur', 'dans', 'qui', 'que', 'et', 'ou',
  'film', 'films', 'moi', 'quelque', 'chose', 'comme', 'similaire', 'pas', 'deja', 'already',
  'watched', 'seen', 'first', 'two', 'three', 'second', 'compare', 'between',
]);

const GENRE_HINTS: Record<string, string[]> = {
  'Science Fiction': ['sci-fi', 'scifi', 'science fiction', 'science-fiction', 'space', 'cyberpunk', 'ai', 'time travel', 'dystopian', 'alien'],
  Thriller: ['thriller', 'psychological', 'suspense', 'twist', 'twists', 'mystery', 'paranoia', 'conspiracy', 'noir'],
  Horror: ['horror', 'scary', 'dread', 'ghost', 'supernatural', 'slasher', 'gothic', 'folk horror'],
  Drama: ['drama', 'emotional', 'character study', 'tragedy', 'family', 'grief', 'biopic'],
  Crime: ['crime', 'detective', 'heist', 'mafia', 'gangster', 'investigation', 'murder'],
  Mystery: ['mystery', 'whodunit', 'puzzle', 'enigma', 'clue', 'twist'],
  Action: ['action', 'martial', 'espionage', 'spy', 'warfare', 'chase'],
  Animation: ['animation', 'animated', 'anime', 'studio ghibli'],
  Documentary: ['documentary', 'non-fiction', 'true story', 'essay'],
  Comedy: ['comedy', 'satire', 'dark comedy', 'funny', 'farce'],
  Romance: ['romance', 'romantic', 'love story'],
  Adventure: ['adventure', 'odyssey', 'expedition', 'journey'],
  Fantasy: ['fantasy', 'mythic', 'magical'],
};

let catalogCache: {
  movies: Movie[];
  byId: Map<string, Movie>;
  byTmdbId: Map<number, Movie>;
  byNormTitle: Map<string, Movie[]>;
} | null = null;

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function loadInternalIndex() {
  if (catalogCache) return catalogCache;
  const jsonPath = path.resolve(process.cwd(), 'src/data/demoCatalog.json');
  let movies: Movie[] = [];
  try {
    movies = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Movie[];
  } catch {
    movies = [];
  }

  const byId = new Map<string, Movie>();
  const byTmdbId = new Map<number, Movie>();
  const byNormTitle = new Map<string, Movie[]>();

  for (const m of movies) {
    byId.set(m.id, m);
    if (m.tmdbId) byTmdbId.set(m.tmdbId, m);
    const norm = normalizeTitle(m.title);
    if (norm) {
      const list = byNormTitle.get(norm) ?? [];
      list.push(m);
      byNormTitle.set(norm, list);
    }
    if (m.originalTitle) {
      const normOrig = normalizeTitle(m.originalTitle);
      if (normOrig && normOrig !== norm) {
        const list = byNormTitle.get(normOrig) ?? [];
        list.push(m);
        byNormTitle.set(normOrig, list);
      }
    }
  }

  catalogCache = { movies, byId, byTmdbId, byNormTitle };
  return catalogCache;
}

export function getInternalCatalogCount(): number {
  return loadInternalIndex().movies.length;
}

export function getInternalMovieById(id: string): Movie | undefined {
  return loadInternalIndex().byId.get(id);
}

export function findInternalMatch(params: {
  internalId?: string | null;
  tmdbId?: number | null;
  title?: string;
  year?: number;
}): Movie | undefined {
  const index = loadInternalIndex();
  if (params.internalId) {
    const exact = index.byId.get(params.internalId);
    if (exact) return exact;
  }
  if (params.tmdbId) {
    const byTmdb = index.byTmdbId.get(params.tmdbId);
    if (byTmdb) return byTmdb;
  }
  if (params.title) {
    const norm = normalizeTitle(params.title);
    const matches = index.byNormTitle.get(norm);
    if (matches && matches.length > 0) {
      if (params.year) {
        const closeYear = matches.find((m) => Math.abs(m.releaseYear - params.year!) <= 1);
        if (closeYear) return closeYear;
      }
      return matches[0];
    }
  }
  return undefined;
}

function toCandidate(movie: Movie, availableInNoir = true, matchReason?: string): RetrievedCandidate {
  return {
    internalId: availableInNoir ? movie.id : null,
    tmdbId: movie.tmdbId,
    imdbId: movie.imdbId,
    title: movie.title,
    releaseYear: movie.releaseYear,
    genres: movie.genres,
    duration: movie.duration,
    director: movie.director,
    actors: movie.actors,
    description: movie.description,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    ratings: movie.ratings,
    availableInNoir,
    tags: movie.tags ?? [],
    popularity: movie.popularity,
    language: movie.language,
    country: movie.country,
    externalUrl: movie.tmdbId ? `https://www.themoviedb.org/movie/${movie.tmdbId}` : null,
    matchReason,
    movieSnapshot: movie,
  };
}

function tokenizeQuery(query: string): string[] {
  return normalizeTitle(query)
    .split(/\s+/)
    .filter((tok) => tok.length >= 2 && !STOP_WORDS.has(tok));
}

function inferGenreHints(query: string): string[] {
  const lower = query.toLowerCase();
  const matched: string[] = [];
  for (const [genre, phrases] of Object.entries(GENRE_HINTS)) {
    if (phrases.some((p) => lower.includes(p))) {
      matched.push(genre);
    }
  }
  return matched;
}

export function searchInternalCatalog(params: {
  query: string;
  mode?: AiMode;
  genre?: string;
  limit?: number;
  excludeIds?: Set<string>;
  excludeTitles?: Set<string>;
  minImdb?: number | null;
  minYear?: number | null;
  maxYear?: number | null;
  preferredGenres?: string[];
}): RetrievedCandidate[] {
  const { movies } = loadInternalIndex();
  const limit = params.limit ?? 14;
  const queryNorm = normalizeTitle(params.query);
  const tokens = tokenizeQuery(params.query);
  const hintedGenres = new Set<string>([
    ...inferGenreHints(params.query),
    ...(params.genre ? [params.genre] : []),
  ]);

  const scored: Array<{ movie: Movie; score: number }> = [];

  for (const movie of movies) {
    if (params.excludeIds?.has(movie.id)) continue;
    const titleNorm = normalizeTitle(movie.title);
    if (params.excludeTitles?.has(titleNorm)) continue;

    if (params.genre && !movie.genres.some((g) => g.toLowerCase() === params.genre!.toLowerCase())) {
      continue;
    }

    if (typeof params.minImdb === 'number') {
      if (movie.ratings.imdb === null || movie.ratings.imdb < params.minImdb) {
        continue;
      }
    }

    if (typeof params.minYear === 'number' && (!movie.releaseYear || movie.releaseYear < params.minYear)) {
      continue;
    }

    if (typeof params.maxYear === 'number' && (!movie.releaseYear || movie.releaseYear > params.maxYear)) {
      continue;
    }

    let score = 0;
    const dirNorm = normalizeTitle(movie.director ?? '');
    const actorsNorm = normalizeTitle(movie.actors.join(' '));
    const descNorm = normalizeTitle(movie.description);
    const genresNorm = normalizeTitle(movie.genres.join(' '));

    if (queryNorm && titleNorm === queryNorm) {
      score += 120;
    } else if (queryNorm && queryNorm.length >= 4 && titleNorm.includes(queryNorm)) {
      score += 75;
    }

    if (queryNorm && queryNorm.length >= 4 && dirNorm.includes(queryNorm)) {
      score += 65;
    }

    for (const tok of tokens) {
      if (titleNorm.includes(tok)) score += 22;
      if (dirNorm.includes(tok)) score += 24;
      if (actorsNorm.includes(tok)) score += 16;
      if (genresNorm.includes(tok)) score += 14;
      if (descNorm.includes(tok)) score += 7;
    }

    for (const hg of hintedGenres) {
      if (movie.genres.some((g) => g.toLowerCase() === hg.toLowerCase())) {
        score += 20;
      }
    }

    if (params.preferredGenres && params.preferredGenres.length > 0) {
      for (const pg of params.preferredGenres) {
        if (movie.genres.some((g) => g.toLowerCase() === pg.toLowerCase())) {
          score += 6;
        }
      }
    }

    if (params.mode === 'hidden_gems') {
      const imdb = movie.ratings.imdb ?? 0;
      const votes = movie.ratings.imdbVotes ?? 25000;
      if (movie.tags?.includes('hidden_gem') || (imdb >= 7.1 && votes <= 95000)) {
        score += 26;
      }
    }

    // Quality prior
    if (score > 0 || tokens.length === 0) {
      score += (movie.ratings.imdb ?? 6.5) * 1.4;
      if (params.mode !== 'hidden_gems') {
        score += Math.log10(Math.max(movie.popularity, 10)) * 2.5;
      }
    }

    if (score > 0) {
      scored.push({ movie, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => toCandidate(entry.movie, true));
}

export async function fetchServerTmdbJson<T>(subPath: string): Promise<T | null> {
  const readToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!readToken && !apiKey) return null;

  const cached = tmdbJsonCache.get(subPath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  try {
    const url = new URL(`https://api.themoviedb.org/3/${subPath}`);
    if (!readToken && apiKey) {
      url.searchParams.set('api_key', apiKey);
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (readToken) {
      headers.Authorization = `Bearer ${readToken}`;
    }

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) return null;
    const json = (await res.json()) as T;
    tmdbJsonCache.set(subPath, { expiresAt: Date.now() + CACHE_TTL_MS, value: json });
    if (tmdbJsonCache.size > 600) {
      tmdbJsonCache.clear();
    }
    return json;
  } catch {
    return null;
  }
}

export async function fetchServerOmdbRatings(params: {
  imdbId?: string | null;
  title: string;
  year?: number;
}): Promise<OmdbResult> {
  const omdbKey = process.env.OMDB_API_KEY?.trim();
  if (!omdbKey) {
    return { configured: false, imdbRating: null, imdbVotes: null, rottenTomatoes: null };
  }

  const cacheKey = params.imdbId || `${params.title.toLowerCase()}:${params.year ?? ''}`;
  const cached = omdbCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const target = new URL('https://www.omdbapi.com/');
    target.searchParams.set('apikey', omdbKey);
    if (params.imdbId && /^tt\d+$/.test(params.imdbId)) {
      target.searchParams.set('i', params.imdbId);
    } else {
      target.searchParams.set('t', params.title);
      if (params.year && params.year > 1880) {
        target.searchParams.set('y', String(params.year));
      }
      target.searchParams.set('type', 'movie');
    }

    const res = await fetch(target.toString());
    if (!res.ok) {
      return { configured: true, imdbRating: null, imdbVotes: null, rottenTomatoes: null };
    }
    const data = (await res.json()) as {
      Response?: string;
      imdbRating?: string;
      imdbVotes?: string;
      Ratings?: Array<{ Source: string; Value: string }>;
    };

    if (data.Response !== 'True') {
      const empty: OmdbResult = {
        configured: true,
        imdbRating: null,
        imdbVotes: null,
        rottenTomatoes: null,
      };
      omdbCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: empty });
      return empty;
    }

    const rtEntry = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes');
    const imdbParsed =
      data.imdbRating && data.imdbRating !== 'N/A' ? Number.parseFloat(data.imdbRating) : null;
    const votesParsed =
      data.imdbVotes && data.imdbVotes !== 'N/A'
        ? Number.parseInt(data.imdbVotes.replace(/,/g, ''), 10)
        : null;

    const result: OmdbResult = {
      configured: true,
      imdbRating: imdbParsed !== null && Number.isFinite(imdbParsed) ? imdbParsed : null,
      imdbVotes: votesParsed !== null && Number.isFinite(votesParsed) ? votesParsed : null,
      rottenTomatoes: rtEntry?.Value ?? null,
    };
    omdbCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS * 2, value: result });
    return result;
  } catch {
    return { configured: true, imdbRating: null, imdbVotes: null, rottenTomatoes: null };
  }
}

async function fetchTmdbMovieAsCandidate(tmdbId: number): Promise<RetrievedCandidate | null> {
  const internalMatch = findInternalMatch({ tmdbId });
  if (internalMatch) {
    return toCandidate(internalMatch, true);
  }

  const detail = await fetchServerTmdbJson<TmdbDetailResult>(
    `movie/${tmdbId}?language=en-US&append_to_response=credits,videos,external_ids`
  );
  if (!detail || !detail.title) return null;

  const year = Number.parseInt((detail.release_date || '').slice(0, 4), 10) || 0;
  const imdbId = detail.external_ids?.imdb_id ?? detail.imdb_id ?? null;
  const director = detail.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null;
  const actors = (detail.credits?.cast ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, 6)
    .map((c) => c.name);
  const genres = (detail.genres ?? []).map((g) => g.name);
  const trailer =
    detail.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ??
    detail.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer');

  const omdb = await fetchServerOmdbRatings({ imdbId, title: detail.title, year });
  const hasOmdb = omdb.imdbRating !== null || omdb.rottenTomatoes !== null;

  const ratings: MovieRatings = {
    imdb: omdb.imdbRating,
    imdbVotes: omdb.imdbVotes,
    rottenTomatoes: omdb.rottenTomatoes,
    tmdbScore:
      typeof detail.vote_average === 'number' && detail.vote_average > 0
        ? Number(detail.vote_average.toFixed(1))
        : null,
    source: hasOmdb ? 'omdb' : 'unavailable',
  };

  const movieObj: Movie = {
    id: `tmdb-${detail.id}`,
    imdbId,
    tmdbId: detail.id,
    title: detail.title,
    originalTitle:
      detail.original_title && detail.original_title !== detail.title ? detail.original_title : null,
    description: detail.overview?.trim() || 'Synopsis unavailable in external registry.',
    releaseDate: detail.release_date || `${year || '1900'}-01-01`,
    releaseYear: year,
    duration: typeof detail.runtime === 'number' && detail.runtime > 0 ? detail.runtime : null,
    genres: genres.length > 0 ? genres : ['Cinema'],
    posterUrl: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
    backdropUrl: detail.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}`
      : null,
    director,
    actors,
    ratings,
    language: detail.original_language?.toUpperCase() || 'EN',
    languageCode: detail.original_language || 'en',
    country: detail.production_countries?.[0]?.name || 'International',
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    youtubeTrailerId: trailer?.key ?? null,
    playableStream: null,
    popularity: detail.popularity ?? 0,
    detailsLoaded: true,
  };

  // Re-check internal catalog by normalized title+year in case ID differs
  const titleMatch = findInternalMatch({ title: detail.title, year });
  if (titleMatch) {
    return toCandidate(titleMatch, true);
  }

  return {
    internalId: null,
    tmdbId: detail.id,
    imdbId,
    title: detail.title,
    releaseYear: year,
    genres: movieObj.genres,
    duration: movieObj.duration,
    director,
    actors,
    description: movieObj.description,
    posterUrl: movieObj.posterUrl,
    backdropUrl: movieObj.backdropUrl,
    ratings,
    availableInNoir: false,
    tags: [],
    popularity: movieObj.popularity,
    language: movieObj.language,
    country: movieObj.country,
    externalUrl: `https://www.themoviedb.org/movie/${detail.id}`,
    movieSnapshot: movieObj,
  };
}

const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

function scoreSearchCandidateRelevance(
  c: RetrievedCandidate,
  queryNorm: string,
  tokens: string[]
): number {
  const titleNorm = normalizeTitle(c.title);
  const dirNorm = normalizeTitle(c.director ?? '');
  let score = c.availableInNoir ? 4 : 0;

  if (queryNorm) {
    if (titleNorm === queryNorm) score += 200;
    else if (titleNorm.startsWith(queryNorm)) score += 130;
    else if (titleNorm.includes(queryNorm)) score += 90;
    if (dirNorm && dirNorm.includes(queryNorm)) score += 80;
  }

  let matchedTokens = 0;
  for (const tok of tokens) {
    if (titleNorm.includes(tok)) {
      score += 24;
      matchedTokens += 1;
    } else if (dirNorm.includes(tok)) {
      score += 22;
      matchedTokens += 1;
    }
  }
  if (tokens.length > 1 && matchedTokens === tokens.length) {
    score += 45;
  }

  score += Math.log10(Math.max(c.popularity || 1, 10)) * 3;
  return score;
}

export async function searchUnifiedMovies(params: {
  query: string;
  genre?: string;
  limit?: number;
}): Promise<RetrievedCandidate[]> {
  const limit = Math.min(params.limit ?? 16, 24);
  const internal = searchInternalCatalog({
    query: params.query,
    genre: params.genre,
    limit: Math.ceil(limit * 0.8),
  });

  const q = params.query.trim();
  if (!q || q.length < 2) {
    return internal.slice(0, limit);
  }

  const tmdbSearch = await fetchServerTmdbJson<{ results?: TmdbSearchSummary[] }>(
    `search/movie?query=${encodeURIComponent(q)}&language=en-US&page=1&include_adult=false`
  );

  const seenTmdb = new Set(internal.map((i) => i.tmdbId).filter((x): x is number => Boolean(x)));
  const seenTitles = new Set(internal.map((i) => `${normalizeTitle(i.title)}:${i.releaseYear}`));

  const external: RetrievedCandidate[] = [];
  for (const item of (tmdbSearch?.results ?? []).slice(0, 10)) {
    const year = Number.parseInt((item.release_date || '').slice(0, 4), 10) || 0;
    const mappedGenres = (item.genre_ids ?? [])
      .map((gid) => TMDB_GENRE_MAP[gid])
      .filter((g): g is string => Boolean(g));
    if (
      params.genre &&
      mappedGenres.length > 0 &&
      !mappedGenres.some((g) => g.toLowerCase() === params.genre!.toLowerCase())
    ) {
      continue;
    }

    const match = findInternalMatch({ tmdbId: item.id, title: item.title, year });
    if (match) {
      if (!internal.some((c) => c.internalId === match.id)) {
        internal.push(toCandidate(match, true));
      }
      continue;
    }
    const key = `${normalizeTitle(item.title)}:${year}`;
    if (seenTmdb.has(item.id) || seenTitles.has(key)) continue;
    seenTmdb.add(item.id);
    seenTitles.add(key);

    external.push({
      internalId: null,
      tmdbId: item.id,
      imdbId: null,
      title: item.title,
      releaseYear: year,
      genres: mappedGenres,
      duration: null,
      director: null,
      actors: [],
      description: item.overview?.trim() || 'Synopsis available in external TMDB registry.',
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdropUrl: item.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
        : null,
      ratings: {
        imdb: null,
        imdbVotes: null,
        rottenTomatoes: null,
        tmdbScore:
          typeof item.vote_average === 'number' && item.vote_average > 0
            ? Number(item.vote_average.toFixed(1))
            : null,
        source: 'unavailable',
      },
      availableInNoir: false,
      tags: [],
      popularity: item.popularity ?? 0,
      language: item.original_language?.toUpperCase() || 'EN',
      country: 'International',
      externalUrl: `https://www.themoviedb.org/movie/${item.id}`,
    });
  }

  const queryNorm = normalizeTitle(q);
  const tokens = tokenizeQuery(q);
  return [...internal, ...external]
    .sort(
      (a, b) =>
        scoreSearchCandidateRelevance(b, queryNorm, tokens) -
        scoreSearchCandidateRelevance(a, queryNorm, tokens)
    )
    .slice(0, limit);
}

function parseQueryConstraints(
  queries: string[],
  priorRecommendations: string[] = []
): {
  minImdb: number | null;
  minYear: number | null;
  maxYear: number | null;
  excludeTitles: Set<string>;
} {
  let minImdb: number | null = null;
  let minYear: number | null = null;
  let maxYear: number | null = null;
  const excludeTitles = new Set<string>();

  for (const rawQ of queries) {
    const q = rawQ.toLowerCase();
    const imdbMatch =
      q.match(/(?:imdb|rating|score)[^\d]{0,18}(?:above|over|>|>=|at least|minimum|sup[eé]rieur[e]? [àa])\s*(\d(?:\.\d)?)/i) ??
      q.match(/(?:above|over|>=?)\s*(\d(?:\.\d)?)\s*(?:on\s+)?imdb/i);
    if (imdbMatch) {
      const val = Number.parseFloat(imdbMatch[1]);
      if (Number.isFinite(val) && val > 0 && val <= 10) {
        const isStrictAbove =
          /(?:above|over|sup[eé]rieur[e]? [àa]|>(?!=))/i.test(imdbMatch[0]) &&
          !/at least|minimum|>=/i.test(imdbMatch[0]);
        minImdb = isStrictAbove ? Math.min(10, Number((val + 0.05).toFixed(2))) : val;
      }
    }

    const afterMatch = q.match(/(?:after|post|since|apr[eè]s)\s*((?:19|20)\d{2})/i);
    if (afterMatch) {
      const yr = Number.parseInt(afterMatch[1], 10);
      if (Number.isFinite(yr)) {
        minYear = /\b(after|apr[eè]s)\b/i.test(afterMatch[0]) ? yr + 1 : yr;
      }
    }

    const fromMatch = q.match(/\bfrom\s*((?:19|20)\d{2})\b/i);
    if (fromMatch && !afterMatch) {
      const yr = Number.parseInt(fromMatch[1], 10);
      if (Number.isFinite(yr)) minYear = yr;
    }

    const beforeMatch = q.match(/(?:before|prior to|pre|avant)\s*((?:19|20)\d{2})/i);
    if (beforeMatch) {
      const yr = Number.parseInt(beforeMatch[1], 10);
      if (Number.isFinite(yr)) maxYear = yr - 1;
    }

    if (
      /\b(already watched|already seen|seen the first|watched the first|skip the first|d[eé]j[aà] vu)\b/i.test(
        q
      ) &&
      priorRecommendations.length > 0
    ) {
      let skipCount = 2;
      if (/\b(?:first three|three|3)\b/i.test(q)) skipCount = 3;
      else if (/\b(?:first four|four|4)\b/i.test(q)) skipCount = 4;
      else if (/\b(?:first one|only the first|1)\b/i.test(q)) skipCount = 1;
      for (const title of priorRecommendations.slice(0, skipCount)) {
        excludeTitles.add(normalizeTitle(title));
      }
    }
  }

  return { minImdb, minYear, maxYear, excludeTitles };
}

/**
 * Retrieves top relevant candidates from NOIR internal catalog + TMDB similar/search
 * so the LLM receives rich, bounded movie context (never dumping all 1,000+ movies).
 */
export async function retrieveContextForAiChat(params: {
  latestQuery: string;
  recentUserQueries?: string[];
  priorRecommendations?: string[];
  mode: AiMode;
  interactionMode?: AiInteractionMode;
  attachedMovies: AttachedMovieContext[];
  cinemaProfile?: CinemaProfileContext;
  discussedTitles?: string[];
}): Promise<RetrievedCandidate[]> {
  const isDirect = params.interactionMode === 'direct';
  const excludeIds = new Set(params.attachedMovies.map((m) => m.id));
  const recentQueries = params.recentUserQueries?.length
    ? params.recentUserQueries
    : [params.latestQuery];
  const constraints = parseQueryConstraints(recentQueries, params.priorRecommendations);

  const combinedQuery = [
    ...recentQueries.slice(-2),
    ...params.attachedMovies.flatMap((m) => [...m.genres, m.director ?? '']),
  ]
    .filter(Boolean)
    .join(' ');

  const internalMatches = searchInternalCatalog({
    query: combinedQuery,
    mode: params.mode,
    limit: isDirect ? 14 : 12,
    excludeIds,
    excludeTitles: constraints.excludeTitles,
    minImdb: constraints.minImdb,
    minYear: constraints.minYear,
    maxYear: constraints.maxYear,
    preferredGenres: params.cinemaProfile?.favoriteGenres,
  });

  const tmdbCandidates: RetrievedCandidate[] = [];
  const seenTmdb = new Set<number>(
    internalMatches.map((m) => m.tmdbId).filter((x): x is number => Boolean(x))
  );

  // Pull TMDB recommendations for attached movies when available
  for (const att of params.attachedMovies.slice(0, 2)) {
    if (!att.tmdbId) continue;
    const sim = await fetchServerTmdbJson<{ results?: TmdbSearchSummary[] }>(
      `movie/${att.tmdbId}/recommendations?language=en-US&page=1`
    );
    for (const item of (sim?.results ?? []).slice(0, 4)) {
      if (seenTmdb.has(item.id)) continue;
      if (constraints.excludeTitles.has(normalizeTitle(item.title))) continue;
      seenTmdb.add(item.id);
      const internalMatch = findInternalMatch({
        tmdbId: item.id,
        title: item.title,
        year: Number.parseInt((item.release_date || '').slice(0, 4), 10) || undefined,
      });
      if (internalMatch) {
        if (
          typeof constraints.minImdb === 'number' &&
          (internalMatch.ratings.imdb === null || internalMatch.ratings.imdb < constraints.minImdb)
        ) {
          continue;
        }
        if (
          typeof constraints.minYear === 'number' &&
          internalMatch.releaseYear < constraints.minYear
        ) {
          continue;
        }
        if (!internalMatches.some((x) => x.internalId === internalMatch.id)) {
          internalMatches.push(toCandidate(internalMatch, true));
        }
      } else {
        const detailed = await fetchTmdbMovieAsCandidate(item.id);
        if (!detailed) continue;
        if (
          typeof constraints.minImdb === 'number' &&
          (detailed.ratings.imdb === null || detailed.ratings.imdb < constraints.minImdb)
        ) {
          continue;
        }
        if (typeof constraints.minYear === 'number' && detailed.releaseYear < constraints.minYear) {
          continue;
        }
        tmdbCandidates.push(detailed);
      }
    }
  }

  // Extract explicit movie title mentions or keywords via TMDB search for comparison / external questions
  const qClean = params.latestQuery.trim();
  if (qClean.length >= 3) {
    const tmdbSearch = await fetchServerTmdbJson<{ results?: TmdbSearchSummary[] }>(
      `search/movie?query=${encodeURIComponent(qClean.slice(0, 80))}&language=en-US&page=1&include_adult=false`
    );
    for (const item of (tmdbSearch?.results ?? []).slice(0, 4)) {
      if (seenTmdb.has(item.id)) continue;
      if (constraints.excludeTitles.has(normalizeTitle(item.title))) continue;
      seenTmdb.add(item.id);
      const internalMatch = findInternalMatch({ tmdbId: item.id, title: item.title });
      if (internalMatch) {
        if (!internalMatches.some((x) => x.internalId === internalMatch.id)) {
          internalMatches.unshift(toCandidate(internalMatch, true));
        }
      } else {
        const detailed = await fetchTmdbMovieAsCandidate(item.id);
        if (detailed) tmdbCandidates.push(detailed);
      }
    }
  }

  return isDirect
    ? [...internalMatches.slice(0, 12), ...tmdbCandidates.slice(0, 5)]
    : [...internalMatches.slice(0, 8), ...tmdbCandidates.slice(0, 4)];
}

export async function resolveAttachedMovieContext(input: {
  id?: string;
  tmdbId?: number;
  title?: string;
  year?: number;
}): Promise<AttachedMovieContext | null> {
  const internal = findInternalMatch({
    internalId: input.id,
    tmdbId: input.tmdbId,
    title: input.title,
    year: input.year,
  });

  if (internal) {
    return {
      id: internal.id,
      tmdbId: internal.tmdbId,
      imdbId: internal.imdbId,
      title: internal.title,
      releaseYear: internal.releaseYear,
      genres: internal.genres,
      description: internal.description,
      director: internal.director,
      actors: internal.actors.slice(0, 8),
      duration: internal.duration,
      language: internal.language,
      country: internal.country,
      posterUrl: internal.posterUrl,
      ratings: internal.ratings,
      availableInNoir: true,
    };
  }

  let targetTmdbId = input.tmdbId ?? null;
  if (!targetTmdbId && input.id?.startsWith('tmdb-')) {
    const parsedId = Number.parseInt(input.id.slice(5), 10);
    if (Number.isFinite(parsedId)) targetTmdbId = parsedId;
  }
  if (!targetTmdbId && input.title) {
    const sr = await fetchServerTmdbJson<{ results?: TmdbSearchSummary[] }>(
      `search/movie?query=${encodeURIComponent(input.title)}&language=en-US&page=1`
    );
    const first = sr?.results?.[0];
    if (first) targetTmdbId = first.id;
  }

  if (!targetTmdbId) return null;
  const cand = await fetchTmdbMovieAsCandidate(targetTmdbId);
  if (!cand) return null;

  return {
    id: cand.internalId ?? `tmdb-${cand.tmdbId}`,
    tmdbId: cand.tmdbId,
    imdbId: cand.imdbId,
    title: cand.title,
    releaseYear: cand.releaseYear,
    genres: cand.genres,
    description: cand.description,
    director: cand.director,
    actors: cand.actors.slice(0, 8),
    duration: cand.duration,
    language: cand.language,
    country: cand.country,
    posterUrl: cand.posterUrl,
    ratings: cand.ratings,
    availableInNoir: cand.availableInNoir,
  };
}

/**
 * Hydrates LLM recommendations strictly against real NOIR catalog + TMDB + OMDb data.
 * Never trusts LLM-supplied scores or claims of NOIR availability.
 */
export async function hydrateRecommendationPicks(
  picks: LlmPickSuggestion[],
  maxCount = 6
): Promise<AiRecommendationCard[]> {
  const seenKeys = new Set<string>();
  const uniquePicks: LlmPickSuggestion[] = [];

  for (const pick of picks.slice(0, maxCount)) {
    if (!pick?.title?.trim()) continue;
    const dedupKey = `${normalizeTitle(pick.title)}:${pick.year ?? ''}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);
    uniquePicks.push(pick);
  }

  return Promise.all(
    uniquePicks.map(async (pick): Promise<AiRecommendationCard> => {
      let candidate: RetrievedCandidate | null = null;

      // 1. Check Source A (NOIR Internal Catalog) first
      const internal = findInternalMatch({
        internalId: pick.internalId,
        tmdbId: pick.tmdbId,
        title: pick.title,
        year: pick.year,
      });

      if (internal) {
        candidate = toCandidate(internal, true);
        if (candidate.ratings.imdb === null || !candidate.ratings.rottenTomatoes) {
          const omdb = await fetchServerOmdbRatings({
            imdbId: candidate.imdbId,
            title: candidate.title,
            year: candidate.releaseYear,
          });
          if (omdb.imdbRating !== null || omdb.rottenTomatoes !== null) {
            candidate.ratings = {
              ...candidate.ratings,
              imdb: candidate.ratings.imdb ?? omdb.imdbRating,
              imdbVotes: candidate.ratings.imdbVotes ?? omdb.imdbVotes,
              rottenTomatoes: candidate.ratings.rottenTomatoes ?? omdb.rottenTomatoes,
              source: 'omdb',
            };
          }
        }
      } else {
        // 2. Source B (External TMDB + OMDb verification)
        let tmdbId = pick.tmdbId ?? null;
        if (!tmdbId) {
          const search = await fetchServerTmdbJson<{ results?: TmdbSearchSummary[] }>(
            `search/movie?query=${encodeURIComponent(pick.title)}&language=en-US&page=1${
              pick.year ? `&year=${pick.year}` : ''
            }`
          );
          const best = search?.results?.[0];
          if (best) {
            tmdbId = best.id;
          } else if (pick.year) {
            const retry = await fetchServerTmdbJson<{ results?: TmdbSearchSummary[] }>(
              `search/movie?query=${encodeURIComponent(pick.title)}&language=en-US&page=1`
            );
            if (retry?.results?.[0]) tmdbId = retry.results[0].id;
          }
        }
        if (tmdbId) {
          candidate = await fetchTmdbMovieAsCandidate(tmdbId);
        }
      }

      if (!candidate) {
        return {
          id: `ext-${normalizeTitle(pick.title).replace(/\s+/g, '-')}-${pick.year || 'na'}`,
          internalMovieId: null,
          tmdbId: null,
          imdbId: null,
          title: pick.title.trim(),
          releaseYear: pick.year || 0,
          genres: ['Cinema'],
          posterUrl: null,
          backdropUrl: null,
          director: null,
          actors: [],
          duration: null,
          description: 'External metadata registry temporarily unavailable for this title.',
          ratings: { imdb: null, imdbVotes: null, rottenTomatoes: null, source: 'unavailable' },
          reason: pick.reason,
          similarityExplanation:
            pick.similarityExplanation || 'Recommended by NOIR AI based on cinematic fit.',
          availableInNoir: false,
          externalUrl: `https://www.themoviedb.org/search?query=${encodeURIComponent(pick.title.trim())}`,
          sourceLabel: 'External Discovery (TMDB)',
        };
      }

      return {
        id: candidate.internalId ?? `tmdb-${candidate.tmdbId ?? normalizeTitle(candidate.title)}`,
        internalMovieId: candidate.availableInNoir ? candidate.internalId : null,
        tmdbId: candidate.tmdbId,
        imdbId: candidate.imdbId,
        title: candidate.title,
        releaseYear: candidate.releaseYear,
        genres: candidate.genres,
        posterUrl: candidate.posterUrl,
        backdropUrl: candidate.backdropUrl,
        director: candidate.director,
        actors: candidate.actors.slice(0, 6),
        duration: candidate.duration,
        description: candidate.description,
        ratings: candidate.ratings,
        reason: pick.reason,
        similarityExplanation:
          pick.similarityExplanation || 'Curated for tonal, thematic, and formal resonance.',
        availableInNoir: candidate.availableInNoir,
        externalUrl: candidate.availableInNoir
          ? null
          : candidate.externalUrl ??
            (candidate.tmdbId ? `https://www.themoviedb.org/movie/${candidate.tmdbId}` : null),
        sourceLabel: candidate.availableInNoir
          ? 'NOIR Internal Catalog'
          : 'External Discovery (TMDB)',
        movieSnapshot: candidate.movieSnapshot,
      };
    })
  );
}
