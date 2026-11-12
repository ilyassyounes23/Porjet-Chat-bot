import { useEffect, useState } from 'react';
import { Check, Film, Plus, Search, Sparkles, X } from 'lucide-react';
import { useAi } from '@/context/AiContext';
import { searchAiMovies } from '@/services/ai/aiService';
import { useDebounce } from '@/hooks/useDebounce';
import type { AttachedMovieContext } from '@/types/ai';

interface AttachMovieModalProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_GENRES = [
  'All',
  'Thriller',
  'Science Fiction',
  'Drama',
  'Crime',
  'Mystery',
  'Horror',
  'Action',
];

export function AttachMovieModal({ open, onClose }: AttachMovieModalProps) {
  const { attachedMovies, attachMovie, removeAttachedMovie } = useAi();
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('All');
  const [results, setResults] = useState<AttachedMovieContext[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 240);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    void searchAiMovies(debouncedQuery, genre === 'All' ? undefined : genre, 16)
      .then((list) => {
        if (active) setResults(list);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, debouncedQuery, genre]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isAttached = (item: AttachedMovieContext) =>
    attachedMovies.some(
      (m) => m.id === item.id || (item.tmdbId !== null && m.tmdbId === item.tmdbId)
    );

  const handleToggle = (item: AttachedMovieContext) => {
    if (isAttached(item)) {
      removeAttachedMovie(item.id);
      return;
    }
    if (attachedMovies.length >= 5) return;
    attachMovie(item);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl bg-[#0D0D0D] border border-white/[0.12] shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div>
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.22em] text-[#C6A46A]">
              Attach Reference Cinema
            </p>
            <h3 className="font-serif-display text-2xl text-[#F5F5F5]">
              Select Films for NOIR AI ({attachedMovies.length}/5 attached)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close movie selector"
            className="p-2 border border-white/12 text-[#9E9E9E] hover:text-[#F5F5F5] hover:border-white/30 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Genre Filters */}
        <div className="px-6 py-4 border-b border-white/[0.06] space-y-3 bg-[#101010]">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#C6A46A] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search NOIR 1,000+ catalog & live TMDB registry (e.g. Shutter Island, Dune, Villeneuve)..."
              className="w-full bg-[#161616] border border-white/[0.12] focus:border-[#C6A46A] pl-10 pr-4 py-2.5 text-sm text-[#F5F5F5] placeholder:text-[#666] outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_GENRES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(g)}
                className={`px-2.5 py-1 font-mono-tech text-[10px] uppercase tracking-[0.14em] border transition-colors cursor-pointer ${
                  genre === g
                    ? 'border-[#C6A46A] bg-[#C6A46A]/15 text-[#F0D5A3]'
                    : 'border-white/10 bg-[#141414] text-[#8E8E8E] hover:text-[#E0E0E0]'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {loading && results.length === 0 ? (
            <div className="py-12 text-center font-mono-tech text-xs uppercase tracking-[0.2em] text-[#888]">
              Searching NOIR Catalog & TMDB Registry...
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="font-serif-display text-xl text-[#D0D0D0]">No matching films found</p>
              <p className="text-xs text-[#7E7E7E]">
                Try a different title, director, or reset the genre filter.
              </p>
            </div>
          ) : (
            results.map((item) => {
              const attached = isAttached(item);
              const limitReached = !attached && attachedMovies.length >= 5;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 p-3 border transition-colors ${
                    attached
                      ? 'border-[#C6A46A]/55 bg-[#C6A46A]/8'
                      : 'border-white/[0.08] bg-[#121212] hover:border-white/25'
                  }`}
                >
                  <div className="w-11 aspect-[2/3] shrink-0 bg-[#1B1B1B] border border-white/10 overflow-hidden flex items-center justify-center">
                    {item.posterUrl ? (
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film className="w-4 h-4 text-[#555]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-serif-display text-lg text-[#F5F5F5] truncate">
                        {item.title}
                      </h4>
                      <span className="font-mono-tech text-[10px] text-[#8A8A8A]">
                        {item.releaseYear || 'N/A'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 border font-mono-tech text-[9px] uppercase tracking-[0.12em] ${
                          item.availableInNoir
                            ? 'border-[#C6A46A]/45 text-[#E4C78F] bg-[#C6A46A]/10'
                            : 'border-white/12 text-[#8F8F8F] bg-[#181818]'
                        }`}
                      >
                        {item.availableInNoir ? 'In NOIR' : 'TMDB'}
                      </span>
                    </div>

                    <p className="text-xs text-[#8D8D8D] truncate">
                      {item.genres.slice(0, 3).join(' · ') || 'Cinema'}
                      {item.director ? ` · Dir. ${item.director}` : ''}
                      {item.ratings.imdb !== null ? ` · IMDb ${item.ratings.imdb.toFixed(1)}` : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={limitReached}
                    onClick={() => handleToggle(item)}
                    className={`px-3 py-1.5 font-mono-tech text-[10px] uppercase tracking-[0.14em] border inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer disabled:opacity-40 ${
                      attached
                        ? 'border-[#C6A46A] bg-[#C6A46A] text-[#090909]'
                        : 'border-white/18 bg-[#181818] text-[#F0F0F0] hover:border-[#C6A46A]'
                    }`}
                  >
                    {attached ? (
                      <>
                        <Check className="w-3 h-3" /> Attached
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" /> Attach
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-[#0B0B0B] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-[#888]">
            <Sparkles className="w-3.5 h-3.5 text-[#C6A46A]" />
            <span>
              Structured metadata (director, cast, genres, synopsis, ratings) is attached cleanly.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#F5F5F5] text-[#090909] font-mono-tech text-[11px] uppercase tracking-[0.16em] hover:bg-white transition-colors cursor-pointer shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
