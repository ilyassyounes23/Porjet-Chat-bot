import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  clearViewingHistory,
  fetchViewingHistory,
  fetchWatchlist,
  persistAddWatchlist,
  persistRemoveWatchlist,
  recordViewingHistory,
} from '@/services/watchlist/watchlistService';
import type { Movie, ViewingHistoryEntry } from '@/types/movie';

interface WatchlistContextValue {
  watchlist: Movie[];
  history: ViewingHistoryEntry[];
  loading: boolean;
  isInWatchlist: (movieId: string) => boolean;
  toggleWatchlist: (movie: Movie) => Promise<boolean>;
  removeFromWatchlist: (movieId: string) => Promise<void>;
  logViewing: (movie: Movie, progressSeconds?: number, durationSeconds?: number) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<Movie[]>([]);
  const [history, setHistory] = useState<ViewingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const userRef = useRef(user);
  userRef.current = user;
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;
  const historyRef = useRef(history);
  historyRef.current = history;

  const userSyncKey = user ? `${user.authMode}:${user.id}` : 'guest';

  useEffect(() => {
    let active = true;
    const currentUser = userRef.current;
    async function load() {
      setLoading(true);
      const [wl, hist] = await Promise.all([
        fetchWatchlist(currentUser),
        fetchViewingHistory(currentUser),
      ]);
      if (!active) return;
      setWatchlist(wl);
      setHistory(hist);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [userSyncKey]);

  const watchlistIds = useMemo(() => new Set(watchlist.map((m) => m.id)), [watchlist]);

  const isInWatchlist = useCallback(
    (movieId: string) => watchlistIds.has(movieId),
    [watchlistIds]
  );

  const toggleWatchlist = useCallback(async (movie: Movie): Promise<boolean> => {
    const current = watchlistRef.current;
    const currentUser = userRef.current;
    const exists = current.some((m) => m.id === movie.id);
    if (exists) {
      const next = await persistRemoveWatchlist(currentUser, movie.id, current);
      setWatchlist(next);
      return false;
    } else {
      const next = await persistAddWatchlist(currentUser, movie, current);
      setWatchlist(next);
      return true;
    }
  }, []);

  const removeFromWatchlist = useCallback(async (movieId: string) => {
    const next = await persistRemoveWatchlist(userRef.current, movieId, watchlistRef.current);
    setWatchlist(next);
  }, []);

  const logViewing = useCallback(
    async (movie: Movie, progressSeconds = 0, durationSeconds = (movie.duration ?? 90) * 60) => {
      const next = await recordViewingHistory(
        userRef.current,
        {
          movie,
          progressSeconds,
          durationSeconds,
          watchedAt: new Date().toISOString(),
        },
        historyRef.current
      );
      setHistory(next);
    },
    []
  );

  const clearHistory = useCallback(async () => {
    const next = await clearViewingHistory(userRef.current);
    setHistory(next);
  }, []);

  const value = useMemo<WatchlistContextValue>(
    () => ({
      watchlist,
      history,
      loading,
      isInWatchlist,
      toggleWatchlist,
      removeFromWatchlist,
      logViewing,
      clearHistory,
    }),
    [
      watchlist,
      history,
      loading,
      isInWatchlist,
      toggleWatchlist,
      removeFromWatchlist,
      logViewing,
      clearHistory,
    ]
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider');
  return ctx;
}
