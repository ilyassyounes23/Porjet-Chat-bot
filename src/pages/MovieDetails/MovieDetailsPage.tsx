import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { MovieDetailsContent } from './MovieDetailsContent';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Movie } from '@/types/movie';

export function MovieDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getMovieById, loading } = useCatalog();

  const decodedId = id ? decodeURIComponent(id) : '';
  const catalogMovie = decodedId ? getMovieById(decodedId) : undefined;
  const [fallbackMovie, setFallbackMovie] = useState<Movie | null>(null);
  const [resolvingFallback, setResolvingFallback] = useState(false);

  useEffect(() => {
    setFallbackMovie(null);
    if (loading || catalogMovie || !decodedId) return;

    let active = true;
    setResolvingFallback(true);
    void import('@/data/demoCatalog.json')
      .then((mod) => {
        if (!active) return;
        const archive = mod.default as Movie[];
        const found = archive.find(
          (m) =>
            m.id === decodedId ||
            m.imdbId === decodedId ||
            (m.tmdbId !== null && `tmdb-${m.tmdbId}` === decodedId)
        );
        if (found) setFallbackMovie(found);
      })
      .finally(() => {
        if (active) setResolvingFallback(false);
      });

    return () => {
      active = false;
    };
  }, [loading, catalogMovie, decodedId]);

  const movie = catalogMovie ?? fallbackMovie ?? undefined;

  if (loading || resolvingFallback) {
    return (
      <div className="min-h-screen bg-[#090909] pt-28 px-8 max-w-5xl mx-auto">
        <div className="h-[460px] noir-skeleton" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-[#090909] pt-28 px-5">
        <EmptyState
          title="Film Entry Not Found"
          description="This film identifier does not match an entry in the active NOIR catalog."
          actionLabel="Return to Discover"
          onAction={() => navigate('/movies')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090909]">
      <div className="fixed top-20 left-5 sm:left-8 lg:left-14 z-30">
        <Link
          to="/movies"
          className="inline-flex items-center gap-2 bg-[#090909]/85 border border-white/15 hover:border-[#C6A46A] px-3 py-1.5 text-xs font-mono-tech uppercase tracking-[0.14em] text-[#F5F5F5]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Catalog</span>
        </Link>
      </div>
      <MovieDetailsContent
        movie={movie}
        onSelectMovie={(next) => navigate(`/movie/${encodeURIComponent(next.id)}`)}
      />
    </div>
  );
}
