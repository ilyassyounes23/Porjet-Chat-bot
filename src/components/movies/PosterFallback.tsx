import type { Movie } from '@/types/movie';
import { formatRuntimeMono } from '@/utils/formatters';

interface PosterFallbackProps {
  movie: Movie;
  className?: string;
}

export function PosterFallback({ movie, className = '' }: PosterFallbackProps) {
  return (
    <div
      className={`w-full h-full bg-[#121212] border border-white/10 flex flex-col justify-between p-4 select-none relative overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between text-[10px] font-mono-tech uppercase tracking-[0.18em] text-[#929292]">
        <span>{movie.releaseYear || 'ARCHIVE'}</span>
        <span>{formatRuntimeMono(movie.duration)}</span>
      </div>

      <div className="my-auto py-3">
        <div className="h-px w-8 bg-[#C6A46A] mb-3" />
        <p className="font-serif-display text-xl leading-[1.12] font-medium text-[#F5F5F5] line-clamp-4">
          {movie.title}
        </p>
        {movie.director && (
          <p className="mt-2 text-[11px] text-[#929292] tracking-wide truncate">
            Dir. {movie.director}
          </p>
        )}
      </div>

      <div className="border-t border-white/[0.08] pt-2.5 flex items-center justify-between text-[10px] font-mono-tech uppercase tracking-[0.16em] text-[#6d6d6d]">
        <span className="truncate">{movie.genres[0] ?? 'Cinema'}</span>
        <span className="text-[#C6A46A]">NOIR</span>
      </div>
    </div>
  );
}
