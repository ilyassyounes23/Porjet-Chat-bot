import { useNavigate } from 'react-router-dom';
import { Play, Info, Bookmark, Check } from 'lucide-react';
import type { Movie } from '@/types/movie';
import { useMovieModal } from '@/context/ModalContext';
import { useWatchlist } from '@/context/WatchlistContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { RatingsBadge } from './RatingsBadge';
import { PosterFallback } from './PosterFallback';
import { formatRuntimeMono } from '@/utils/formatters';

interface EditorialSpotlightProps {
  movie: Movie;
  label?: string;
}

export function EditorialSpotlight({
  movie,
  label = 'Curator Monograph',
}: EditorialSpotlightProps) {
  const { openMovieDetails } = useMovieModal();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { notify } = useToast();
  const navigate = useNavigate();
  const saved = isInWatchlist(movie.id);

  const handleToggle = async () => {
    const added = await toggleWatchlist(movie);
    notify(added ? `Saved "${movie.title}" to My List.` : `Removed "${movie.title}" from My List.`, 'success');
  };

  return (
    <section className="my-8 mx-5 sm:mx-8 lg:mx-14 border border-white/10 bg-[#111111] grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
      {/* Left Asymmetric Typography Column */}
      <div className="lg:col-span-7 p-7 sm:p-10 lg:p-14 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#C6A46A]" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#C6A46A]">
              {label}
            </span>
          </div>

          <h2 className="font-serif-display text-3xl sm:text-5xl font-medium text-[#F5F5F5] leading-[1.04]">
            {movie.title}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tech text-[#929292] uppercase tracking-[0.14em]">
            <span>{movie.releaseYear}</span>
            <span className="text-white/25">/</span>
            <span>{formatRuntimeMono(movie.duration)}</span>
            {movie.director && (
              <>
                <span className="text-white/25">/</span>
                <span className="text-[#d4d4d4]">Directed by {movie.director}</span>
              </>
            )}
          </div>

          <p className="text-sm text-[#b6b6b6] leading-relaxed max-w-2xl line-clamp-4">
            {movie.description}
          </p>
        </div>

        <div className="space-y-5 pt-2">
          <RatingsBadge ratings={movie.ratings} />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="accent"
              size="md"
              onClick={() => navigate(`/watch/${encodeURIComponent(movie.id)}`)}
              icon={<Play className="w-3.5 h-3.5 fill-current" />}
            >
              {movie.playableStream ? 'Play Feature' : 'Watch Screening'}
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => openMovieDetails(movie)}
              icon={<Info className="w-3.5 h-3.5" />}
            >
              Film Dossier
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void handleToggle()}
              icon={saved ? <Check className="w-3.5 h-3.5 text-[#C6A46A]" /> : <Bookmark className="w-3.5 h-3.5" />}
            >
              {saved ? 'In My List' : 'My List'}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Frame Showcase */}
      <div
        onClick={() => openMovieDetails(movie)}
        className="lg:col-span-5 relative min-h-[280px] lg:min-h-[420px] bg-[#090909] border-t lg:border-t-0 lg:border-l border-white/10 cursor-pointer group overflow-hidden"
      >
        {movie.backdropUrl ? (
          <img
            src={movie.backdropUrl}
            alt={movie.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : movie.posterUrl ? (
          <div className="w-full h-full flex items-center justify-center p-8 bg-[#0c0c0c]">
            <img
              src={movie.posterUrl}
              alt={movie.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="max-h-[360px] w-auto object-contain border border-white/15 shadow-2xl transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <PosterFallback movie={movie} />
        )}
        <div className="hidden lg:block absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#111111] to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
