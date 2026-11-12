import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import type { Movie, UserProfile, ViewingHistoryEntry } from '@/types/movie';

const WATCHLIST_KEY_PREFIX = 'noir_watchlist_v1_';
const HISTORY_KEY_PREFIX = 'noir_history_v1_';

function storageSuffix(user: UserProfile | null): string {
  return user ? user.id : 'guest';
}

export async function fetchWatchlist(user: UserProfile | null): Promise<Movie[]> {
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    const { data, error } = await supabase
      .from('watchlists')
      .select('movie_snapshot')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });

    if (!error && data) {
      return data.map((row) => row.movie_snapshot as Movie);
    }
  }

  try {
    const raw = localStorage.getItem(`${WATCHLIST_KEY_PREFIX}${storageSuffix(user)}`);
    return raw ? (JSON.parse(raw) as Movie[]) : [];
  } catch {
    return [];
  }
}

export async function persistAddWatchlist(user: UserProfile | null, movie: Movie, current: Movie[]): Promise<Movie[]> {
  if (current.some((m) => m.id === movie.id)) return current;
  const next = [movie, ...current];

  localStorage.setItem(`${WATCHLIST_KEY_PREFIX}${storageSuffix(user)}`, JSON.stringify(next));

  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    const { error } = await supabase.from('watchlists').upsert(
      {
        user_id: user.id,
        movie_id: movie.id,
        movie_snapshot: movie,
      },
      { onConflict: 'user_id,movie_id' }
    );
    if (error && error.code !== 'PGRST205') {
      console.warn('Supabase watchlist sync notice:', error.message);
    }
  }

  return next;
}

export async function persistRemoveWatchlist(
  user: UserProfile | null,
  movieId: string,
  current: Movie[]
): Promise<Movie[]> {
  const next = current.filter((m) => m.id !== movieId);
  localStorage.setItem(`${WATCHLIST_KEY_PREFIX}${storageSuffix(user)}`, JSON.stringify(next));

  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    const { error } = await supabase
      .from('watchlists')
      .delete()
      .eq('user_id', user.id)
      .eq('movie_id', movieId);
    if (error && error.code !== 'PGRST205') {
      console.warn('Supabase watchlist remove notice:', error.message);
    }
  }

  return next;
}

export async function fetchViewingHistory(user: UserProfile | null): Promise<ViewingHistoryEntry[]> {
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    const { data, error } = await supabase
      .from('viewing_history')
      .select('movie_snapshot, progress_seconds, duration_seconds, watched_at')
      .eq('user_id', user.id)
      .order('watched_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      return data.map((row) => ({
        movie: row.movie_snapshot as Movie,
        progressSeconds: row.progress_seconds ?? 0,
        durationSeconds: row.duration_seconds ?? 0,
        watchedAt: row.watched_at ?? new Date().toISOString(),
      }));
    }
  }

  try {
    const raw = localStorage.getItem(`${HISTORY_KEY_PREFIX}${storageSuffix(user)}`);
    return raw ? (JSON.parse(raw) as ViewingHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function recordViewingHistory(
  user: UserProfile | null,
  entry: ViewingHistoryEntry,
  current: ViewingHistoryEntry[]
): Promise<ViewingHistoryEntry[]> {
  const filtered = current.filter((item) => item.movie.id !== entry.movie.id);
  const next = [entry, ...filtered].slice(0, 50);

  localStorage.setItem(`${HISTORY_KEY_PREFIX}${storageSuffix(user)}`, JSON.stringify(next));

  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    await supabase.from('viewing_history').upsert(
      {
        user_id: user.id,
        movie_id: entry.movie.id,
        movie_snapshot: entry.movie,
        progress_seconds: Math.round(entry.progressSeconds),
        duration_seconds: Math.round(entry.durationSeconds),
        watched_at: entry.watchedAt,
      },
      { onConflict: 'user_id,movie_id' }
    );
  }

  return next;
}

export async function clearViewingHistory(user: UserProfile | null): Promise<ViewingHistoryEntry[]> {
  localStorage.removeItem(`${HISTORY_KEY_PREFIX}${storageSuffix(user)}`);
  const supabase = getSupabaseClient();
  if (supabase && user?.authMode === 'supabase') {
    await supabase.from('viewing_history').delete().eq('user_id', user.id);
  }
  return [];
}
