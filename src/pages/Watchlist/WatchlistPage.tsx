import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Bookmark } from 'lucide-react';
import { useWatchlist } from '@/context/WatchlistContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { MovieCard } from '@/components/movies/MovieCard';
import { EmptyState } from '@/components/ui/EmptyState';

type WatchlistSort = 'added' | 'rating' | 'year' | 'title';

export function WatchlistPage() {
  const { watchlist, removeFromWatchlist, loading } = useWatchlist();
  const { user, capabilities } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState<WatchlistSort>('added');

  const sorted = useMemo(() => {
    const copy = [...watchlist];
    if (sortBy === 'rating') {
      copy.sort((a, b) => (b.ratings.imdb ?? -1) - (a.ratings.imdb ?? -1));
    } else if (sortBy === 'year') {
      copy.sort((a, b) => b.releaseYear - a.releaseYear);
    } else if (sortBy === 'title') {
      copy.sort((a, b) => a.title.localeCompare(b.title));
    }
    return copy;
  }, [watchlist, sortBy]);

  return (
    <main className="min-h-screen bg-[#090909] pt-28 pb-20 px-5 sm:px-8 lg:px-14 max-w-[1600px] mx-auto">
      <div className="border-b border-white/[0.08] pb-8 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#C6A46A]" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#C6A46A]">
              Personal Queue
            </span>
          </div>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-medium text-[#F5F5F5] tracking-tight">
            My List
          </h1>
          <p className="text-xs text-[#929292]">
            {user?.authMode === 'supabase' && capabilities.supabaseConfigured
              ? `Synced to Supabase cloud profile (${user.email})`
              : user
              ? `Stored locally for ${user.fullName}`
              : 'Stored in your browser session — sign in to manage member profiles.'}
          </p>
        </div>

        {watchlist.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="font-mono-tech text-xs text-[#929292]">
              {watchlist.length} {watchlist.length === 1 ? 'Film' : 'Films'}
            </span>
            <select
              aria-label="Sort watchlist"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as WatchlistSort)}
              className="bg-[#121212] border border-white/15 px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none"
            >
              <option value="added">Recently Added</option>
              <option value="rating">Highest IMDb</option>
              <option value="year">Newest Release</option>
              <option value="title">Title (A–Z)</option>
            </select>
          </div>
        )}
      </div>

      {!loading && sorted.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="w-5 h-5" strokeWidth={1.5} />}
          title="Your Screening Queue is Empty"
          description="Curate films from the catalog to assemble your personal late-night screening schedule."
          actionLabel="Explore 500+ Films"
          onAction={() => navigate('/movies')}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-5">
          {sorted.map((movie) => (
            <div key={movie.id} className="space-y-2">
              <MovieCard movie={movie} fluid />
              <button
                type="button"
                onClick={() => {
                  void removeFromWatchlist(movie.id);
                  notify(`Removed "${movie.title}" from My List.`, 'info');
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 border border-white/10 hover:border-red-400/45 py-1.5 text-[10px] font-mono-tech uppercase tracking-[0.14em] text-[#929292] hover:text-red-300 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
