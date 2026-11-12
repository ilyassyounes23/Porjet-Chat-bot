import { formatImdbScore, formatRottenTomatoes } from '@/utils/formatters';
import type { MovieRatings } from '@/types/movie';

interface RatingsBadgeProps {
  ratings: MovieRatings;
  compact?: boolean;
  showUnavailable?: boolean;
}

export function RatingsBadge({
  ratings,
  compact = false,
  showUnavailable = true,
}: RatingsBadgeProps) {
  const imdbText = formatImdbScore(ratings.imdb);
  const rtText = formatRottenTomatoes(ratings.rottenTomatoes);
  const hasImdb = ratings.imdb !== null;
  const hasRt = Boolean(ratings.rottenTomatoes);

  if (!showUnavailable && !hasImdb && !hasRt) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 text-[11px] font-mono-tech">
        <span
          className={`inline-flex items-center gap-1 ${
            hasImdb ? 'text-[#F5F5F5]' : 'text-[#707070]'
          }`}
          title="IMDb Rating"
        >
          <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 border border-[#C6A46A]/40 text-[#C6A46A]">
            IMDb
          </span>
          <span>{hasImdb ? imdbText : 'N/A'}</span>
        </span>
        {hasRt && (
          <span className="inline-flex items-center gap-1 text-[#d4d4d4]" title="Rotten Tomatoes">
            <span className="text-[9px] uppercase tracking-wider text-[#929292]">RT</span>
            <span>{rtText}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tech">
      {/* IMDb Distinct Metric */}
      <div className="flex items-center gap-2 border border-white/12 bg-[#111111]/90 px-2.5 py-1.5">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#C6A46A] font-medium">
          IMDb
        </span>
        <span className="h-3 w-px bg-white/12" />
        <span className={hasImdb ? 'text-[#F5F5F5]' : 'text-[#757575]'}>
          {hasImdb ? `${imdbText} / 10` : 'Not available'}
        </span>
      </div>

      {/* Rotten Tomatoes Distinct Metric */}
      <div className="flex items-center gap-2 border border-white/12 bg-[#111111]/90 px-2.5 py-1.5">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#d6645a] font-medium">
          Rotten Tomatoes
        </span>
        <span className="h-3 w-px bg-white/12" />
        <span className={hasRt ? 'text-[#F5F5F5]' : 'text-[#757575]'}>
          {rtText}
        </span>
      </div>

      {/* Optional TMDB community score strictly labeled TMDB when available */}
      {typeof ratings.tmdbScore === 'number' && ratings.tmdbScore > 0 && (
        <div className="flex items-center gap-2 border border-white/10 bg-[#111111]/70 px-2.5 py-1.5">
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#929292]">
            TMDB
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="text-[#c5c5c5]">{ratings.tmdbScore.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}
