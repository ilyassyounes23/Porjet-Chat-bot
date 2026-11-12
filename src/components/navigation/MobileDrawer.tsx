import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Settings, User, LogIn, Bookmark } from 'lucide-react';
import { NoirWordmark } from '@/components/forms/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { useWatchlist } from '@/context/WatchlistContext';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenSearch: () => void;
}

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Movies', to: '/movies' },
  { label: 'Genres', to: '/genres' },
  { label: 'Trending', to: '/trending' },
  { label: 'NOIR AI', to: '/cinema-ai' },
  { label: 'My List', to: '/watchlist' },
];

export function MobileDrawer({ open, onClose, onOpenSearch }: MobileDrawerProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { watchlist } = useWatchlist();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] bg-[#090909]/98 flex flex-col justify-between p-6 lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <Link to="/" onClick={onClose}>
              <NoirWordmark />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="p-2 border border-white/12 text-[#F5F5F5] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-2 my-auto py-8">
            {NAV_LINKS.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={`flex items-center justify-between py-3.5 border-b border-white/[0.06] font-serif-display text-3xl tracking-tight transition-colors ${
                    active ? 'text-[#C6A46A]' : 'text-[#F5F5F5] hover:text-[#C6A46A]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.to === '/watchlist' && watchlist.length > 0 && (
                    <span className="font-mono-tech text-xs text-[#929292]">
                      {watchlist.length}
                    </span>
                  )}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSearch();
              }}
              className="text-left py-3.5 border-b border-white/[0.06] font-serif-display text-3xl text-[#929292] hover:text-[#F5F5F5] cursor-pointer"
            >
              Search Catalog
            </button>
          </nav>

          <div className="border-t border-white/[0.08] pt-5 space-y-3">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F5F5F5]">{user.fullName}</p>
                    <p className="text-xs text-[#929292]">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void logout();
                      onClose();
                    }}
                    className="text-xs uppercase tracking-[0.14em] text-[#929292] hover:text-[#F5F5F5] border border-white/12 px-3 py-1.5 cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/profile"
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 py-2.5 border border-white/12 text-xs uppercase tracking-[0.12em] text-[#F5F5F5]"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Profile</span>
                  </Link>
                  <Link
                    to="/profile?tab=settings"
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 py-2.5 border border-white/12 text-xs uppercase tracking-[0.12em] text-[#F5F5F5]"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Settings</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/login"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 py-3 border border-white/15 text-xs uppercase tracking-[0.14em] text-[#F5F5F5]"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 py-3 bg-[#C6A46A] text-[#090909] font-medium text-xs uppercase tracking-[0.14em]"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Join NOIR</span>
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
