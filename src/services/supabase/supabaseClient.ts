import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function isValidSupabaseUrl(rawUrl: string | undefined): boolean {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return false;
  if (trimmed.includes('your-project-ref')) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      Boolean(parsed.hostname) &&
      !parsed.hostname.includes('example.com')
    );
  } catch {
    return false;
  }
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const rawKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const validUrl = isValidSupabaseUrl(rawUrl);
const hasKey = Boolean(rawKey && !rawKey.includes('your-supabase'));

export const isSupabaseClientConfigured = Boolean(validUrl && hasKey);

export const supabaseUrlValue = validUrl ? rawUrl! : null;
export const supabasePublicKeyValue = hasKey ? rawKey! : null;

export const supabaseConfigDiagnostic = !rawUrl
  ? 'VITE_SUPABASE_URL is missing in .env.'
  : !validUrl
  ? 'VITE_SUPABASE_URL is not a valid Supabase project URL.'
  : !hasKey
  ? 'VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY is missing in .env.'
  : null;

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseClientConfigured || !supabaseUrlValue || !supabasePublicKeyValue) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrlValue, supabasePublicKeyValue, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return cachedClient;
}
