import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMovieModal } from '@/context/ModalContext';
import { MovieDetailsContent } from './MovieDetailsContent';

export function MovieDetailsModal() {
  const { selectedMovie, openMovieDetails, closeMovieDetails } = useMovieModal();

  useEffect(() => {
    if (!selectedMovie) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMovieDetails();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedMovie, closeMovieDetails]);

  return (
    <AnimatePresence>
      {selectedMovie && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedMovie.title} details`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          className="fixed inset-0 z-[75] bg-[#090909]"
        >
          <motion.div
            key={selectedMovie.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="h-full w-full"
          >
            <MovieDetailsContent
              movie={selectedMovie}
              onClose={closeMovieDetails}
              onSelectMovie={(next) => openMovieDetails(next)}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
