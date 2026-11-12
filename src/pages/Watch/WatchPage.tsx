import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Film, Info, ShieldAlert } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { useWatchlist } from '@/context/WatchlistContext';
import { CinemaPlayer } from '@/components/player/CinemaPlayer';
import { RatingsBadge } from '@/components/movies/RatingsBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatRuntime } from '@/utils/formatters';

export function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { movies, getMovieById, enrichMovie, loading } = useCatalog();
  const { history, logViewing } = useWatchlist();

  const movie = id ? getMovieById(decodeURIComponent(id)) : undefined;
  const savedProgress = useMemo(
    () => (movie ? history.find((h) => h.movie.id === movie.id)?.progressSeconds ?? 0 : 0),
    [history, movie]
  );

  useEffect(() => {
    if (movie) {
      void enrichMovie(movie.id);
      void logViewing(movie, savedProgress, (movie.duration ?? 90) * 60);
    }
  }, [movie?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const playableArchiveFilms = useMemo(
    () => movies.filter((m) => Boolean(m.playableStream) && m.id !== movie?.id),
    [movies, movie?.id]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090909] pt-28 px-8 max-w-6xl mx-auto">
        <div className="aspect-video noir-skeleton" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-[#090909] pt-28 px-5">
        <EmptyState
          title="Screening Unavailable"
          description="We could not locate this title in the NOIR catalog."
          actionLabel="Browse Catalog"
          onAction={() => navigate('/movies')}
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#090909] pt-24 pb-20 px-5 sm:px-8 lg:px-14 max-w-[1440px] mx-auto">
      {/* Theater Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-mono-tech uppercase tracking-[0.16em] text-[#929292] hover:text-[#F5F5F5] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-4">
          <span className="font-mono-tech text-[11px] uppercase tracking-[0.18em] text-[#C6A46A]">
            {movie.playableStream
              ? movie.playableStream.licenseLabel
              : movie.youtubeTrailerId
              ? 'Official Trailer Screening'
              : 'Licensing Notice'}
          </span>
          <Link
            to={`/movie/${encodeURIComponent(movie.id)}`}
            className="inline-flex items-center gap-1.5 border border-white/15 hover:border-white/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-[#F5F5F5]"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Film Dossier</span>
          </Link>
        </div>
      </div>

      {/* Player Stage */}
      {movie.playableStream ? (
        <CinemaPlayer
          key={movie.id}
          movie={movie}
          initialProgressSeconds={savedProgress}
          onProgress={(sec, dur) => {
            void logViewing(movie, sec, dur);
          }}
        />
      ) : movie.youtubeTrailerId ? (
        <div className="space-y-4">
          <div className="aspect-video w-full bg-black border border-white/15 overflow-hidden">
            <iframe
              title={`${movie.title} Official Trailer`}
              src={`https://www.youtube-nocookie.com/embed/${movie.youtubeTrailerId}?autoplay=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
          <div className="border border-[#C6A46A]/35 bg-[#111111] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-[#C6A46A] shrink-0 mt-0.5" />
              <div className="text-xs text-[#b4b4b4] leading-relaxed">
                <span className="text-[#F5F5F5] font-medium">
                  Showing Official Trailer Preview.{' '}
                </span>
                Full commercial feature streams require studio distribution licensing and are not
                hosted without authorization.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="aspect-video w-full bg-[#111111] border border-white/12 flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="w-14 h-14 border border-white/15 bg-[#181818] flex items-center justify-center text-[#C6A46A]">
            <Film className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <h2 className="font-serif-display text-3xl text-[#F5F5F5]">
            Full Stream Playback Unavailable
          </h2>
          <p className="text-xs text-[#929292] max-w-lg leading-relaxed">
            No authorized public-domain stream or official trailer is currently linked for{' '}
            <span className="text-[#F5F5F5]">{movie.title}</span>. NOIR strictly restricts full
            video playback to licensed open-cinema and public-domain works.
          </p>
        </div>
      )}

      {/* Screening Metadata */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-white/[0.08] pt-8">
        <div className="lg:col-span-8 space-y-4">
          <h1 className="font-serif-display text-3xl sm:text-5xl font-medium text-[#F5F5F5]">
            {movie.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tech uppercase tracking-[0.14em] text-[#929292]">
            <span>{movie.releaseYear}</span>
            <span>/</span>
            <span>{formatRuntime(movie.duration)}</span>
            <span>/</span>
            <span>{movie.genres.join(', ')}</span>
            {movie.director && (
              <>
                <span>/</span>
                <span className="text-[#d4d4d4]">Dir. {movie.director}</span>
              </>
            )}
          </div>
          <RatingsBadge ratings={movie.ratings} />
          <p className="text-sm text-[#c4c4c4] leading-relaxed max-w-3xl">{movie.description}</p>
        </div>

        {/* Playable Public-Domain Alternatives */}
        {playableArchiveFilms.length > 0 && (
          <div className="lg:col-span-4 border border-white/10 bg-[#111111] p-5 space-y-4">
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#C6A46A]">
              Full Features Ready to Stream
            </p>
            <div className="space-y-3">
              {playableArchiveFilms.slice(0, 5).map((alt) => (
                <Link
                  key={alt.id}
                  to={`/watch/${encodeURIComponent(alt.id)}`}
                  className="flex items-center gap-3 p-2 border border-white/[0.06] hover:border-[#C6A46A]/60 bg-[#151515] transition-colors"
                >
                  <div className="w-10 h-14 bg-[#090909] shrink-0 overflow-hidden">
                    {alt.posterUrl && (
                      <img
                        src={alt.posterUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#F5F5F5] truncate">{alt.title}</p>
                    <p className="text-[11px] font-mono-tech text-[#929292]">
                      {alt.releaseYear} · Full Stream
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
