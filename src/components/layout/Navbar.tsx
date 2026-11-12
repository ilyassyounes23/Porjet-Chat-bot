import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  Bookmark,
  X,
} from 'lucide-react';
import { NoirWordmark } from '@/components/forms/AuthLayout';
import { MobileDrawer } from '@/components/navigation/MobileDrawer';
import { useAuth } from '@/context/AuthContext';
import { useCatalog } from '@/context/CatalogContext';
import { useMovieModal } from '@/context/ModalContext';
import { useWatchlist } from '@/context/WatchlistContext';
import { useDebounce } from '@/hooks/useDebounce';
import { movieMatchesQuery } from '@/utils/formatters';

const PRIMARY_NAV = [
  { label: 'Home', to: '/' },
  { label: 'Movies', to: '/movies' },
  { label: 'Genres', to: '/genres' },
  { label: 'Trending', to: '/trending' },
  { label: 'NOIR AI', to: '/cinema-ai' },
  { label: 'My List', to: '/watchlist' },
];

export function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { movies } = useCatalog();
  const { openMovieDetails } = useMovieModal();
  const { watchlist } = useWatchlist();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const debouncedQuery = useDebounce(searchText, 140);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !searchOpen)) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      window.setTimeout(() => searchInputRef.current?.focus(), 40);
    } else {
      setSearchText('');
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const quickResults = useMemo(() => {
    if (!debouncedQuery.trim()) return movies.slice(0, 6);
    return movies.filter((m) => movieMatchesQuery(m, debouncedQuery)).slice(0, 8);
  }, [movies, debouncedQuery]);

  const submitSearchPage = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchText.trim();
    setSearchOpen(false);
    navigate(q ? `/movies?q=${encodeURIComponent(q)}` : '/movies');
  };

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'N';

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled || pathname === '/cinema-ai'
            ? 'bg-[#090909]/95 border-b border-white/[0.08] py-3.5'
            : 'bg-gradient-to-b from-[#090909]/90 via-[#090909]/55 to-transparent py-5'
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-14 flex items-center justify-between gap-6">
          {/* Left: Brand + Desktop Navigation */}
          <div className="flex items-center gap-10">
            <Link to="/" aria-label="NOIR Home" className="hover:opacity-90 transition-opacity">
              <NoirWordmark />
            </Link>

            <nav className="hidden lg:flex items-center gap-7" aria-label="Main navigation">
              {PRIMARY_NAV.map((item) => {
                const active =
                  item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`relative text-xs uppercase tracking-[0.16em] transition-colors py-1 ${
                      active ? 'text-[#F5F5F5] font-medium' : 'text-[#929292] hover:text-[#F5F5F5]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {item.label}
                      {item.to === '/watchlist' && watchlist.length > 0 && (
                        <span className="font-mono-tech text-[10px] text-[#C6A46A]">
                          ({watchlist.length})
                        </span>
                      )}
                    </span>
                    {active && (
                      <motion.span
                        layoutId="noir-nav-indicator"
                        className="absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#C6A46A]"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Search, Settings, Profile / Auth */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search films"
              className="inline-flex items-center gap-2.5 border border-white/12 hover:border-white/28 bg-[#111111]/75 px-3 py-1.5 text-xs text-[#929292] hover:text-[#F5F5F5] transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" strokeWidth={1.6} />
              <span className="hidden sm:inline tracking-wide">Search</span>
              <kbd className="hidden md:inline font-mono-tech text-[10px] text-[#6a6a6a] border border-white/10 px-1">
                /
              </kbd>
            </button>

            <Link
              to="/profile?tab=settings"
              aria-label="Account settings"
              title="Account Settings"
              className="hidden sm:inline-flex p-2 border border-transparent hover:border-white/12 text-[#929292] hover:text-[#F5F5F5] transition-colors"
            >
              <Settings className="w-4 h-4" strokeWidth={1.5} />
            </Link>

            {user ? (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((o) => !o)}
                  aria-expanded={profileMenuOpen}
                  aria-label="Open profile menu"
                  className="inline-flex items-center gap-2 border border-white/14 hover:border-[#C6A46A]/60 bg-[#141414] pl-1.5 pr-2.5 py-1 transition-colors cursor-pointer"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName}
                      className="w-6 h-6 object-cover"
                    />
                  ) : (
                    <span className="w-6 h-6 bg-[#C6A46A]/18 border border-[#C6A46A]/45 text-[#C6A46A] font-mono-tech text-[11px] flex items-center justify-center">
                      {initials}
                    </span>
                  )}
                  <span className="hidden md:inline text-xs text-[#F5F5F5] max-w-[110px] truncate">
                    {user.fullName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#929292]" />
                </button>

                <AnimatePresence>
                  {profileMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 mt-2 w-60 bg-[#121212] border border-white/14 shadow-2xl py-1.5 z-50"
                    >
                      <div className="px-4 py-2.5 border-b border-white/[0.08]">
                        <p className="text-xs font-medium text-[#F5F5F5] truncate">
                          {user.fullName}
                        </p>
                        <p className="text-[11px] text-[#929292] truncate">{user.email}</p>
                      </div>

                      <Link
                        to="/profile"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#d4d4d4] hover:bg-white/[0.05] hover:text-[#F5F5F5]"
                      >
                        <User className="w-3.5 h-3.5 text-[#C6A46A]" />
                        <span>Profile &amp; History</span>
                      </Link>

                      <Link
                        to="/watchlist"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#d4d4d4] hover:bg-white/[0.05] hover:text-[#F5F5F5]"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-[#C6A46A]" />
                        <span>My List ({watchlist.length})</span>
                      </Link>

                      <Link
                        to="/profile?tab=settings"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#d4d4d4] hover:bg-white/[0.05] hover:text-[#F5F5F5]"
                      >
                        <Settings className="w-3.5 h-3.5 text-[#C6A46A]" />
                        <span>Account Settings</span>
                      </Link>

                      <div className="border-t border-white/[0.08] mt-1 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            void logout();
                            setProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#929292] hover:bg-white/[0.05] hover:text-red-300 text-left cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/profile"
                  aria-label="Guest profile & preferences"
                  className="hidden sm:inline-flex w-8 h-8 items-center justify-center border border-white/14 bg-[#141414] text-[#929292] hover:text-[#F5F5F5] hover:border-white/30 transition-colors"
                >
                  <User className="w-3.5 h-3.5" strokeWidth={1.6} />
                </Link>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex px-3.5 py-1.5 border border-white/15 hover:border-[#C6A46A] text-[11px] uppercase tracking-[0.14em] text-[#F5F5F5] transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Mobile Menu Trigger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 border border-white/12 text-[#F5F5F5] cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Instant Global Search Palette */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setSearchOpen(false)}
            className="fixed inset-0 z-[85] bg-black/82 flex items-start justify-center pt-16 sm:pt-24 px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#111111] border border-white/16 shadow-[0_32px_100px_rgba(0,0,0,0.9)] overflow-hidden"
            >
              <form
                onSubmit={submitSearchPage}
                className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08]"
              >
                <Search className="w-4 h-4 text-[#C6A46A] shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search by film title, director, actor, genre, or year..."
                  className="flex-1 bg-transparent text-sm text-[#F5F5F5] placeholder:text-[#666666] focus:outline-none"
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => setSearchText('')}
                    className="text-xs text-[#929292] hover:text-[#F5F5F5] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Close search"
                  className="p-1 text-[#929292] hover:text-[#F5F5F5] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>

              <div className="max-h-[60vh] overflow-y-auto divide-y divide-white/[0.05]">
                {quickResults.length > 0 ? (
                  quickResults.map((movie) => (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        openMovieDetails(movie);
                      }}
                      className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/[0.04] text-left transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-14 bg-[#181818] border border-white/10 shrink-0 overflow-hidden">
                        {movie.posterUrl && (
                          <img
                            src={movie.posterUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#F5F5F5] truncate">
                          {movie.title}
                        </p>
                        <p className="text-xs text-[#929292] truncate">
                          {movie.releaseYear}
                          {movie.director ? ` · Dir. ${movie.director}` : ''}
                          {movie.genres.length > 0 ? ` · ${movie.genres.slice(0, 2).join(', ')}` : ''}
                        </p>
                      </div>
                      <span className="font-mono-tech text-[11px] text-[#C6A46A] shrink-0">
                        {movie.ratings.imdb !== null ? `IMDb ${movie.ratings.imdb.toFixed(1)}` : 'Archive'}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-5 py-10 text-center text-xs text-[#929292]">
                    No films matched "{debouncedQuery}".
                  </div>
                )}
              </div>

              <div className="px-5 py-3 bg-[#0c0c0c] border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#929292]">
                <span>Searching across {movies.length} catalogued films</span>
                <button
                  type="button"
                  onClick={submitSearchPage}
                  className="inline-flex items-center gap-1.5 text-[#C6A46A] hover:underline uppercase tracking-[0.12em] font-mono-tech cursor-pointer"
                >
                  <span>Full Discovery &amp; Filters</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
