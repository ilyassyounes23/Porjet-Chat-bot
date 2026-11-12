import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Check,
  ExternalLink,
  Film,
  MessageSquarePlus,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { AiRecommendationCard as AiRecommendationCardType } from '@/types/ai';
import { useWatchlist } from '@/context/WatchlistContext';
import { useAi } from '@/context/AiContext';
import { recommendationCardToMovie } from '@/services/ai/aiService';
import { useToast } from '@/components/ui/Toast';
import { formatRuntime } from '@/utils/formatters';

interface AiRecommendationCardProps {
  card: AiRecommendationCardType;
  index: number;
}

export function AiRecommendationCard({ card, index }: AiRecommendationCardProps) {
  const navigate = useNavigate();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const {
    askAiAboutCard,
    findSimilarToCard,
    isRecommendationSaved,
    toggleSaveRecommendation,
    streaming,
  } = useAi();
  const { notify } = useToast();
  const [imgError, setImgError] = useState(false);

  const watchlistMovieId = card.internalMovieId ?? card.id;
  const inWatchlist = isInWatchlist(watchlistMovieId);
  const bookmarked = isRecommendationSaved(card.id);

  const handleViewDetails = () => {
    if (card.availableInNoir && card.internalMovieId) {
      navigate(`/movie/${card.internalMovieId}`);
      return;
    }
    if (card.externalUrl) {
      window.open(card.externalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAskAiAboutMovie = () => {
    askAiAboutCard(card);
    notify(`Switched to Conversational mode · Attached "${card.title}"`, 'info');
  };

  const handleWatchlist = async () => {
    const added = await toggleWatchlist(recommendationCardToMovie(card));
    notify(
      added ? `Added "${card.title}" to My List` : `Removed "${card.title}" from My List`,
      'info'
    );
  };

  const handleSaveBookmark = async () => {
    const saved = await toggleSaveRecommendation(card);
    notify(
      saved ? `Bookmarked "${card.title}" in Saved` : `Removed "${card.title}" from Saved`,
      'info'
    );
  };

  const hasVerifiedImdb = card.ratings.imdb !== null;
  const hasVerifiedRt = Boolean(card.ratings.rottenTomatoes);
  const hasVerifiedPopcorn = Boolean(card.ratings.rottenTomatoesPopcorn);
  const hasTmdbScore =
    typeof card.ratings.tmdbScore === 'number' && card.ratings.tmdbScore > 0;

  return (
    <article className="group border border-white/[0.09] bg-[#101010] hover:border-[#C6A46A]/45 transition-colors duration-300 flex flex-col">
      <div className="p-4 sm:p-5 flex gap-4">
        {/* Poster Column */}
        <div className="relative w-20 sm:w-24 aspect-[2/3] shrink-0 bg-[#171717] border border-white/[0.08] overflow-hidden">
          {card.posterUrl && !imgError ? (
            <img
              src={card.posterUrl}
              alt={`${card.title} poster`}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#555] px-1 text-center">
              <Film className="w-5 h-5 mb-1.5" />
              <span className="font-mono-tech text-[9px] uppercase tracking-wider leading-tight">
                No Poster
              </span>
            </div>
          )}
          <span className="absolute top-1.5 left-1.5 bg-[#090909]/90 border border-white/15 px-1.5 py-0.5 font-mono-tech text-[10px] text-[#C6A46A]">
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        {/* Metadata Column */}
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {card.availableInNoir ? (
                  <span className="inline-flex items-center gap-1 border border-[#C6A46A]/50 bg-[#C6A46A]/12 px-2 py-0.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#E6CB9A]">
                    <Check className="w-2.5 h-2.5" /> Available in NOIR
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 border border-white/15 bg-[#181818] px-2 py-0.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#A0A0A0]">
                    <ExternalLink className="w-2.5 h-2.5" /> Not in NOIR · TMDB
                  </span>
                )}
              </div>

              <h4 className="font-serif-display text-xl sm:text-2xl text-[#F5F5F5] leading-tight truncate">
                {card.title}
              </h4>
              <p className="mt-0.5 font-mono-tech text-[10.5px] uppercase tracking-[0.09em] text-[#8E8E8E]">
                {card.releaseYear || 'Year N/A'}
                {card.duration ? ` · ${formatRuntime(card.duration)}` : ''}
                {card.director ? ` · Dir. ${card.director}` : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveBookmark()}
              title={bookmarked ? 'Remove from Saved' : 'Bookmark recommendation'}
              aria-label={bookmarked ? 'Remove from Saved' : 'Bookmark recommendation'}
              className={`p-1.5 border transition-colors shrink-0 cursor-pointer ${
                bookmarked
                  ? 'border-[#C6A46A]/60 bg-[#C6A46A]/15 text-[#C6A46A]'
                  : 'border-white/12 text-[#888] hover:text-[#F5F5F5] hover:border-white/30'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Genres */}
          {card.genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {card.genres.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="border border-white/10 bg-[#151515] px-2 py-0.5 font-mono-tech text-[9.5px] uppercase tracking-[0.1em] text-[#BDBDBD]"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Main Actors */}
          {card.actors.length > 0 && (
            <p className="mt-2 text-[11px] text-[#949494] truncate">
              <span className="font-mono-tech text-[9.5px] uppercase tracking-[0.1em] text-[#737373] mr-1">
                Cast:
              </span>
              {card.actors.slice(0, 3).join(', ')}
            </p>
          )}

          {/* Verified Ratings (Strictly separated; unavailable displayed explicitly) */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono-tech text-[10px] uppercase tracking-[0.1em]">
            {hasVerifiedImdb ? (
              <span className="border border-white/12 bg-[#161616] px-2 py-0.5 text-[#C6A46A]">
                IMDb {card.ratings.imdb!.toFixed(1)}/10
              </span>
            ) : (
              <span className="border border-white/8 bg-[#141414] px-2 py-0.5 text-[#777]">
                IMDb Not available
              </span>
            )}

            {hasVerifiedRt ? (
              <span className="border border-white/12 bg-[#161616] px-2 py-0.5 text-[#E5E5E5]">
                RT {card.ratings.rottenTomatoes}
              </span>
            ) : (
              <span className="border border-white/8 bg-[#141414] px-2 py-0.5 text-[#777]">
                RT Not available
              </span>
            )}

            {hasVerifiedPopcorn && (
              <span className="border border-white/12 bg-[#161616] px-2 py-0.5 text-[#D8D8D8]">
                Popcorn {card.ratings.rottenTomatoesPopcorn}
              </span>
            )}

            {hasTmdbScore && (
              <span className="border border-white/10 bg-[#141414] px-2 py-0.5 text-[#8E8E8E]">
                TMDB {card.ratings.tmdbScore!.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Synopsis & Curator Reason */}
      <div className="px-4 sm:px-5 pb-4 space-y-2.5 flex-1">
        {card.description && (
          <p className="text-xs text-[#A5A5A5] leading-relaxed line-clamp-2">
            {card.description}
          </p>
        )}

        {card.reason && (
          <div className="border-l-2 border-[#C6A46A]/65 pl-3 py-0.5 space-y-1">
            <p className="text-xs text-[#EBEBEB] leading-relaxed">{card.reason}</p>
            {card.similarityExplanation && (
              <p className="text-[11px] text-[#969696] leading-relaxed">
                {card.similarityExplanation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 4 Interactive Actions */}
      <div className="px-4 sm:px-5 py-3 border-t border-white/[0.07] bg-[#0C0C0C] flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleViewDetails}
          disabled={!card.availableInNoir && !card.externalUrl}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F5F5] text-[#090909] hover:bg-white font-mono-tech text-[10px] uppercase tracking-[0.13em] transition-colors cursor-pointer disabled:opacity-40"
        >
          {card.availableInNoir ? (
            <>
              <Film className="w-3 h-3" /> View Details
            </>
          ) : (
            <>
              <ExternalLink className="w-3 h-3" /> View Details
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => void handleWatchlist()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-white/15 bg-[#151515] text-[#D4D4D4] hover:border-white/35 font-mono-tech text-[10px] uppercase tracking-[0.12em] transition-colors cursor-pointer"
        >
          {inWatchlist ? (
            <>
              <Check className="w-3 h-3 text-[#C6A46A]" /> In My List
            </>
          ) : (
            <>
              <Plus className="w-3 h-3" /> Add to My List
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleAskAiAboutMovie}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#C6A46A]/45 bg-[#C6A46A]/10 text-[#E8CFA1] hover:bg-[#C6A46A]/20 font-mono-tech text-[10px] uppercase tracking-[0.12em] transition-colors cursor-pointer"
        >
          <MessageSquarePlus className="w-3 h-3" /> Ask AI About This Movie
        </button>

        <button
          type="button"
          disabled={streaming}
          onClick={() => void findSimilarToCard(card)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-white/10 text-[#A8A8A8] hover:text-[#F5F5F5] hover:border-white/30 font-mono-tech text-[10px] uppercase tracking-[0.12em] transition-colors cursor-pointer disabled:opacity-40"
        >
          <Sparkles className="w-3 h-3 text-[#C6A46A]" /> Find Similar Movies
        </button>
      </div>
    </article>
  );
}
