import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import type {
  AiCapabilities,
  AiConversation,
  AiInteractionMode,
  AiMessage,
  AiMessageMovieContext,
  AiMode,
  AiRecommendationCard,
  AttachedMovieContext,
  CinemaProfileContext,
} from '@/types/ai';
import type { Movie, UserProfile } from '@/types/movie';

const CONV_STORAGE_PREFIX = 'noir_ai_conversations_v1_';
const SAVED_STORAGE_PREFIX = 'noir_ai_saved_recs_v1_';
const INTERACTION_MODE_PREFIX = 'noir_ai_interaction_mode_v1_';

function storageSuffix(user: UserProfile | null): string {
  return user ? user.id : 'guest';
}

export function readLocalInteractionMode(user: UserProfile | null): AiInteractionMode {
  try {
    const raw = localStorage.getItem(`${INTERACTION_MODE_PREFIX}${storageSuffix(user)}`);
    return raw === 'direct' ? 'direct' : 'conversational';
  } catch {
    return 'conversational';
  }
}

export async function fetchPreferredInteractionMode(
  user: UserProfile | null
): Promise<AiInteractionMode> {
  const local = readLocalInteractionMode(user);
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    try {
      const { data } = await supabase.auth.getUser();
      const metaMode = data.user?.user_metadata?.ai_interaction_mode;
      if (metaMode === 'direct' || metaMode === 'conversational') {
        try {
          localStorage.setItem(`${INTERACTION_MODE_PREFIX}${storageSuffix(user)}`, metaMode);
        } catch {
          // Ignore storage warnings
        }
        return metaMode;
      }
    } catch {
      // Fallback safely to local preference
    }
  }
  return local;
}

export async function savePreferredInteractionMode(
  user: UserProfile | null,
  interactionMode: AiInteractionMode
): Promise<void> {
  try {
    localStorage.setItem(`${INTERACTION_MODE_PREFIX}${storageSuffix(user)}`, interactionMode);
  } catch {
    // Ignore storage quota warnings
  }
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    try {
      await supabase.auth.updateUser({
        data: { ai_interaction_mode: interactionMode },
      });
    } catch {
      // Non-fatal preference sync error
    }
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    Boolean(error.message?.toLowerCase().includes('does not exist'))
  );
}

