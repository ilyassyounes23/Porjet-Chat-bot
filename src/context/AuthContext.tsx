import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchCapabilities,
  getCurrentUser,
  getInitialCapabilities,
  initiateOAuthSignIn,
  mapSupabaseUserToProfile,
  registerWithEmail,
  requestPasswordReset,
  signInWithEmail,
  signOutUser,
  syncUserProfileRow,
  updateUserProfile,
  type OAuthInitiationResult,
} from '@/services/auth/authService';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import type { OAuthProvider, PlatformCapabilities, UserProfile } from '@/types/movie';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  capabilities: PlatformCapabilities;
  login: (params: { email: string; password: string; rememberMe: boolean }) => Promise<UserProfile>;
  register: (params: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<{ user: UserProfile | null; requiresEmailConfirmation: boolean }>;
  forgotPassword: (email: string) => Promise<string>;
  loginWithOAuth: (provider: OAuthProvider) => Promise<OAuthInitiationResult>;
  updateProfile: (
    updates: Partial<
      Pick<UserProfile, 'fullName' | 'avatarUrl' | 'preferredLanguage' | 'autoplayTrailers'>
    >
  ) => Promise<UserProfile>;
  refreshUser: () => Promise<UserProfile | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { notify } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<PlatformCapabilities>(getInitialCapabilities);

  const manualSignOutRef = useRef(false);
  const activeSupabaseUserRef = useRef(false);
  const registeringRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      const currentResult = await getCurrentUser();
      if (!mounted) return;
      setUser(currentResult.user);
      activeSupabaseUserRef.current = currentResult.user?.authMode === 'supabase';
      if (currentResult.sessionExpired) {
        notify('Your previous session expired. Please sign in again.', 'info');
      }
      setLoading(false);
    }
    async function initCapabilities() {
      const caps = await fetchCapabilities();
      if (mounted) setCapabilities(caps);
    }
    void initAuth();
    void initCapabilities();

    const supabase = getSupabaseClient();
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (!mounted || registeringRef.current) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        if (activeSupabaseUserRef.current && !manualSignOutRef.current) {
          notify('Your session has ended or expired. Please sign in again.', 'info');
        }
        manualSignOutRef.current = false;
        activeSupabaseUserRef.current = false;
        setUser(null);
        setLoading(false);
        return;
      }

      const mapped = mapSupabaseUserToProfile(session.user);
      activeSupabaseUserRef.current = true;
      setUser(mapped);
      setLoading(false);

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Defer DB profile upsert outside synchronous auth state callback to avoid lock contention
        window.setTimeout(() => {
          void syncUserProfileRow(session.user);
        }, 0);
      }
    });

    return () => {
      mounted = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [notify]);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    const result = await getCurrentUser();
    setUser(result.user);
    activeSupabaseUserRef.current = result.user?.authMode === 'supabase';
    return result.user;
  }, []);

  const login = useCallback(
    async (params: { email: string; password: string; rememberMe: boolean }) => {
      const profile = await signInWithEmail(params);
      activeSupabaseUserRef.current = profile.authMode === 'supabase';
      setUser(profile);
      return profile;
    },
    []
  );

  const register = useCallback(
    async (params: { fullName: string; email: string; password: string }) => {
      registeringRef.current = true;
      try {
        const result = await registerWithEmail(params);
        activeSupabaseUserRef.current = false;
        setUser(null);
        return result;
      } finally {
        registeringRef.current = false;
      }
    },
    []
  );

  const forgotPassword = useCallback(async (email: string) => {
    return requestPasswordReset(email);
  }, []);

  const loginWithOAuth = useCallback(
    async (provider: OAuthProvider) => {
      return initiateOAuthSignIn(provider, capabilities);
    },
    [capabilities]
  );

  const updateProfile = useCallback(
    async (
      updates: Partial<
        Pick<UserProfile, 'fullName' | 'avatarUrl' | 'preferredLanguage' | 'autoplayTrailers'>
      >
    ) => {
      if (!user) throw new Error('No active user session.');
      const next = await updateUserProfile(user, updates);
      setUser(next);
      return next;
    },
    [user]
  );

  const logout = useCallback(async () => {
    manualSignOutRef.current = true;
    activeSupabaseUserRef.current = false;
    await signOutUser();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      capabilities,
      login,
      register,
      forgotPassword,
      loginWithOAuth,
      updateProfile,
      refreshUser,
      logout,
    }),
    [
      user,
      loading,
      capabilities,
      login,
      register,
      forgotPassword,
      loginWithOAuth,
      updateProfile,
      refreshUser,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
