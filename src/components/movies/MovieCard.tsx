import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Play, Plus } from 'lucide-react';
import type { Movie } from '@/types/movie';
import { useMovieModal } from '@/context/ModalContext';
import { useWatchlist } from '@/context/WatchlistContext';
import { useToast } from '@/components/ui/Toast';
import { PosterFallback } from './PosterFallback';
import { RatingsBadge } from './RatingsBadge';
import { formatRuntimeMono } from '@/utils/formatters';

interface MovieCardProps {
  movie: Movie;
  fluid?: boolean;
  priority?: boolean;
}

export const MovieCard = React.memo(function MovieCard({
  movie,
  fluid = false,
  priority = false,
}: MovieCardProps) {
  const { openMovieDetails } = useMovieModal();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [imgFailed, setImgFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const saved = isInWatchlist(movie.id);

  const handleImageError = () => {
    if (retryCount < 1 && movie.posterUrl) {
      window.setTimeout(() => {
        setRetryCount((c) => c + 1);
      }, 650);
    } else {
      setImgFailed(true);
    }
  };

  const handleWatchlistClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const added = await toggleWatchlist(movie);
    notify(
      added ? `Added "${movie.title}" to My List.` : `Removed "${movie.title}" from My List.`,
      'success'
    );
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/watch/${encodeURIComponent(movie.id)}`);
  };

  const posterSrc =
    movie.posterUrl && retryCount > 0
      ? `${movie.posterUrl}${movie.posterUrl.includes('?') ? '&' : '?'}r=${retryCount}`
      : movie.posterUrl;

  return (
    <article
      onClick={() => openMovieDetails(movie)}
      className={`group cursor-pointer select-none transition-transform duration-200 hover:-translate-y-1 ${
        fluid ? 'w-full' : 'shrink-0 w-[156px] sm:w-[178px] md:w-[196px]'
      }`}
    >
      {/* Sharp 2:3 Poster Frame */}
      <div className="relative aspect-[2/3] w-full bg-[#141414] border border-white/[0.08] group-hover:border-[#C6A46A]/55 overflow-hidden transition-colors duration-300">
        {posterSrc && !imgFailed ? (
          <img
            src={posterSrc}
            alt={`${movie.title} (${movie.releaseYear}) poster`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={handleImageError}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.045]"
          />
        ) : (
          <PosterFallback movie={movie} />
        )}

        {/* Playable Full Stream Tag (strictly for legally verified public-domain / open cinema) */}
        {movie.playableStream && (
          <div className="absolute top-2.5 left-2.5 bg-[#090909]/88 border border-[#C6A46A]/45 px-2 py-0.5 text-[9px] font-mono-tech uppercase tracking-[0.16em] text-[#C6A46A]">
            Full Stream
          </div>
        )}

        {/* Refined Hover Reveal Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/55 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3.5">
          <div className="space-y-2.5 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <div className="flex items-center justify-between text-[10px] font-mono-tech uppercase tracking-[0.14em] text-[#d4d4d4]">
              <span>{movie.genres[0] ?? 'Cinema'}</span>
              <span>{formatRuntimeMono(movie.duration)}</span>
            </div>

            {movie.director && (
              <p className="text-[11px] text-[#b4b4b4] truncate">
                Dir. {movie.director}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handlePlayClick}
                aria-label={`Play ${movie.title}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#F5F5F5] hover:bg-[#C6A46A] text-[#090909] py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Play</span>
              </button>

              <button
                type="button"
                onClick={(e) => void handleWatchlistClick(e)}
                aria-label={saved ? `Remove ${movie.title} from list` : `Add ${movie.title} to list`}
                className={`p-2 border transition-colors cursor-pointer ${
                  saved
                    ? 'bg-[#C6A46A] border-[#C6A46A] text-[#090909]'
                    : 'bg-[#121212]/90 border-white/20 text-[#F5F5F5] hover:border-white/50'
                }`}
              >
                {saved ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Metadata Caption Below Artwork */}
      <div className="mt-2.5 space-y-1 px-0.5">
        <h3 className="text-[13px] font-medium text-[#F5F5F5] group-hover:text-[#C6A46A] transition-colors truncate leading-snug">
          {movie.title}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-tech text-[11px] text-[#929292]">
            {movie.releaseYear || '—'}
          </span>
          <RatingsBadge ratings={movie.ratings} compact showUnavailable />
        </div>
      </div>
    </article>
  );
});
