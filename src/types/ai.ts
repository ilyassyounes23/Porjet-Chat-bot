import type { Movie, MovieRatings } from '@/types/movie';

export type AiMode =
  | 'discovery'
  | 'analysis'
  | 'comparison'
  | 'hidden_gems'
  | 'tonight';

export type AiInteractionMode = 'conversational' | 'direct';

export interface AttachedMovieContext {
  id: string;
  tmdbId: number | null;
  imdbId: string | null;
  title: string;
  releaseYear: number;
  genres: string[];
  description: string;
  director: string | null;
  actors: string[];
  duration: number | null;
  language?: string;
  country?: string;
  posterUrl: string | null;
  ratings: MovieRatings;
  availableInNoir: boolean;
}

export interface AiRecommendationCard {
  id: string;
  internalMovieId: string | null;
  tmdbId: number | null;
  imdbId: string | null;
  title: string;
  releaseYear: number;
  genres: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  director: string | null;
  actors: string[];
  duration: number | null;
  description: string;
  ratings: MovieRatings;
  reason: string;
  similarityExplanation: string;
  availableInNoir: boolean;
  externalUrl: string | null;
  sourceLabel: 'NOIR Internal Catalog' | 'External Discovery (TMDB)';
  movieSnapshot?: Movie;
}

export interface AiMessageMovieContext {
  mode: AiMode;
  interactionMode?: AiInteractionMode;
  attachedMovies?: AttachedMovieContext[];
  recommendations?: AiRecommendationCard[];
  model?: string;
  provider?: string;
  error?: boolean;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  movieContext?: AiMessageMovieContext | null;
  createdAt: string;
  streaming?: boolean;
}

export interface AiConversation {
  id: string;
  title: string;
  mode: AiMode;
  interactionMode?: AiInteractionMode;
  attachedMovies: AttachedMovieContext[];
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
  persistedMode: 'supabase' | 'local';
}

export interface CinemaProfileContext {
  authenticated: boolean;
  watchlistTitles: string[];
  recentlyWatched: Array<{ title: string; year: number; genres: string[] }>;
  favoriteGenres: string[];
  discussedTitles: string[];
}

export interface AiCapabilities {
  enabled: boolean;
  configured: boolean;
  provider: string;
  model: string;
  message: string | null;
}

export function movieToAttachedContext(
  movie: Movie,
  availableInNoir = true
): AttachedMovieContext {
  return {
    id: movie.id,
    tmdbId: movie.tmdbId,
    imdbId: movie.imdbId,
    title: movie.title,
    releaseYear: movie.releaseYear,
    genres: movie.genres,
    description: movie.description,
    director: movie.director,
    actors: movie.actors.slice(0, 8),
    duration: movie.duration,
    language: movie.language,
    country: movie.country,
    posterUrl: movie.posterUrl,
    ratings: movie.ratings,
    availableInNoir,
  };
}
