import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { RowSkeleton } from '@/components/ui/Skeleton';

const GENRE_DESCRIPTIONS: Record<string, string> = {
  Action: 'Kinetic stunt craft, espionage thrillers, and sweeping set-piece choreography.',
  'Science Fiction': 'Speculative worlds, artificial consciousness, and metaphysical odysseys.',
  Thriller: 'Moral ambiguity, neo-noir shadows, and taut procedural suspense.',
  Horror: 'Atmospheric dread, psychological terror, and boundary-breaking genre cinema.',
  Drama: 'Intimate character portraits, ensemble tragedies, and humanist storytelling.',
  Comedy: 'Deadpan irony, screwball velocity, and incisive social satire.',
  Adventure: 'Uncharted expeditions, historical quests, and frontier epics.',
  Animation: 'Hand-drawn artistry, stop-motion craft, and visionary animated cinema.',
  Documentary: 'Investigative non-fiction, essay cinema, and observational portraiture.',
  Crime: 'Heist architecture, urban underworld chronicles, and courtroom tension.',
  Mystery: 'Labyrinthine whodunits and unreliable narratives.',
  Romance: 'Poetic longing, intimate encounters, and timeless melodrama.',
  War: 'Visceral front-line realism and anti-war cinema.',
  Western: 'Mythic landscapes and twilight frontier legends.',
  Fantasy: 'Folklore, mythic allegories, and surrealist imagination.',
};

export function GenresPage() {
  const { movies, loading } = useCatalog();

  const genreCards = useMemo(() => {
    const map = new Map<string, { count: number; samples: typeof movies }>();
    for (const m of movies) {
      for (const g of m.genres) {
        const current = map.get(g) ?? { count: 0, samples: [] };
        current.count += 1;
        if (current.samples.length < 3 && m.posterUrl) {
          current.samples.push(m);
        }
        map.set(g, current);
      }
    }

    return Array.from(map.entries())
      .filter(([, data]) => data.count >= 4)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data]) => ({
        name,
        count: data.count,
        samples: data.samples,
        description:
          GENRE_DESCRIPTIONS[name] ??
          `Curated ${name.toLowerCase()} selections across international cinema.`,
      }));
  }, [movies]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090909] pt-28 px-5 sm:px-8 lg:px-14">
        <RowSkeleton title="Loading Genres" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090909] pt-28 pb-20 px-5 sm:px-8 lg:px-14 max-w-[1600px] mx-auto">
      <div className="border-b border-white/[0.08] pb-8 mb-10 space-y-3">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-[#C6A46A]" />
          <span className="font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#C6A46A]">
            Curatorial Taxonomy
          </span>
        </div>
        <h1 className="font-serif-display text-4xl sm:text-5xl font-medium text-[#F5F5F5] tracking-tight">
          Genres &amp; Movements
        </h1>
        <p className="text-sm text-[#929292] max-w-xl">
          Navigate the {movies.length}-film archive by genre classification, visual temperament, and
          dramatic form.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {genreCards.map((genre, idx) => (
          <motion.div
            key={genre.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3) }}
          >
            <Link
              to={`/movies?genre=${encodeURIComponent(genre.name)}`}
              className="group block border border-white/10 hover:border-[#C6A46A]/65 bg-[#111111] p-6 transition-colors duration-300 h-full"
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <span className="font-mono-tech text-[10px] text-[#C6A46A] tracking-[0.2em]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h2 className="font-serif-display text-3xl text-[#F5F5F5] group-hover:text-[#C6A46A] transition-colors mt-1">
                    {genre.name}
                  </h2>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#929292] group-hover:text-[#C6A46A] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>

              <p className="text-xs text-[#929292] leading-relaxed mb-6 min-h-[36px]">
                {genre.description}
              </p>

              <div className="flex items-end justify-between gap-4 pt-4 border-t border-white/[0.06]">
                <div className="flex -space-x-3">
                  {genre.samples.map((m) => (
                    <div
                      key={m.id}
                      className="w-11 h-16 border border-white/20 bg-[#181818] overflow-hidden shadow-lg"
                    >
                      {m.posterUrl && (
                        <img
                          src={m.posterUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <span className="font-mono-tech text-[11px] uppercase tracking-[0.14em] text-[#b4b4b4]">
                  {genre.count} Films
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