function readLocalConversations(user: UserProfile | null): AiConversation[] {
  try {
    const raw = localStorage.getItem(`${CONV_STORAGE_PREFIX}${storageSuffix(user)}`);
    return raw ? (JSON.parse(raw) as AiConversation[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalConversations(
  user: UserProfile | null,
  conversations: AiConversation[]
): void {
  try {
    // Keep at most 40 recent sessions locally to prevent quota pressure
    localStorage.setItem(
      `${CONV_STORAGE_PREFIX}${storageSuffix(user)}`,
      JSON.stringify(conversations.slice(0, 40))
    );
  } catch {
    // Ignore storage quota warnings
  }
}

function readLocalSavedRecs(user: UserProfile | null): AiRecommendationCard[] {
  try {
    const raw = localStorage.getItem(`${SAVED_STORAGE_PREFIX}${storageSuffix(user)}`);
    return raw ? (JSON.parse(raw) as AiRecommendationCard[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSavedRecs(
  user: UserProfile | null,
  cards: AiRecommendationCard[]
): void {
  try {
    localStorage.setItem(
      `${SAVED_STORAGE_PREFIX}${storageSuffix(user)}`,
      JSON.stringify(cards.slice(0, 80))
    );
  } catch {
    // Ignore storage quota warnings
  }
}

export async function fetchAiCapabilities(): Promise<AiCapabilities> {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) {
      return {
        enabled: false,
        configured: false,
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        message: 'Unable to verify AI engine configuration status.',
      };
    }
    return (await res.json()) as AiCapabilities;
  } catch {
    return {
      enabled: false,
      configured: false,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      message: 'NOIR AI backend status endpoint is unreachable.',
    };
  }
}

export async function searchAiMovies(
  query: string,
  genre?: string,
  limit = 12
): Promise<AttachedMovieContext[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (genre && genre !== 'All') params.set('genre', genre);
  params.set('limit', String(limit));

  const res = await fetch(`/api/ai/movies/search?${params.toString()}`);
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as { results?: AttachedMovieContext[] };
  return data.results ?? [];
}

export async function resolveAiMovieContext(params: {
  id?: string;
  tmdbId?: number | null;
  title?: string;
  year?: number;
}): Promise<AttachedMovieContext | null> {
  const res = await fetch('/api/ai/movie-context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { movie?: AttachedMovieContext };
  return data.movie ?? null;
}

export interface StreamAiChatHandlers {
  onStatus?: (status: { stage: string; label: string; model?: string; provider?: string }) => void;
  onDelta?: (deltaText: string) => void;
  onRecommendations?: (cards: AiRecommendationCard[]) => void;
}

export interface StreamAiChatResult {
  text: string;
  cards: AiRecommendationCard[];
  model: string;
  provider: string;
}

export async function streamAiChat(
  payload: {
    conversationId?: string;
    mode: AiMode;
    interactionMode: AiInteractionMode;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      attachedMovies?: AttachedMovieContext[];
      recommendationTitles?: string[];
    }>;
    attachedMovies: AttachedMovieContext[];
    cinemaProfile?: CinemaProfileContext;
    allowSpoilers?: boolean;
  },
  handlers: StreamAiChatHandlers,
  signal?: AbortSignal
): Promise<StreamAiChatResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody.error) errorMessage = errBody.error;
    } catch {
      // Ignore parse error
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('Streaming response body unavailable.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let accumulatedText = '';
  let resolvedCards: AiRecommendationCard[] = [];
  let model = '';
  let provider = '';
  let streamError: string | null = null;

  const processFrame = (rawFrame: string) => {
    const lines = rawFrame.split(/\r?\n/);
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) return;
    const rawData = dataLines.join('\n');

    try {
      const parsed = JSON.parse(rawData) as Record<string, unknown>;
      if (eventName === 'status') {
        handlers.onStatus?.({
          stage: String(parsed.stage ?? 'thinking'),
          label: String(parsed.label ?? 'Analyzing cinema archive...'),
          model: typeof parsed.model === 'string' ? parsed.model : undefined,
          provider: typeof parsed.provider === 'string' ? parsed.provider : undefined,
        });
      } else if (eventName === 'delta' && typeof parsed.text === 'string') {
        accumulatedText += parsed.text;
        handlers.onDelta?.(parsed.text);
      } else if (eventName === 'recommendations' && Array.isArray(parsed.cards)) {
        resolvedCards = parsed.cards as AiRecommendationCard[];
        handlers.onRecommendations?.(resolvedCards);
      } else if (eventName === 'done') {
        if (typeof parsed.text === 'string' && parsed.text.length > 0) {
          accumulatedText = parsed.text;
        }
        if (Array.isArray(parsed.cards)) {
          resolvedCards = parsed.cards as AiRecommendationCard[];
        }
        if (typeof parsed.model === 'string') model = parsed.model;
        if (typeof parsed.provider === 'string') provider = parsed.provider;
      } else if (eventName === 'error') {
        streamError =
          typeof parsed.message === 'string'
            ? parsed.message
            : 'Unable to complete AI recommendation.';
      }
    } catch {
      // Ignore partial JSON lines safely
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      if (frame.trim()) processFrame(frame);
    }
  }

  if (buffer.trim()) {
    processFrame(buffer);
  }

  if (streamError) {
    throw new Error(streamError);
  }

  return {
    text: accumulatedText,
    cards: resolvedCards,
    model,
    provider,
  };
}

export async function fetchConversationsPersistence(user: UserProfile | null): Promise<{
  conversations: AiConversation[];
  persistedMode: 'supabase' | 'local';
  sqlMigrationNeeded: boolean;
}> {
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    const { data: convRows, error: convErr } = await supabase
      .from('ai_conversations')
      .select('id, title, mode, attached_movies, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(40);

    if (convErr) {
      if (isMissingRelationError(convErr)) {
        return {
          conversations: readLocalConversations(user),
          persistedMode: 'local',
          sqlMigrationNeeded: true,
        };
      }
      console.warn('Supabase AI conversations fetch notice:', convErr.message);
      return {
        conversations: readLocalConversations(user),
        persistedMode: 'local',
        sqlMigrationNeeded: false,
      };
    }

    const convIds = (convRows ?? []).map((r) => r.id as string);
    const messagesByConv = new Map<string, AiMessage[]>();

    if (convIds.length > 0) {
      const { data: msgRows, error: msgErr } = await supabase
        .from('ai_messages')
        .select('id, conversation_id, role, content, movie_context, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });

      if (!msgErr && msgRows) {
        for (const row of msgRows) {
          const cid = row.conversation_id as string;
          const list = messagesByConv.get(cid) ?? [];
          list.push({
            id: row.id as string,
            conversationId: cid,
            role: row.role as 'user' | 'assistant',
            content: row.content as string,
            movieContext: (row.movie_context as AiMessageMovieContext | null) ?? null,
            createdAt: row.created_at as string,
          });
          messagesByConv.set(cid, list);
        }
      }
    }

    const conversations: AiConversation[] = (convRows ?? []).map((row) => ({
      id: row.id as string,
      title: (row.title as string) || 'Untitled Screening',
      mode: ((row.mode as AiMode) || 'discovery'),
      attachedMovies: Array.isArray(row.attached_movies)
        ? (row.attached_movies as AttachedMovieContext[])
        : [],
      messages: messagesByConv.get(row.id as string) ?? [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      persistedMode: 'supabase',
    }));

    return {
      conversations,
      persistedMode: 'supabase',
      sqlMigrationNeeded: false,
    };
  }

  return {
    conversations: readLocalConversations(user),
    persistedMode: 'local',
    sqlMigrationNeeded: false,
  };
}

export async function createConversationPersistence(
  user: UserProfile | null,
  initial: {
    title: string;
    mode: AiMode;
    attachedMovies: AttachedMovieContext[];
  }
): Promise<AiConversation> {
  const now = new Date().toISOString();
  const id = createId();
  const supabase = getSupabaseClient();

  if (supabase && user?.authMode === 'supabase') {
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({
        id,
        user_id: user.id,
        title: initial.title,
        mode: initial.mode,
        attached_movies: initial.attachedMovies,
      })
      .select('id, title, mode, attached_movies, created_at, updated_at')
      .single();

    if (!error && data) {
      return {
        id: data.id as string,
        title: data.title as string,
        mode: (data.mode as AiMode) || initial.mode,
        attachedMovies: Array.isArray(data.attached_movies)
          ? (data.attached_movies as AttachedMovieContext[])
          : initial.attachedMovies,
        messages: [],
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
        persistedMode: 'supabase',
      };
    }
  }

  const localConv: AiConversation = {
    id,
    title: initial.title,
    mode: initial.mode,
    attachedMovies: initial.attachedMovies,
    messages: [],
    createdAt: now,
    updatedAt: now,
    persistedMode: 'local',
  };

  const existing = readLocalConversations(user);
  writeLocalConversations(user, [localConv, ...existing]);
  return localConv;
}

export async function updateConversationPersistence(
  user: UserProfile | null,
  conv: AiConversation
): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase' && conv.persistedMode === 'supabase') {
    await supabase
      .from('ai_conversations')
      .update({
        title: conv.title,
        mode: conv.mode,
        attached_movies: conv.attachedMovies,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conv.id)
      .eq('user_id', user.id);
    return;
  }

  const existing = readLocalConversations(user);
  const idx = existing.findIndex((c) => c.id === conv.id);
  const next = idx >= 0
    ? existing.map((c) => (c.id === conv.id ? conv : c))
    : [conv, ...existing];
  writeLocalConversations(user, next);
}

export async function appendMessagePersistence(
  user: UserProfile | null,
  conv: AiConversation,
  message: AiMessage
): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase' && conv.persistedMode === 'supabase') {
    const { error } = await supabase.from('ai_messages').insert({
      id: message.id,
      conversation_id: conv.id,
      role: message.role,
      content: message.content,
      movie_context: message.movieContext ?? null,
    });
    if (!error) return;
  }

  const existing = readLocalConversations(user);
  const hasConv = existing.some((c) => c.id === conv.id);
  const updatedConv: AiConversation = {
    ...conv,
    updatedAt: message.createdAt,
  };
  const next = hasConv
    ? existing.map((c) => (c.id === conv.id ? updatedConv : c))
    : [updatedConv, ...existing];
  writeLocalConversations(user, next);
}

export async function deleteConversationPersistence(
  user: UserProfile | null,
  convId: string,
  persistedMode: 'supabase' | 'local'
): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase' && persistedMode === 'supabase') {
    await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', convId)
      .eq('user_id', user.id);
  }
  const existing = readLocalConversations(user).filter((c) => c.id !== convId);
  writeLocalConversations(user, existing);
}

export async function clearAllConversationsPersistence(user: UserProfile | null): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    await supabase.from('ai_conversations').delete().eq('user_id', user.id);
  }
  writeLocalConversations(user, []);
}

