import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { AuthLayout } from '@/components/forms/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { syncUserProfileRow } from '@/services/auth/authService';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';

// Deduplicate PKCE authorization code exchange across React StrictMode double-mounts
const inFlightCodeExchange = new Map<string, Promise<Session | null>>();

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { notify } = useToast();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Completing Supabase authentication...');

  useEffect(() => {
    let cancelled = false;

    async function finalizeAuthCallback() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const errorParam = searchParams.get('error') ?? hashParams.get('error');
      const errorDesc =
        searchParams.get('error_description') ?? hashParams.get('error_description');

      if (errorParam || errorDesc) {
        if (!cancelled) {
          setErrorMessage(
            errorDesc ||
              `Authentication provider returned an error (${errorParam}). Please try again.`
          );
        }
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) {
          setErrorMessage(
            'Supabase client is not configured. Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.'
          );
        }
        return;
      }

      try {
        // First wait for Supabase auto URL detection / PKCE lock if triggered on client creation
        let {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        // If PKCE code wasn't consumed automatically yet, exchange it cleanly (deduplicated)
        const code = searchParams.get('code');
        if (!session && code) {
          if (!cancelled) {
            setStatusText('Exchanging authorization code for session...');
          }
          let exchangePromise = inFlightCodeExchange.get(code);
          if (!exchangePromise) {
            exchangePromise = supabase.auth
              .exchangeCodeForSession(code)
              .then(({ data, error }) => {
                if (error) throw new Error(error.message);
                return data.session;
              });
            inFlightCodeExchange.set(code, exchangePromise);
          }
          session = await exchangePromise;
        }

        if (!session?.user) {
          throw new Error(
            'No authenticated Supabase session was established from this callback link. The link may have expired or already been consumed.'
          );
        }

        if (cancelled) return;
        setStatusText('Synchronizing member dossier...');
        await syncUserProfileRow(session.user);
        const profile = await refreshUser();

        if (cancelled) return;
        notify(
          `Welcome to NOIR${profile?.fullName ? `, ${profile.fullName}` : ''}.`,
          'success'
        );
        navigate('/', { replace: true });
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Unable to complete OAuth authentication.'
          );
        }
      }
    }

    void finalizeAuthCallback();

    return () => {
      cancelled = true;
    };
  }, [navigate, notify, refreshUser, searchParams]);

  return (
    <AuthLayout
      eyebrow="Authentication Handshake"
      title={errorMessage ? 'Verification Failed' : 'Entering NOIR'}
      subtitle={
        errorMessage
          ? 'We could not establish an authenticated Supabase session.'
          : 'Establishing your encrypted screening room session...'
      }
    >
      <div className="border border-white/15 bg-[#111111] p-6 space-y-5">
        {errorMessage ? (
          <>
            <div className="flex items-start gap-3 text-xs text-red-300 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <p>{errorMessage}</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link to="/login">
                <Button variant="accent" size="sm">
                  Return to Sign In
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" size="sm">
                  Browse Catalog
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 text-xs text-[#d4d4d4]">
            {statusText.includes('Synchronizing') ? (
              <CheckCircle2 className="w-4 h-4 text-[#C6A46A] shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-[#C6A46A] animate-spin shrink-0" />
            )}
            <span className="font-mono-tech uppercase tracking-[0.14em]">{statusText}</span>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
