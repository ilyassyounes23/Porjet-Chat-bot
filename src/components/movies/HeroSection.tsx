import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Info, Play, Plus } from 'lucide-react';
import type { Movie } from '@/types/movie';
import { useMovieModal } from '@/context/ModalContext';
import { useWatchlist } from '@/context/WatchlistContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { RatingsBadge } from './RatingsBadge';
import { formatRuntimeMono } from '@/utils/formatters';

interface HeroSectionProps {
  movies: Movie[];
}

export function HeroSection({ movies }: HeroSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { openMovieDetails } = useMovieModal();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { notify } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (movies.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % movies.length);
    }, 9500);
    return () => window.clearInterval(timer);
  }, [movies.length]);

  const activeMovie = movies[activeIndex] ?? movies[0];
  if (!activeMovie) return null;

  const saved = isInWatchlist(activeMovie.id);

  const handleToggleWatchlist = async () => {
    const added = await toggleWatchlist(activeMovie);
    notify(
      added
        ? `Added "${activeMovie.title}" to My List.`
        : `Removed "${activeMovie.title}" from My List.`,
      'success'
    );
  };

  return (
    <section className="relative w-full min-h-[640px] h-[88vh] max-h-[920px] bg-[#090909] overflow-hidden border-b border-white/[0.08]">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeMovie.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          {/* Layered Backdrop Architecture */}
          {activeMovie.backdropUrl ? (
            <img
              src={activeMovie.backdropUrl}
              alt={`${activeMovie.title} backdrop`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center opacity-60"
            />
          ) : activeMovie.posterUrl ? (
            <>
              <img
                src={activeMovie.posterUrl}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover blur-2xl scale-110 opacity-25"
              />
              {/* Asymmetric Exhibition Print on Desktop when widescreen backdrop is absent */}
              <div className="hidden md:flex absolute right-14 lg:right-24 top-1/2 -translate-y-1/2 z-10 items-center justify-center">
                <div className="relative p-2 bg-[#111111]/90 border border-white/15 shadow-[0_30px_90px_rgba(0,0,0,0.85)]">
                  <img
                    src={activeMovie.posterUrl}
                    alt={`${activeMovie.title} poster`}
                    referrerPolicy="no-referrer"
                    className="h-[400px] lg:h-[470px] w-auto object-cover"
                  />
                </div>
              </div>
            </>
          ) : null}

          {/* Directional Cinema Scrims */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#090909] via-[#090909]/82 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/35 to-[#090909]/65" />
        </motion.div>
      </AnimatePresence>

      {/* Foreground Asymmetric Editorial Content */}
      <div className="relative z-20 h-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-14 flex flex-col justify-end pb-14 sm:pb-16 pt-28">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMovie.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-2xl space-y-5"
            >
              {/* Folio & Telemetry Metadata */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tech uppercase tracking-[0.2em] text-[#C6A46A]">
                <span>
                  {String(activeIndex + 1).padStart(2, '0')} / {String(movies.length).padStart(2, '0')}
                </span>
                <span className="text-white/25">—</span>
                <span>Featured Screening</span>
                {activeMovie.playableStream && (
                  <>
                    <span className="text-white/25">—</span>
                    <span className="text-[#F5F5F5]">Full Feature Available</span>
                  </>
                )}
              </div>

              <h1 className="font-serif-display text-4xl sm:text-6xl lg:text-7xl font-medium text-[#F5F5F5] leading-[0.98] tracking-tight">
                {activeMovie.title}
              </h1>

              {/* Year / Genre / Duration */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-tech uppercase tracking-[0.14em] text-[#b4b4b4]">
                <span className="text-[#F5F5F5]">{activeMovie.releaseYear}</span>
                <span className="text-white/25">/</span>
                <span>{activeMovie.genres.slice(0, 3).join(' · ')}</span>
                <span className="text-white/25">/</span>
                <span>{formatRuntimeMono(activeMovie.duration)}</span>
                {activeMovie.director && (
                  <>
                    <span className="text-white/25">/</span>
                    <span className="text-[#d4d4d4]">Dir. {activeMovie.director}</span>
                  </>
                )}
              </div>

              <p className="text-sm sm:text-[15px] text-[#c4c4c4] leading-relaxed line-clamp-3 max-w-xl">
                {activeMovie.description}
              </p>

              {/* Explicit IMDb and Rotten Tomatoes Ratings */}
              <RatingsBadge ratings={activeMovie.ratings} />

              {/* Action Controls */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => navigate(`/watch/${encodeURIComponent(activeMovie.id)}`)}
                  icon={<Play className="w-4 h-4 fill-current" />}
                >
                  {activeMovie.playableStream ? 'Play Feature' : 'Play / Trailer'}
                </Button>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => openMovieDetails(activeMovie)}
                  icon={<Info className="w-4 h-4" strokeWidth={1.75} />}
                >
                  More Information
                </Button>

                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => void handleToggleWatchlist()}
                  icon={
                    saved ? (
                      <Check className="w-4 h-4 text-[#C6A46A]" strokeWidth={2} />
                    ) : (
                      <Plus className="w-4 h-4" strokeWidth={1.75} />
                    )
                  }
                >
                  {saved ? 'In My List' : 'Add to Watchlist'}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Editorial Film Index Switcher */}
          {movies.length > 1 && (
            <div className="flex items-center gap-2 self-start lg:self-end">
              {movies.map((m, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`Select featured film ${idx + 1}: ${m.title}`}
                    className={`group flex flex-col items-start px-3 py-2 border transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'border-[#C6A46A] bg-[#141414]/90 text-[#F5F5F5]'
                        : 'border-white/12 bg-[#090909]/70 text-[#929292] hover:border-white/30 hover:text-[#F5F5F5]'
                    }`}
                  >
                    <span className="font-mono-tech text-[10px] tracking-[0.18em]">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="hidden xl:block text-[11px] max-w-[96px] truncate mt-0.5">
                      {m.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
