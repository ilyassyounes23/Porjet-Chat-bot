import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from '@/context/AuthContext';
import { CatalogProvider } from '@/context/CatalogContext';
import { WatchlistProvider } from '@/context/WatchlistContext';
import { AiProvider } from '@/context/AiContext';
import { ModalProvider } from '@/context/ModalContext';
import { ToastProvider } from '@/components/ui/Toast';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HomePage } from '@/pages/Home/HomePage';
import { MoviesPage } from '@/pages/Movies/MoviesPage';
import { GenresPage } from '@/pages/Genres/GenresPage';
import { TrendingPage } from '@/pages/Trending/TrendingPage';
import { WatchlistPage } from '@/pages/Watchlist/WatchlistPage';
import { ProfilePage } from '@/pages/Profile/ProfilePage';
import { LoginPage } from '@/pages/Login/LoginPage';
import { RegisterPage } from '@/pages/Register/RegisterPage';
import { AuthCallbackPage } from '@/pages/Auth/AuthCallbackPage';
import { RedditCallbackPage } from '@/pages/Auth/RedditCallbackPage';
import { MovieDetailsPage } from '@/pages/MovieDetails/MovieDetailsPage';
import { MovieDetailsModal } from '@/pages/MovieDetails/MovieDetailsModal';
import { WatchPage } from '@/pages/Watch/WatchPage';
import { CinemaAiPage } from '@/pages/CinemaAi/CinemaAiPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function AppShell() {
  const { pathname } = useLocation();
  const isAuthScreen =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/auth/callback');
  const isAiStudio = pathname === '/cinema-ai';

  return (
    <div className="min-h-screen bg-[#090909] text-[#F5F5F5] flex flex-col relative">
      {/* Subtle architectural film grain */}
      <div className="fixed inset-0 noir-grain z-[60]" />

      <ScrollToTop />
      {!isAuthScreen && <Navbar />}

      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/movies" element={<MoviesPage />} />
          <Route path="/genres" element={<GenresPage />} />
          <Route path="/trending" element={<TrendingPage />} />
          <Route
            path="/watchlist"
            element={
              <ProtectedRoute>
                <WatchlistPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/movie/:id" element={<MovieDetailsPage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/cinema-ai" element={<CinemaAiPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/callback/reddit" element={<RedditCallbackPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {!isAuthScreen && !isAiStudio && <Footer />}
      <MovieDetailsModal />
    </div>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <CatalogProvider>
              <WatchlistProvider>
                <AiProvider>
                  <ModalProvider>
                    <AppShell />
                  </ModalProvider>
                </AiProvider>
              </WatchlistProvider>
            </CatalogProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
