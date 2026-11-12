import { Link } from 'react-router-dom';
import { NoirWordmark } from '@/components/forms/AuthLayout';
import { useCatalog } from '@/context/CatalogContext';
import { useAuth } from '@/context/AuthContext';

export function Footer() {
  const { movies, mode, omdbEnabled } = useCatalog();
  const { capabilities } = useAuth();

  return (
    <footer className="bg-[#090909] border-t border-white/[0.08] mt-16">
      <div className="max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-14 py-14 grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-5 space-y-4">
          <NoirWordmark />
          <p className="text-xs text-[#929292] leading-relaxed max-w-sm">
            An editorial cinema streaming platform built with architectural restraint. Metadata
            and ratings are sourced strictly from legitimate film registries without fabricated
            scores.
          </p>
          <div className="flex flex-wrap gap-2 pt-1 font-mono-tech text-[10px] uppercase tracking-[0.14em]">
            <span className="border border-white/12 px-2.5 py-1 text-[#C6A46A]">
              {movies.length} Films Indexed
            </span>
            <span className="border border-white/12 px-2.5 py-1 text-[#929292]">
              Source: {mode === 'tmdb-live' ? 'TMDB Live API' : 'Curated Archive Mode'}
            </span>
            <span className="border border-white/12 px-2.5 py-1 text-[#929292]">
              Ratings: {omdbEnabled ? 'OMDb Live' : 'IMDb Dataset'}
            </span>
            <span className="border border-white/12 px-2.5 py-1 text-[#929292]">
              Auth: {capabilities.supabaseConfigured ? 'Supabase' : 'Local Studio'}
            </span>
          </div>
        </div>

        <div className="md:col-span-3 space-y-3">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#C6A46A]">
            Navigation
          </p>
          <ul className="space-y-2 text-xs text-[#929292]">
            <li><Link to="/" className="hover:text-[#F5F5F5] transition-colors">Home Showcase</Link></li>
            <li><Link to="/movies" className="hover:text-[#F5F5F5] transition-colors">Browse Full Catalog</Link></li>
            <li><Link to="/genres" className="hover:text-[#F5F5F5] transition-colors">Genres &amp; Movements</Link></li>
            <li><Link to="/trending" className="hover:text-[#F5F5F5] transition-colors">Trending Now</Link></li>
            <li><Link to="/cinema-ai" className="hover:text-[#F5F5F5] transition-colors text-[#C6A46A]">NOIR AI Studio</Link></li>
            <li><Link to="/watchlist" className="hover:text-[#F5F5F5] transition-colors">My Watchlist</Link></li>
          </ul>
        </div>

        <div className="md:col-span-4 space-y-3">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#C6A46A]">
            Account &amp; Licensing
          </p>
          <ul className="space-y-2 text-xs text-[#929292]">
            <li><Link to="/profile" className="hover:text-[#F5F5F5] transition-colors">Profile &amp; Viewing History</Link></li>
            <li><Link to="/profile?tab=settings" className="hover:text-[#F5F5F5] transition-colors">API &amp; Playback Settings</Link></li>
            <li><Link to="/login" className="hover:text-[#F5F5F5] transition-colors">Member Sign In</Link></li>
            <li><Link to="/register" className="hover:text-[#F5F5F5] transition-colors">Create Membership</Link></li>
          </ul>
          <p className="pt-2 text-[11px] text-[#606060] leading-relaxed">
            Full-feature playback is exclusively enabled for public-domain works (Internet Archive)
            and Creative Commons open films (Blender Foundation).
          </p>
        </div>
      </div>

      <div className="border-t border-white/[0.06] py-5 px-5 sm:px-8 lg:px-14 max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono-tech text-[#606060]">
        <span>NOIR STREAMING PLATFORM</span>
        <span>DATA COURTESY OF TMDB / WIKIDATA / IMDb PUBLIC DATASETS</span>
      </div>
    </footer>
  );
}
