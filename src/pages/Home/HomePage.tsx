import React, { useMemo } from 'react';
import { useCatalog } from '@/context/CatalogContext';
import { HeroSection } from '@/components/movies/HeroSection';
import { MovieRow } from '@/components/movies/MovieRow';
import { EditorialSpotlight } from '@/components/movies/EditorialSpotlight';
import { HeroSkeleton, RowSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export function HomePage() {
  const { movies, heroMovies, sections, loading, error, refreshCatalog } = useCatalog();

  const spotlights = useMemo(() => {
    if (movies.length === 0) return { first: null, second: null };
    const playable = movies.find((m) => Boolean(m.playableStream));
    const classic = movies.find(
      (m) => m.releaseYear <= 1984 && m.id !== playable?.id && (m.ratings.imdb ?? 0) >= 8.0
    );
    const fallback = movies[12] ?? null;
    return {
      first: playable ?? fallback,
      second: classic ?? movies[24] ?? null,
    };
  }, [movies]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090909]">
        <HeroSkeleton />
        <div className="py-6 space-y-6">
          <RowSkeleton title="Trending Now" />
          <RowSkeleton title="Popular Movies" />
          <RowSkeleton title="Top Rated" />
        </div>
      </div>
    );
  }

  if (error || movies.length === 0) {
    return (
      <div className="min-h-screen bg-[#090909] pt-28 px-5">
        <EmptyState
          title="Unable to Load Cinema Catalog"
          description={error ?? 'The movie archive is temporarily unavailable.'}
          actionLabel="Retry Connection"
          onAction={() => void refreshCatalog()}
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#090909] pb-10">
      <HeroSection movies={heroMovies} />

      <div className="max-w-[1600px] mx-auto pt-4">
        {sections.map((section, idx) => (
          <React.Fragment key={section.id}>
            <MovieRow
              index={idx}
              title={section.title}
              subtitle={section.subtitle}
              movies={section.movies}
              filterParam={section.filterParam}
            />

            {idx === 3 && spotlights.first && (
              <EditorialSpotlight
                movie={spotlights.first}
                label={
                  spotlights.first.playableStream
                    ? 'Open Archive — Full Feature Ready to Stream'
                    : 'Curator Monograph'
                }
              />
            )}

            {idx === 9 && spotlights.second && (
              <EditorialSpotlight
                movie={spotlights.second}
                label="Restoration & Heritage Spotlight"
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </main>
  );
}
