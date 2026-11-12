import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Check,
  Film,
  Play,
  Plus,
  Share2,
  Sparkles,
  X,
  Youtube,
} from 'lucide-react';
import type { Movie } from '@/types/movie';
import { movieToAttachedContext } from '@/types/ai';
import { useCatalog } from '@/context/CatalogContext';
import { useWatchlist } from '@/context/WatchlistContext';
import { useAi } from '@/context/AiContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { RatingsBadge } from '@/components/movies/RatingsBadge';
import { PosterFallback } from '@/components/movies/PosterFallback';
import { MovieCard } from '@/components/movies/MovieCard';
import { formatReleaseDate, formatRuntime } from '@/utils/formatters';

interface MovieDetailsContentProps {
  movie: Movie;
  onClose?: () => void;
  onSelectMovie?: (movie: Movie) => void;
}

export function MovieDetailsContent({
  movie: initialMovie,
  onClose,
  onSelectMovie,
}: MovieDetailsContentProps) {
  const { movies, enrichMovie, getMovieById } = useCatalog();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { attachMovie } = useAi();
  const { notify } = useToast();
  const navigate = useNavigate();

  const handleDiscussWithAi = () => {
    const activeMovie = getMovieById(initialMovie.id) ?? initialMovie;
    attachMovie(movieToAttachedContext(activeMovie, true));
    notify(`Attached "${activeMovie.title}" to NOIR AI`, 'info');
    onClose?.();
    navigate('/cinema-ai');
  };

  const [showTrailer, setShowTrailer] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll({ container: scrollContainerRef });
  const backdropY = useTransform(scrollY, [0, 500], [0, 90]);
  const backdropScale = useTransform(scrollY, [0, 500], [1, 1.08]);

  // Live reference so enrichment updates automatically reflect
  const movie = getMovieById(initialMovie.id) ?? initialMovie;

  useEffect(() => {
    setShowTrailer(false);
    scrollContainerRef.current?.scrollTo({ top: 0 });
    void enrichMovie(initialMovie.id);
  }, [initialMovie.id, enrichMovie]);

  const saved = isInWatchlist(movie.id);

  const similarMovies = useMemo(() => {
    const primaryGenres = new Set(movie.genres.map((g) => g.toLowerCase()));
    return movies
      .filter((m) => m.id !== movie.id)
      .map((m) => {
        const shared = m.genres.filter((g) => primaryGenres.has(g.toLowerCase())).length;
        const dirBonus = m.director && movie.director && m.director === movie.director ? 3 : 0;
        const eraBonus = Math.abs(m.releaseYear - movie.releaseYear) <= 10 ? 1 : 0;
        return { movie: m, score: shared * 4 + dirBonus + eraBonus };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.movie.popularity - a.movie.popularity)
      .slice(0, 10)
      .map((e) => e.movie);
  }, [movies, movie]);

  const handleToggleWatchlist = async () => {
    const added = await toggleWatchlist(movie);
    notify(
      added
        ? `Added "${movie.title}" to My List.`
        : `Removed "${movie.title}" from My List.`,
      'success'
    );
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/movie/${encodeURIComponent(movie.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${movie.title} (${movie.releaseYear}) — NOIR`,
          text: movie.description.slice(0, 120),
          url: shareUrl,
        });
        return;
      } catch {
        // Fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      notify('Screening link copied to clipboard.', 'success');
    } catch {
      notify(shareUrl, 'info');
    }
  };

  const handlePlay = () => {
    if (onClose) onClose();
    navigate(`/watch/${encodeURIComponent(movie.id)}`);
  };

  return (
    <div
      ref={scrollContainerRef}
      className="h-full w-full overflow-y-auto bg-[#090909] text-[#F5F5F5] relative"
    >
      {/* Top Close / Navigation Bar */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close movie details"
          className="fixed top-5 right-5 sm:top-7 sm:right-8 z-40 flex items-center gap-2 bg-[#090909]/85 hover:bg-[#181818] border border-white/18 hover:border-[#C6A46A] px-3.5 py-2 text-xs font-mono-tech uppercase tracking-[0.14em] text-[#F5F5F5] transition-colors cursor-pointer"
        >
          <span className="hidden sm:inline">Close</span>
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Full-Width Parallax Backdrop Header */}
      <div className="relative min-h-[520px] sm:min-h-[600px] lg:min-h-[660px] flex items-end overflow-hidden border-b border-white/[0.08]">
        <motion.div
          style={{ y: backdropY, scale: backdropScale }}
          className="absolute inset-0 pointer-events-none"
        >
          {movie.backdropUrl ? (
            <img
              src={movie.backdropUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-55"
            />
          ) : movie.posterUrl ? (
            <img
              src={movie.posterUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover blur-2xl scale-110 opacity-25"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/65 to-[#090909]/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#090909] via-[#090909]/70 to-transparent" />
        </motion.div>

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16 pb-12 pt-28 grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-end">
          {/* Theatrical Poster Print */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="hidden md:block md:col-span-4 lg:col-span-3"
          >
            <div className="aspect-[2/3] w-full max-w-[270px] bg-[#141414] border border-white/18 shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden">
              {movie.posterUrl ? (
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <PosterFallback movie={movie} />
              )}
            </div>
          </motion.div>

          {/* Editorial Title & Primary Actions */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-8 lg:col-span-9 space-y-5"
          >
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tech uppercase tracking-[0.2em] text-[#C6A46A]">
              <span>Film Dossier</span>
              <span className="text-white/25">/</span>
              <span>{movie.releaseYear || 'Archive'}</span>
              <span className="text-white/25">/</span>
              <span>{formatRuntime(movie.duration)}</span>
            </div>

            <div className="space-y-2">
              <h1 className="font-serif-display text-4xl sm:text-6xl font-medium text-[#F5F5F5] leading-[1.0] tracking-tight">
                {movie.title}
              </h1>
              {movie.originalTitle && (
                <p className="font-serif-display italic text-xl text-[#929292]">
                  Original Title: {movie.originalTitle}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {movie.genres.map((genre) => (
                <span
                  key={genre}
                  className="border border-white/15 bg-[#121212]/80 px-2.5 py-1 text-[11px] font-mono-tech uppercase tracking-[0.12em] text-[#d4d4d4]"
                >
                  {genre}
                </span>
              ))}
            </div>

            <RatingsBadge ratings={movie.ratings} />

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="accent"
                size="lg"
                onClick={handlePlay}
                icon={<Play className="w-4 h-4 fill-current" />}
              >
                {movie.playableStream ? 'Play Full Feature' : 'Play / Screening Room'}
              </Button>

              {movie.youtubeTrailerId && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setShowTrailer((prev) => !prev)}
                  icon={<Youtube className="w-4 h-4" />}
                >
                  {showTrailer ? 'Hide Trailer' : 'Watch Trailer'}
                </Button>
              )}

              <Button
                variant="ghost"
                size="lg"
                onClick={() => void handleToggleWatchlist()}
                icon={
                  saved ? (
                    <Check className="w-4 h-4 text-[#C6A46A]" strokeWidth={2} />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )
                }
              >
                {saved ? 'In My List' : 'Add to My List'}
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={handleDiscussWithAi}
                icon={<Sparkles className="w-4 h-4 text-[#C6A46A]" />}
              >
                Discuss with NOIR AI
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={() => void handleShare()}
                icon={<Share2 className="w-4 h-4" />}
              >
                Share
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Inline Official Trailer Theater Panel */}
      {showTrailer && movie.youtubeTrailerId && (
        <div className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16 pt-10">
          <div className="border border-[#C6A46A]/40 bg-[#050505]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 text-xs font-mono-tech uppercase tracking-[0.16em] text-[#C6A46A]">
              <span>Official Trailer Preview</span>
              <button
                type="button"
                onClick={() => setShowTrailer(false)}
                className="text-[#929292] hover:text-[#F5F5F5] cursor-pointer"
              >
                Close Trailer
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                title={`${movie.title} Official Trailer`}
                src={`https://www.youtube-nocookie.com/embed/${movie.youtubeTrailerId}?autoplay=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Editorial Body: Synopsis + Technical Specifications */}
      <div className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Synopsis & Principal Cast */}
        <div className="lg:col-span-7 space-y-10">
          <section className="space-y-3">
            <h2 className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-[#C6A46A]">
              Synopsis
            </h2>
            <p className="text-base text-[#d8d8d8] leading-relaxed">{movie.description}</p>
          </section>

          <section className="space-y-4">
            <h2 className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-[#C6A46A]">
              Principal Cast
            </h2>
            {movie.actors.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {movie.actors.map((actor) => (
                  <div
                    key={actor}
                    className="border border-white/[0.08] bg-[#111111] px-3.5 py-2.5 text-xs text-[#F5F5F5]"
                  >
                    {actor}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#929292]">Cast records unavailable for this archive entry.</p>
            )}
          </section>
        </div>

        {/* Right: Filmographic Dossier Panel */}
        <aside className="lg:col-span-5">
          <div className="border border-white/10 bg-[#111111] p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
              <Film className="w-4 h-4 text-[#C6A46A]" strokeWidth={1.5} />
              <h2 className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-[#F5F5F5]">
                Technical &amp; Production Record
              </h2>
            </div>

            <dl className="divide-y divide-white/[0.06] text-xs">
              <div className="py-3 flex justify-between gap-4">
                <dt className="text-[#929292] uppercase tracking-wider font-mono-tech">Director</dt>
                <dd className="text-[#F5F5F5] text-right font-medium">
                  {movie.director ?? 'Not available'}
                </dd>
              </div>
              <div className="py-3 flex justify-between gap-4">
                <dt className="text-[#929292] uppercase tracking-wider font-mono-tech">Release Date</dt>
                <dd className="text-[#F5F5F5] text-right">
                  {formatReleaseDate(movie.releaseDate)}
                </dd>
              </div>
              <div className="py-3 flex justify-between gap-4">
                <dt className="text-[#929292] uppercase tracking-wider font-mono-tech">Runtime</dt>
                <dd className="text-[#F5F5F5] text-right">{formatRuntime(movie.duration)}</dd>
              </div>
              <div className="py-3 flex justify-between gap-4">
                <dt className="text-[#929292] uppercase tracking-wider font-mono-tech">Language</dt>
                <dd className="text-[#F5F5F5] text-right">{movie.language}</dd>
              </div>
              <div className="py-3 flex justify-between gap-4">
                <dt className="text-[#929292] uppercase tracking-wider font-mono-tech">Country</dt>
                <dd className="text-[#F5F5F5] text-right">{movie.country}</dd>
              </div>
              <div className="py-3 flex justify-between gap-4">
                <dt className="text-[#929292] uppercase tracking-wider font-mono-tech">IMDb Score</dt>
                <dd className="text-[#C6A46A] font-mono-tech text-right">
                  {movie.ratings.imdb !== null ? `${movie.ratings.imdb.toFixed(1)} / 10` : 'Not available'}
                </dd>
              </div>
              <div className="py-3 flex justify-between gap-4">
                <dt className="text-[#929292] uppercase tracking-wider font-mono-tech">
                  Rotten Tomatoes
                </dt>
                <dd className="text-[#F5F5F5] font-mono-tech text-right">
                  {movie.ratings.rottenTomatoes ?? 'Not available'}
                </dd>
              </div>
              <div className="py-3 flex justify-between gap-4">
                <dt className="text-[#929292] uppercase tracking-wider font-mono-tech">Stream Rights</dt>
                <dd className="text-right text-[#b4b4b4]">
                  {movie.playableStream
                    ? movie.playableStream.licenseLabel
                    : movie.youtubeTrailerId
                    ? 'Official Trailer Only'
                    : 'Metadata & Registry Only'}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {/* Similar Films Strip */}
      {similarMovies.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-16 pb-16 pt-6 border-t border-white/[0.08]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#C6A46A]">
                Companion Screenings
              </span>
              <h2 className="font-serif-display text-3xl text-[#F5F5F5] mt-1">
                Similar Cinema
              </h2>
            </div>
          </div>
          <div className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-2">
            {similarMovies.map((sim) => (
              <div
                key={sim.id}
                onClickCapture={(e) => {
                  if (onSelectMovie) {
                    e.stopPropagation();
                    onSelectMovie(sim);
                  }
                }}
              >
                <MovieCard movie={sim} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