export async function fetchSavedRecommendationsPersistence(
  user: UserProfile | null
): Promise<AiRecommendationCard[]> {
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    const { data, error } = await supabase
      .from('ai_saved_recommendations')
      .select('card_snapshot')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(80);

    if (!error && data) {
      return data.map((row) => row.card_snapshot as AiRecommendationCard);
    }
  }
  return readLocalSavedRecs(user);
}

export async function toggleSavedRecommendationPersistence(
  user: UserProfile | null,
  card: AiRecommendationCard,
  current: AiRecommendationCard[]
): Promise<{ next: AiRecommendationCard[]; saved: boolean }> {
  const exists = current.some((c) => c.id === card.id);
  const next = exists ? current.filter((c) => c.id !== card.id) : [card, ...current];
  writeLocalSavedRecs(user, next);

  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    if (exists) {
      await supabase
        .from('ai_saved_recommendations')
        .delete()
        .eq('user_id', user.id)
        .eq('movie_key', card.id);
    } else {
      await supabase.from('ai_saved_recommendations').upsert(
        {
          user_id: user.id,
          movie_key: card.id,
          card_snapshot: card,
        },
        { onConflict: 'user_id,movie_key' }
      );
    }
  }

  return { next, saved: !exists };
}

export function cardToAttachedMovie(card: AiRecommendationCard): AttachedMovieContext {
  return {
    id: card.internalMovieId ?? card.id,
    tmdbId: card.tmdbId,
    imdbId: card.imdbId,
    title: card.title,
    releaseYear: card.releaseYear,
    genres: card.genres,
    description: card.description,
    director: card.director,
    actors: card.actors,
    duration: card.duration,
    posterUrl: card.posterUrl,
    ratings: card.ratings,
    availableInNoir: card.availableInNoir,
  };
}

export function recommendationCardToMovie(card: AiRecommendationCard): Movie {
  if (card.movieSnapshot) {
    return card.movieSnapshot;
  }
  return {
    id: card.internalMovieId ?? card.id,
    tmdbId: card.tmdbId,
    imdbId: card.imdbId,
    title: card.title,
    originalTitle: null,
    releaseDate: card.releaseYear ? String(card.releaseYear) : '',
    releaseYear: card.releaseYear,
    genres: card.genres,
    duration: card.duration,
    director: card.director,
    actors: card.actors,
    description: card.description,
    posterUrl: card.posterUrl,
    backdropUrl: card.backdropUrl,
    trailerUrl: null,
    youtubeTrailerId: null,
    playableStream: null,
    ratings: card.ratings,
    popularity: 0,
    language: 'EN',
    languageCode: 'en',
    country: 'International',
  };
}
