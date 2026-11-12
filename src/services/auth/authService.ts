import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import {
  getSupabaseClient,
  isSupabaseClientConfigured,
  supabaseConfigDiagnostic,
  supabasePublicKeyValue,
  supabaseUrlValue,
} from '@/services/supabase/supabaseClient';
import type { OAuthProvider, PlatformCapabilities, UserProfile } from '@/types/movie';

const LOCAL_USERS_KEY = 'noir_local_users_v1';
const LOCAL_SESSION_KEY = 'noir_local_session_v1';
const REDDIT_STATE_KEY = 'noir_reddit_oauth_state';

interface StoredLocalUser {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  avatarUrl: string | null;
  preferredLanguage: string;
  autoplayTrailers: boolean;
  createdAt: string;
}

async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`noir-cinema-salt:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return btoa(password);
}

function readLocalUsers(): StoredLocalUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredLocalUser[]) : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: StoredLocalUser[]) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function toLocalProfile(user: StoredLocalUser): UserProfile {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    authMode: 'local-demo',
    provider: 'email',
    preferredLanguage: user.preferredLanguage,
    autoplayTrailers: user.autoplayTrailers,
    createdAt: user.createdAt,
  };
}

export function mapSupabaseUserToProfile(
  authUser: SupabaseAuthUser,
  fallbackFullName?: string
): UserProfile {
  const meta = authUser.user_metadata ?? {};
  const providerRaw = authUser.app_metadata?.provider;
  const provider: UserProfile['provider'] =
    providerRaw === 'google' || providerRaw === 'apple' || providerRaw === 'reddit'
      ? providerRaw
      : 'email';

  const resolvedName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    fallbackFullName?.trim() ||
    authUser.email?.split('@')[0] ||
    'NOIR Member';

  const resolvedAvatar =
    (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) ||
    (typeof meta.picture === 'string' && meta.picture.trim()) ||
    null;

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    fullName: resolvedName,
    avatarUrl: resolvedAvatar,
    authMode: 'supabase',
    provider,
    preferredLanguage:
      typeof meta.preferred_language === 'string' && meta.preferred_language.trim()
        ? meta.preferred_language.trim()
        : 'en',
    autoplayTrailers: meta.autoplay_trailers !== false,
    createdAt: authUser.created_at,
  };
}

/**
 * Ensures the authenticated Supabase user has a matching row in public.profiles
 * without ever duplicating records (idempotent upsert on primary key `id`).
 */
export async function syncUserProfileRow(
  authUser: SupabaseAuthUser,
  fallbackFullName?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const profile = mapSupabaseUserToProfile(authUser, fallbackFullName);
  const { error } = await supabase.from('profiles').upsert(
    {
      id: profile.id,
      email: profile.email,
      full_name: profile.fullName,
      avatar_url: profile.avatarUrl,
      preferred_language: profile.preferredLanguage,
      autoplay_trailers: profile.autoplayTrailers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  // Gracefully ignore missing table PGRST205 before SQL schema migration is executed
  if (error && error.code !== 'PGRST205') {
    console.warn('Supabase profile sync notice:', error.message);
  }
}

function normalizeSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password. Verify your credentials or create an account.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email address is not confirmed in Supabase. Verify your email or disable "Confirm email" in Supabase Authentication → Providers → Email.';
  }
  if (lower.includes('already registered') || lower.includes('user already exists')) {
    return 'An account with this email already exists in Supabase. Please sign in or reset your password.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return message;
  }
  if (lower.includes('email rate limit')) {
    return 'Supabase email rate limit exceeded. Disable "Confirm email" in Supabase Authentication → Providers → Email or wait before retrying.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many authentication attempts. Wait a brief moment and try again.';
  }
  if (lower.includes('jwt expired') || lower.includes('invalid claim') || lower.includes('session')) {
    return 'Your authentication session has expired. Please sign in again.';
  }
  return message;
}

export function getInitialCapabilities(): PlatformCapabilities {
  return {
    tmdbConfigured: false,
    omdbConfigured: false,
    supabaseConfigured: isSupabaseClientConfigured,
    oauthProviders: {
      google: isSupabaseClientConfigured && import.meta.env.VITE_SUPABASE_GOOGLE_ENABLED === 'true',
      apple: isSupabaseClientConfigured && import.meta.env.VITE_SUPABASE_APPLE_ENABLED === 'true',
      reddit: Boolean(import.meta.env.VITE_REDDIT_CLIENT_ID?.trim()),
    },
  };
}

let inFlightCapabilities: Promise<PlatformCapabilities> | null = null;
let cachedCapabilities: { data: PlatformCapabilities; fetchedAt: number } | null = null;

export async function fetchCapabilities(): Promise<PlatformCapabilities> {
  if (cachedCapabilities && Date.now() - cachedCapabilities.fetchedAt < 60_000) {
    return cachedCapabilities.data;
  }
  if (inFlightCapabilities) {
    return inFlightCapabilities;
  }

  inFlightCapabilities = (async () => {
    try {
      const res = await fetch('/api/config/status');
      if (res.ok) {
        const data = (await res.json()) as PlatformCapabilities;
        cachedCapabilities = { data, fetchedAt: Date.now() };
        return data;
      }
    } catch {
      // Fallback to client env detection if middleware unavailable
    } finally {
      inFlightCapabilities = null;
    }

    const fallback = getInitialCapabilities();
    cachedCapabilities = { data: fallback, fetchedAt: Date.now() };
    return fallback;
  })();

  return inFlightCapabilities;
}

export async function getCurrentUser(): Promise<{
  user: UserProfile | null;
  sessionExpired?: boolean;
}> {
  const supabase = getSupabaseClient();
  if (isSupabaseClientConfigured && supabase) {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData.session) {
      return { user: null };
    }

    // Verify JWT validity with Supabase Auth so expired/revoked tokens are cleared cleanly
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      await supabase.auth.signOut({ scope: 'local' });
      return { user: null, sessionExpired: true };
    }

    return { user: mapSupabaseUserToProfile(data.user) };
  }

  // Strictly only read local studio session when Supabase is NOT configured
  if (isSupabaseClientConfigured) {
    return { user: null };
  }

  try {
    const sessionRaw =
      localStorage.getItem(LOCAL_SESSION_KEY) ?? sessionStorage.getItem(LOCAL_SESSION_KEY);
    if (!sessionRaw) return { user: null };
    const parsed = JSON.parse(sessionRaw) as { userId: string };
    const users = readLocalUsers();
    const match = users.find((u) => u.id === parsed.userId);
    return { user: match ? toLocalProfile(match) : null };
  } catch {
    return { user: null };
  }
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<UserProfile> {
  const email = params.email.trim().toLowerCase();
  const supabase = getSupabaseClient();

  if (isSupabaseClientConfigured) {
    if (!supabase) {
      throw new Error(supabaseConfigDiagnostic ?? 'Supabase client failed to initialize.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: params.password,
    });
    if (error) {
      throw new Error(normalizeSupabaseAuthError(error.message));
    }
    if (!data.user || !data.session) {
      throw new Error('Authentication succeeded without an active Supabase session.');
    }
    await syncUserProfileRow(data.user);
    return mapSupabaseUserToProfile(data.user);
  }

  // Local Demo Mode fallback ONLY when Supabase is unconfigured
  const users = readLocalUsers();
  const user = users.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    throw new Error('Demo Mode: No local account found with this email. Register first or configure Supabase in .env.');
  }
  const hash = await hashPassword(params.password);
  if (hash !== user.passwordHash) {
    throw new Error('Incorrect password. Please verify your credentials and try again.');
  }

  const sessionJson = JSON.stringify({ userId: user.id });
  if (params.rememberMe) {
    localStorage.setItem(LOCAL_SESSION_KEY, sessionJson);
    sessionStorage.removeItem(LOCAL_SESSION_KEY);
  } else {
    sessionStorage.setItem(LOCAL_SESSION_KEY, sessionJson);
    localStorage.removeItem(LOCAL_SESSION_KEY);
  }

  return toLocalProfile(user);
}

export async function registerWithEmail(params: {
  fullName: string;
  email: string;
  password: string;
}): Promise<{ user: UserProfile | null; requiresEmailConfirmation: boolean }> {
  const email = params.email.trim().toLowerCase();
  const fullName = params.fullName.trim();
  const supabase = getSupabaseClient();

  if (isSupabaseClientConfigured) {
    if (!supabase) {
      throw new Error(supabaseConfigDiagnostic ?? 'Supabase client failed to initialize.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password: params.password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) {
      throw new Error(normalizeSupabaseAuthError(error.message));
    }

    // Supabase obfuscates existing confirmed emails by returning empty identities instead of an error
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error(
        'An account with this email already exists in Supabase. Please sign in or reset your password.'
      );
    }

    const requiresConfirmation = !data.session;
    if (data.user && data.session) {
      await syncUserProfileRow(data.user, fullName);
      // Clear auto-session so the newly registered member signs in via /login with email pre-filled
      await supabase.auth.signOut({ scope: 'local' });
      return {
        requiresEmailConfirmation: false,
        user: null,
      };
    }

    return { user: null, requiresEmailConfirmation: requiresConfirmation };
  }

  // Local Demo Mode fallback ONLY when Supabase is unconfigured
  const users = readLocalUsers();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    throw new Error('An account with this email already exists.');
  }

  const newUser: StoredLocalUser = {
    id: `local-${crypto.randomUUID?.() ?? Date.now().toString(36)}`,
    email,
    fullName,
    passwordHash: await hashPassword(params.password),
    avatarUrl: null,
    preferredLanguage: 'en',
    autoplayTrailers: true,
    createdAt: new Date().toISOString(),
  };

  writeLocalUsers([...users, newUser]);
  return { user: null, requiresEmailConfirmation: false };
}

export async function requestPasswordReset(email: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const supabase = getSupabaseClient();

  if (isSupabaseClientConfigured && supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw new Error(normalizeSupabaseAuthError(error.message));
    return `Password reset instructions have been dispatched to ${cleanEmail}.`;
  }

  const users = readLocalUsers();
  const exists = users.some((u) => u.email.toLowerCase() === cleanEmail);
  if (!exists) {
    throw new Error('Demo Mode: No local account matches that email address.');
  }
  return 'Local Demo Mode is active without an SMTP server. Connect Supabase in .env for real email password recovery.';
}

async function checkRemoteSupabaseOAuthEnabled(provider: 'google' | 'apple'): Promise<boolean | null> {
  if (!supabaseUrlValue || !supabasePublicKeyValue) return null;
  try {
    const res = await fetch(`${supabaseUrlValue}/auth/v1/settings`, {
      headers: { apikey: supabasePublicKeyValue },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { external?: Record<string, boolean> };
    if (json.external && typeof json.external[provider] === 'boolean') {
      return json.external[provider];
    }
    return null;
  } catch {
    return null;
  }
}

export interface OAuthInitiationResult {
  started: boolean;
  reason?: string;
  envHint?: string;
}

export async function initiateOAuthSignIn(
  provider: OAuthProvider,
  capabilities: PlatformCapabilities
): Promise<OAuthInitiationResult> {
  if (provider === 'google' || provider === 'apple') {
    const supabase = getSupabaseClient();
    const label = provider === 'google' ? 'Google' : 'Apple';
    const envVarName =
      provider === 'google' ? 'VITE_SUPABASE_GOOGLE_ENABLED=true' : 'VITE_SUPABASE_APPLE_ENABLED=true';

    if (!isSupabaseClientConfigured || !supabase) {
      return {
        started: false,
        reason: supabaseConfigDiagnostic ?? `${label} OAuth requires Supabase configuration.`,
        envHint: `Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY), and ${envVarName} in .env, then restart Vite.`,
      };
    }

    if (!capabilities.oauthProviders[provider]) {
      return {
        started: false,
        reason: `${label} OAuth is not enabled in .env.`,
        envHint: `Enable ${label} in Supabase Dashboard -> Authentication -> Sign In / Providers -> ${label}, then set ${envVarName} in .env and restart Vite.`,
      };
    }

    // Verify provider is enabled on the Supabase project before redirecting away
    const remoteEnabled = await checkRemoteSupabaseOAuthEnabled(provider);
    if (remoteEnabled === false) {
      return {
        started: false,
        reason: `${label} provider is disabled in your Supabase Dashboard.`,
        envHint: `Open Supabase Dashboard -> Authentication -> Sign In / Providers -> ${label}, enable it with your OAuth Client ID and Client Secret, save, then retry.`,
      };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    if (error) {
      return {
        started: false,
        reason: error.message,
      };
    }
    return { started: true };
  }

  // Reddit OAuth 2.0 real authorization redirect when configured
  const redditClientId = import.meta.env.VITE_REDDIT_CLIENT_ID?.trim();
  if (!capabilities.oauthProviders.reddit || !redditClientId) {
    return {
      started: false,
      reason: 'Reddit OAuth is not configured.',
      envHint:
        'Register an app at reddit.com/prefs/apps and set VITE_REDDIT_CLIENT_ID in .env (redirect URI: http://localhost:5173/auth/callback/reddit).',
    };
  }

  const state = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(REDDIT_STATE_KEY, state);
  const authUrl = new URL('https://www.reddit.com/api/v1/authorize');
  authUrl.searchParams.set('client_id', redditClientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('redirect_uri', `${window.location.origin}/auth/callback/reddit`);
  authUrl.searchParams.set('duration', 'temporary');
  authUrl.searchParams.set('scope', 'identity');
  window.location.assign(authUrl.toString());
  return { started: true };
}

export async function updateUserProfile(
  current: UserProfile,
  updates: Partial<Pick<UserProfile, 'fullName' | 'avatarUrl' | 'preferredLanguage' | 'autoplayTrailers'>>
): Promise<UserProfile> {
  const supabase = getSupabaseClient();
  if (isSupabaseClientConfigured && supabase && current.authMode === 'supabase') {
    const { data, error } = await supabase.auth.updateUser({
      data: {
        full_name: updates.fullName ?? current.fullName,
        avatar_url: updates.avatarUrl !== undefined ? updates.avatarUrl : current.avatarUrl,
        preferred_language: updates.preferredLanguage ?? current.preferredLanguage,
        autoplay_trailers:
          updates.autoplayTrailers !== undefined
            ? updates.autoplayTrailers
            : current.autoplayTrailers,
      },
    });
    if (error) throw new Error(normalizeSupabaseAuthError(error.message));
    if (data.user) {
      const { error: dbErr } = await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          email: current.email,
          full_name: updates.fullName ?? current.fullName,
          avatar_url: updates.avatarUrl !== undefined ? updates.avatarUrl : current.avatarUrl,
          preferred_language: updates.preferredLanguage ?? current.preferredLanguage,
          autoplay_trailers:
            updates.autoplayTrailers !== undefined
              ? updates.autoplayTrailers
              : current.autoplayTrailers,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (dbErr && dbErr.code !== 'PGRST205') {
        throw new Error(dbErr.message);
      }
    }
    return { ...current, ...updates };
  }

  const users = readLocalUsers();
  const nextUsers = users.map((u) =>
    u.id === current.id
      ? {
          ...u,
          fullName: updates.fullName ?? u.fullName,
          avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : u.avatarUrl,
          preferredLanguage: updates.preferredLanguage ?? u.preferredLanguage,
          autoplayTrailers:
            updates.autoplayTrailers !== undefined ? updates.autoplayTrailers : u.autoplayTrailers,
        }
      : u
  );
  writeLocalUsers(nextUsers);
  return { ...current, ...updates };
}

export async function signOutUser(): Promise<void> {
  const supabase = getSupabaseClient();
  if (isSupabaseClientConfigured && supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem(LOCAL_SESSION_KEY);
  sessionStorage.removeItem(LOCAL_SESSION_KEY);
}
