import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import type { Movie } from '@/types/movie';
import { MovieCard } from './MovieCard';

interface MovieRowProps {
  index: number;
  title: string;
  subtitle: string;
  movies: Movie[];
  filterParam: Record<string, string>;
}

export const MovieRow = React.memo(function MovieRow({
  index,
  title,
  subtitle,
  movies,
  filterParam,
}: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [hasEnteredView, setHasEnteredView] = useState(index < 3);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    if (hasEnteredView) return;
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setHasEnteredView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setHasEnteredView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '420px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasEnteredView]);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 12);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 16);
  };

  useEffect(() => {
    updateScrollButtons();
  }, [hasEnteredView, movies.length]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = Math.max(el.clientWidth * 0.78, 320);
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  const queryString = new URLSearchParams(filterParam).toString();
  const folio = String(index + 1).padStart(2, '0');

  return (
    <section
      ref={sectionRef}
      className="py-7 sm:py-9 border-b border-white/[0.05] relative group/row"
    >
      {/* Editorial Section Header */}
      <div className="px-5 sm:px-8 lg:px-14 mb-5 flex items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-mono-tech text-[11px] text-[#C6A46A] tracking-[0.2em]">
              {folio}
            </span>
            <h2 className="font-serif-display text-2xl sm:text-3xl font-medium text-[#F5F5F5] tracking-tight truncate">
              {title}
            </h2>
          </div>
          <p className="text-xs text-[#929292] pl-8 hidden sm:block truncate">{subtitle}</p>
        </div>

        <Link
          to={`/movies?${queryString}`}
          className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-mono-tech uppercase tracking-[0.16em] text-[#929292] hover:text-[#C6A46A] transition-colors pb-1"
        >
          <span>Explore All</span>
          <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
        </Link>
      </div>

      {/* Horizontal Track + Floating Chevrons */}
      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount('left')}
            aria-label={`Scroll ${title} left`}
            className="hidden md:flex items-center justify-center absolute left-2 top-[38%] -translate-y-1/2 z-20 w-10 h-14 bg-[#090909]/90 border border-white/15 hover:border-[#C6A46A] text-[#F5F5F5] opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
        )}

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount('right')}
            aria-label={`Scroll ${title} right`}
            className="hidden md:flex items-center justify-center absolute right-2 top-[38%] -translate-y-1/2 z-20 w-10 h-14 bg-[#090909]/90 border border-white/15 hover:border-[#C6A46A] text-[#F5F5F5] opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar px-5 sm:px-8 lg:px-14 pb-2"
        >
          {hasEnteredView
            ? movies.map((movie, idx) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  priority={index === 0 && idx < 6}
                />
              ))
            : Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="shrink-0 w-[156px] sm:w-[178px] md:w-[196px]">
                  <div className="aspect-[2/3] w-full bg-[#141414] border border-white/[0.06]" />
                  <div className="mt-2.5 h-3.5 w-3/4 bg-[#141414]" />
                  <div className="mt-1.5 h-3 w-1/2 bg-[#141414]" />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
});
