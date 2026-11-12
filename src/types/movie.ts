export type GenreName =
  | 'Action'
  | 'Science Fiction'
  | 'Thriller'
  | 'Horror'
  | 'Drama'
  | 'Comedy'
  | 'Adventure'
  | 'Animation'
  | 'Documentary'
  | 'Crime'
  | 'Mystery'
  | 'Romance'
  | 'War'
  | 'Western'
  | 'Fantasy'
  | 'History'
  | 'Music'
  | 'Family';

export interface MovieRatings {
  /** Authentic IMDb rating out of 10 (e.g., 8.6), or null when unavailable */
  imdb: number | null;
  /** IMDb vote count when retrieved from legitimate IMDb/OMDb dataset */
  imdbVotes: number | null;
  /** Authentic Rotten Tomatoes Tomatometer string (e.g., "94%"), or null when unavailable */
  rottenTomatoes: string | null;
  /** Authentic Rotten Tomatoes Popcornmeter / audience score when legitimately available */
  rottenTomatoesPopcorn?: string | null;
  /** Optional TMDB community score — strictly never labeled as IMDb */
  tmdbScore?: number | null;
  /** Origin note for transparency */
  source: 'imdb-dataset' | 'omdb' | 'wikidata' | 'unavailable';
}

export interface PlayableStream {
  /** Public-domain / open-license MP4 stream URL when legally available */
  url: string;
  /** Human-readable license/source credit (e.g., "Internet Archive — Public Domain") */
  licenseLabel: string;
  /** Optional WebVTT subtitle track URL or inline caption data */
  subtitleUrl?: string;
  subtitleLabel?: string;
}

export interface Movie {
  id: string;
  imdbId: string | null;
  tmdbId: number | null;
  title: string;
  originalTitle: string | null;
  description: string;
  releaseDate: string; // YYYY-MM-DD or YYYY
  releaseYear: number;
  duration: number | null; // minutes
  genres: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  director: string | null;
  actors: string[];
  ratings: MovieRatings;
  language: string;
  languageCode: string;
  country: string;
  trailerUrl: string | null;
  youtubeTrailerId: string | null;
  playableStream: PlayableStream | null;
  popularity: number;
  /** Internal curation flags used for homepage shelves */
  tags?: Array<'trending' | 'popular' | 'top_rated' | 'new_release' | 'hidden_gem' | 'classic'>;
  /** Indicates whether deep credits/runtime/ratings have been enriched on demand */
  detailsLoaded?: boolean;
}

export type SortOption =
  | 'most_popular'
  | 'highest_rated'
  | 'latest_releases'
  | 'oldest_releases'
  | 'alphabetical'
  | 'shortest_duration'
  | 'longest_duration';

export type DurationFilter = 'all' | 'under_90' | '90_to_120' | '120_to_150' | 'over_150';

export interface MovieFilterState {
  query: string;
  genre: string;
  year: string; // e.g., 'all', '2020s', '2010s', '2000s', '1990s', 'classic', or exact year '2024'
  minImdbRating: number;
  duration: DurationFilter;
  language: string;
  country: string;
  popularityFloor: 'all' | 'acclaimed' | 'mainstream' | 'hidden_gems';
  sort: SortOption;
  collection?: string;
}

export interface PlatformCapabilities {
  tmdbConfigured: boolean;
  omdbConfigured: boolean;
  supabaseConfigured: boolean;
  oauthProviders: {
    google: boolean;
    apple: boolean;
    reddit: boolean;
  };
}

export type OAuthProvider = 'google' | 'apple' | 'reddit';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  authMode: 'supabase' | 'local-demo';
  provider: 'email' | OAuthProvider;
  preferredLanguage: string;
  autoplayTrailers: boolean;
  createdAt: string;
}

export interface ViewingHistoryEntry {
  movie: Movie;
  watchedAt: string;
  progressSeconds: number;
  durationSeconds: number;
}
