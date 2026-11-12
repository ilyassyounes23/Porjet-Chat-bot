import type { Movie, MovieRatings } from '../src/types/movie';
import type {
  AiInteractionMode,
  AiMode,
  AiRecommendationCard,
  AttachedMovieContext,
  CinemaProfileContext,
} from '../src/types/ai';

export type {
  AiInteractionMode,
  AiMode,
  AiRecommendationCard,
  AttachedMovieContext,
  CinemaProfileContext,
  Movie,
  MovieRatings,
};

export interface ChatTurnInput {
  role: 'user' | 'assistant';
  content: string;
  attachedMovies?: AttachedMovieContext[];
  recommendationTitles?: string[];
}

export interface AiChatRequestBody {
  conversationId?: string;
  mode: AiMode;
  interactionMode: AiInteractionMode;
  messages: ChatTurnInput[];
  attachedMovies: AttachedMovieContext[];
  cinemaProfile?: CinemaProfileContext;
  allowSpoilers?: boolean;
  stream?: boolean;
}

export interface RetrievedCandidate {
  internalId: string | null;
  tmdbId: number | null;
  imdbId: string | null;
  title: string;
  releaseYear: number;
  genres: string[];
  duration: number | null;
  director: string | null;
  actors: string[];
  description: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  ratings: MovieRatings;
  availableInNoir: boolean;
  tags: string[];
  popularity: number;
  language: string;
  country: string;
  externalUrl: string | null;
  matchReason?: string;
  movieSnapshot?: Movie;
}

export interface LlmPickSuggestion {
  title: string;
  year?: number;
  tmdbId?: number | null;
  internalId?: string | null;
  reason: string;
  similarityExplanation?: string;
}

export interface LlmProviderConfig {
  name: string;
  model: string;
  enabled: boolean;
  configured: boolean;
}

export interface LlmCompletionParams {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  isEnabled(): boolean;
  isConfigured(): boolean;
  streamChat(params: LlmCompletionParams): AsyncIterable<string>;
}
