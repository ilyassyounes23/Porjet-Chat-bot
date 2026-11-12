import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  CheckCircle2,
  Clock,
  LogOut,
  Settings,
  Trash2,
  User,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWatchlist } from '@/context/WatchlistContext';
import { useCatalog } from '@/context/CatalogContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/forms/TextField';
import { MovieCard } from '@/components/movies/MovieCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatTimecode } from '@/utils/formatters';

type ProfileTab = 'overview' | 'history' | 'settings';

export function ProfilePage() {
  const { user, capabilities, updateProfile, logout } = useAuth();
  const { watchlist, history, clearHistory } = useWatchlist();
  const { movies, mode, omdbEnabled } = useCatalog();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = (searchParams.get('tab') as ProfileTab) || 'overview';
  const [activeTab, setActiveTab] = useState<ProfileTab>(
    ['overview', 'history', 'settings'].includes(initialTab) ? initialTab : 'overview'
  );

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [preferredLanguage, setPreferredLanguage] = useState(user?.preferredLanguage ?? 'en');
  const [autoplayTrailers, setAutoplayTrailers] = useState(user?.autoplayTrailers ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as ProfileTab | null;
    if (tabParam && ['overview', 'history', 'settings'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setAvatarUrl(user.avatarUrl ?? '');
      setPreferredLanguage(user.preferredLanguage);
      setAutoplayTrailers(user.autoplayTrailers);
    }
  }, [user]);

  const switchTab = (tab: ProfileTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim() || user.fullName,
        avatarUrl: avatarUrl.trim() || null,
        preferredLanguage,
        autoplayTrailers,
      });
      notify('Account settings updated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'G';

  return (
    <main className="min-h-screen bg-[#090909] pt-28 pb-20 px-5 sm:px-8 lg:px-14 max-w-[1440px] mx-auto">
      {/* Member Dossier Header */}
      <div className="border border-white/10 bg-[#111111] p-6 sm:p-10 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.fullName}
              className="w-16 h-16 sm:w-20 sm:h-20 object-cover border border-[#C6A46A]/60"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#181818] border border-[#C6A46A]/55 flex items-center justify-center font-serif-display text-3xl text-[#C6A46A]">
              {initials}
            </div>
          )}

          <div className="space-y-1">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#C6A46A]">
              {user
                ? user.authMode === 'supabase'
                  ? 'Verified Supabase Member'
                  : 'Local Studio Session'
                : 'Guest Screening Mode'}
            </span>
            <h1 className="font-serif-display text-3xl sm:text-4xl text-[#F5F5F5]">
              {user ? user.fullName : 'Guest Cinephile'}
            </h1>
            <p className="text-xs text-[#929292]">
              {user ? user.email : 'Sign in or create an account to manage persistent member preferences.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                void logout();
                notify('Signed out of NOIR.', 'info');
              }}
              icon={<LogOut className="w-4 h-4" />}
            >
              Logout
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="md" onClick={() => navigate('/login')}>
                Sign In
              </Button>
              <Button variant="accent" size="md" onClick={() => navigate('/register')}>
                Create Account
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] mb-8 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview' as const, label: 'Watchlist & Profile', icon: Bookmark },
          { id: 'history' as const, label: `Viewing History (${history.length})`, icon: Clock },
          { id: 'settings' as const, label: 'Account Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.14em] border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'border-[#C6A46A] text-[#F5F5F5] font-medium'
                  : 'border-transparent text-[#929292] hover:text-[#F5F5F5]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-[#C6A46A]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview & Watchlist */}
      {activeTab === 'overview' && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-white/10 bg-[#111111] p-5 space-y-1">
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#929292]">
                Saved Watchlist
              </p>
              <p className="font-serif-display text-4xl text-[#F5F5F5]">{watchlist.length}</p>
            </div>
            <div className="border border-white/10 bg-[#111111] p-5 space-y-1">
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#929292]">
                Screenings Logged
              </p>
              <p className="font-serif-display text-4xl text-[#F5F5F5]">{history.length}</p>
            </div>
            <div className="border border-white/10 bg-[#111111] p-5 space-y-1">
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#929292]">
                Catalog Indexed
              </p>
              <p className="font-serif-display text-4xl text-[#C6A46A]">{movies.length}</p>
            </div>
          </div>

          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-display text-3xl text-[#F5F5F5]">Personal Watchlist</h2>
              <Link
                to="/watchlist"
                className="font-mono-tech text-xs uppercase tracking-[0.14em] text-[#C6A46A] hover:underline"
              >
                Manage Full List →
              </Link>
            </div>

            {watchlist.length === 0 ? (
              <EmptyState
                title="No Saved Films Yet"
                description="Use the '+' button on any film poster or detail view to add titles to your personal queue."
                actionLabel="Browse Catalog"
                onAction={() => navigate('/movies')}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {watchlist.slice(0, 6).map((m) => (
                  <MovieCard key={m.id} movie={m} fluid />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab 2: Viewing History */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif-display text-3xl text-[#F5F5F5]">Viewing History</h2>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void clearHistory();
                  notify('Viewing history cleared.', 'info');
                }}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Clear History
              </Button>
            )}
          </div>

          {history.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-5 h-5" />}
              title="No Screening History Recorded"
              description="Titles you open in the NOIR Cinema Player appear here with resume timestamps."
              actionLabel="Discover Playable Classics"
              onAction={() => navigate('/movies')}
            />
          ) : (
            <div className="divide-y divide-white/[0.08] border border-white/10 bg-[#111111]">
              {history.map((entry) => {
                const pct =
                  entry.durationSeconds > 0
                    ? Math.min(100, Math.round((entry.progressSeconds / entry.durationSeconds) * 100))
                    : 0;
                return (
                  <div
                    key={entry.movie.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-16 bg-[#181818] border border-white/10 shrink-0 overflow-hidden">
                        {entry.movie.posterUrl && (
                          <img
                            src={entry.movie.posterUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Link
                          to={`/movie/${encodeURIComponent(entry.movie.id)}`}
                          className="font-serif-display text-xl text-[#F5F5F5] hover:text-[#C6A46A] truncate block"
                        >
                          {entry.movie.title}
                        </Link>
                        <p className="text-xs text-[#929292] font-mono-tech">
                          Watched {new Date(entry.watchedAt).toLocaleDateString()} · Progress{' '}
                          {formatTimecode(entry.progressSeconds)} ({pct}%)
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/watch/${encodeURIComponent(entry.movie.id)}`}
                      className="shrink-0 border border-white/15 hover:border-[#C6A46A] px-4 py-2 text-xs font-mono-tech uppercase tracking-[0.14em] text-[#F5F5F5] text-center"
                    >
                      Resume Screening
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Account Settings & API Diagnostics */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 border border-white/10 bg-[#111111] p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
              <User className="w-4 h-4 text-[#C6A46A]" />
              <h2 className="font-serif-display text-2xl text-[#F5F5F5]">Member Preferences</h2>
            </div>

            {user ? (
              <form onSubmit={(e) => void handleSaveSettings(e)} className="space-y-5">
                <TextField
                  label="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <TextField
                  label="Email Address"
                  value={user.email}
                  disabled
                  hint="Email identity is bound to your authentication record."
                />
                <TextField
                  label="Custom Avatar Image URL (Optional)"
                  placeholder="https://..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />

                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-[0.16em] text-[#929292] font-medium">
                    Preferred Language
                  </label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full bg-[#131313] border border-white/12 px-3.5 py-3 text-sm text-[#F5F5F5] focus:border-[#C6A46A] focus:outline-none"
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="es">Español</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 text-xs text-[#d4d4d4] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoplayTrailers}
                    onChange={(e) => setAutoplayTrailers(e.target.checked)}
                    className="w-4 h-4 accent-[#C6A46A]"
                  />
                  <span>Enable trailer theater previews automatically when available</span>
                </label>

                <Button type="submit" variant="accent" size="md" loading={saving}>
                  Save Account Settings
                </Button>
              </form>
            ) : (
              <div className="space-y-4 py-4">
                <p className="text-sm text-[#b4b4b4]">
                  You are currently browsing NOIR in Guest Mode. Sign in or register to customize
                  profile settings and avatar preferences.
                </p>
                <div className="flex gap-3">
                  <Button variant="accent" size="md" onClick={() => navigate('/login')}>
                    Sign In
                  </Button>
                  <Button variant="ghost" size="md" onClick={() => navigate('/register')}>
                    Create Membership
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* API & Integration Status */}
          <div className="lg:col-span-5 border border-white/10 bg-[#111111] p-6 sm:p-8 space-y-5">
            <h2 className="font-serif-display text-2xl text-[#F5F5F5] border-b border-white/[0.08] pb-3">
              Platform Integrations
            </h2>
            <p className="text-xs text-[#929292] leading-relaxed">
              Status of external metadata, rating, and authentication integrations configured in{' '}
              <code className="font-mono-tech text-[#C6A46A]">.env</code>.
            </p>

            <dl className="divide-y divide-white/[0.06] text-xs">
              <div className="py-3 flex items-center justify-between">
                <dt className="text-[#d4d4d4]">Catalog Engine</dt>
                <dd className="font-mono-tech text-[#C6A46A] inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{mode === 'tmdb-live' ? 'TMDB Live (500+)' : `Demo Archive (${movies.length})`}</span>
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between">
                <dt className="text-[#d4d4d4]">OMDb Ratings API</dt>
                <dd className="font-mono-tech text-[#929292]">
                  {omdbEnabled ? 'Connected (Live IMDb + RT)' : 'Demo IMDb Dataset'}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between">
                <dt className="text-[#d4d4d4]">Supabase Auth &amp; DB</dt>
                <dd className="font-mono-tech text-[#929292]">
                  {capabilities.supabaseConfigured ? 'Connected' : 'Local Studio Mode'}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between">
                <dt className="text-[#d4d4d4]">Google OAuth</dt>
                <dd className="font-mono-tech text-[#929292]">
                  {capabilities.oauthProviders.google ? 'Enabled' : 'Unconfigured'}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between">
                <dt className="text-[#d4d4d4]">Apple OAuth</dt>
                <dd className="font-mono-tech text-[#929292]">
                  {capabilities.oauthProviders.apple ? 'Enabled' : 'Unconfigured'}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between">
                <dt className="text-[#d4d4d4]">Reddit OAuth</dt>
                <dd className="font-mono-tech text-[#929292]">
                  {capabilities.oauthProviders.reddit ? 'Enabled' : 'Unconfigured'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </main>
  );
}
