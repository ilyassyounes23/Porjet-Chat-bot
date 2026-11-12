import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { useMovieModal } from '@/context/ModalContext';
import { MovieCard } from '@/components/movies/MovieCard';
import { RatingsBadge } from '@/components/movies/RatingsBadge';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { formatRuntimeMono } from '@/utils/formatters';

export function TrendingPage() {
  const { movies, loading } = useCatalog();
  const { openMovieDetails } = useMovieModal();

  const ranked = useMemo(() => {
    return [...movies]
      .filter((m) => m.tags?.includes('trending') || m.releaseYear >= 2021)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 30);
  }, [movies]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090909] pt-28 px-5 sm:px-8 lg:px-14">
        <RowSkeleton title="Trending Now" />
      </main>
    );
  }

  const topTen = ranked.slice(0, 10);
  const rest = ranked.slice(10);

  return (
    <main className="min-h-screen bg-[#090909] pt-28 pb-20 px-5 sm:px-8 lg:px-14 max-w-[1600px] mx-auto">
      <div className="border-b border-white/[0.08] pb-8 mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#C6A46A]" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#C6A46A]">
              Weekly Pulse
            </span>
          </div>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-medium text-[#F5F5F5] tracking-tight">
            Trending Now
          </h1>
          <p className="text-sm text-[#929292] max-w-xl">
            The most discussed contemporary features and high-momentum screenings across the NOIR
            archive.
          </p>
        </div>

        <Link
          to="/movies?collection=trending"
          className="text-xs font-mono-tech uppercase tracking-[0.16em] text-[#C6A46A] hover:underline"
        >
          Open in Full Filter View →
        </Link>
      </div>

      {/* Editorial Top 10 Ranked Ledger */}
      <section className="space-y-3 mb-16">
        <h2 className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-[#929292] mb-4">
          Top 10 Ranked Screenings
        </h2>
        <div className="divide-y divide-white/[0.06] border-y border-white/[0.08]">
          {topTen.map((movie, idx) => (
            <div
              key={movie.id}
              onClick={() => openMovieDetails(movie)}
              className="group py-4 px-2 sm:px-4 hover:bg-[#111111] transition-colors flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 cursor-pointer"
            >
              <span className="font-serif-display text-3xl sm:text-4xl text-[#C6A46A]/85 w-12 shrink-0">
                {String(idx + 1).padStart(2, '0')}
              </span>

              <div className="w-14 h-20 bg-[#181818] border border-white/10 shrink-0 overflow-hidden">
                {movie.posterUrl && (
                  <img
                    src={movie.posterUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-serif-display text-2xl text-[#F5F5F5] group-hover:text-[#C6A46A] transition-colors truncate">
                  {movie.title}
                </h3>
                <p className="text-xs text-[#929292] truncate">
                  {movie.releaseYear} · {formatRuntimeMono(movie.duration)} ·{' '}
                  {movie.genres.slice(0, 2).join(', ')}
                  {movie.director ? ` · Dir. ${movie.director}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-4 justify-between sm:justify-end">
                <RatingsBadge ratings={movie.ratings} compact />
                <Link
                  to={`/watch/${encodeURIComponent(movie.id)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 border border-white/15 hover:border-[#C6A46A] px-3 py-1.5 text-[10px] font-mono-tech uppercase tracking-[0.14em] text-[#F5F5F5]"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Screen</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Remaining Trending Grid */}
      {rest.length > 0 && (
        <section className="space-y-6">
          <h2 className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-[#929292]">
            Rising Features (11–30)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-5">
            {rest.map((movie) => (
              <MovieCard key={movie.id} movie={movie} fluid />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
