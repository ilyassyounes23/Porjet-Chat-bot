import React, { createContext, useCallback, useContext, useState } from 'react';
import type { Movie } from '@/types/movie';

interface ModalContextValue {
  selectedMovie: Movie | null;
  openMovieDetails: (movie: Movie) => void;
  closeMovieDetails: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  const openMovieDetails = useCallback((movie: Movie) => {
    setSelectedMovie(movie);
  }, []);

  const closeMovieDetails = useCallback(() => {
    setSelectedMovie(null);
  }, []);

  return (
    <ModalContext.Provider
      value={{
        selectedMovie,
        openMovieDetails,
        closeMovieDetails,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useMovieModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useMovieModal must be used within ModalProvider');
  return ctx;
}
