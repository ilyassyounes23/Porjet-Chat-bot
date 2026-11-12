import type { IncomingMessage } from 'node:http';
import type {
  AiChatRequestBody,
  AiInteractionMode,
  AiMode,
  AttachedMovieContext,
  ChatTurnInput,
  CinemaProfileContext,
} from './types';

const VALID_MODES = new Set<AiMode>([
  'discovery',
  'analysis',
  'comparison',
  'hidden_gems',
  'tonight',
]);

const VALID_INTERACTION_MODES = new Set<AiInteractionMode>(['conversational', 'direct']);

interface RateBucket {
  timestamps: number[];
}

const rateBuckets = new Map<string, RateBucket>();

interface VerifiedAuthEntry {
  userId: string;
  expiresAt: number;
}

const verifiedTokenCache = new Map<string, VerifiedAuthEntry>();

export function getClientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    rateBuckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds, remaining: 0 };
  }

  bucket.timestamps.push(now);
  rateBuckets.set(key, bucket);

  // Prune stale buckets periodically to keep memory bounded
  if (rateBuckets.size > 2000) {
    for (const [k, b] of rateBuckets.entries()) {
      if (b.timestamps.every((ts) => now - ts >= windowMs)) {
        rateBuckets.delete(k);
      }
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxRequests - bucket.timestamps.length),
  };
}

export async function readJsonBody(req: IncomingMessage, maxBytes = 256 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new Error('Request payload exceeds maximum allowed size.'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        if (!raw) {
          resolve({});
          return;
        }
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Malformed JSON request body.'));
      }
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Strips delimiter markers or prompt-injection sequences from untrusted text/metadata.
 */
export function sanitizeUntrustedText(input: unknown, maxLen = 1200): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<\/?noir_cards>/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizeAttachedMovie(raw: unknown): AttachedMovieContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const title = sanitizeUntrustedText(obj.title, 180);
  const id = sanitizeUntrustedText(obj.id, 80);
  if (!title || !id) return null;

  const ratingsRaw = (obj.ratings && typeof obj.ratings === 'object'
    ? obj.ratings
    : {}) as Record<string, unknown>;

  return {
    id,
    tmdbId: typeof obj.tmdbId === 'number' && Number.isFinite(obj.tmdbId) ? obj.tmdbId : null,
    imdbId: typeof obj.imdbId === 'string' ? sanitizeUntrustedText(obj.imdbId, 32) : null,
    title,
    releaseYear:
      typeof obj.releaseYear === 'number' && Number.isFinite(obj.releaseYear)
        ? obj.releaseYear
        : 0,
    genres: Array.isArray(obj.genres)
      ? obj.genres.map((g) => sanitizeUntrustedText(g, 40)).filter(Boolean).slice(0, 6)
      : [],
    description: sanitizeUntrustedText(obj.description, 800),
    director: typeof obj.director === 'string' ? sanitizeUntrustedText(obj.director, 120) : null,
    actors: Array.isArray(obj.actors)
      ? obj.actors.map((a) => sanitizeUntrustedText(a, 80)).filter(Boolean).slice(0, 8)
      : [],
    duration: typeof obj.duration === 'number' && Number.isFinite(obj.duration) ? obj.duration : null,
    language: typeof obj.language === 'string' ? sanitizeUntrustedText(obj.language, 40) : undefined,
    country: typeof obj.country === 'string' ? sanitizeUntrustedText(obj.country, 60) : undefined,
    posterUrl: typeof obj.posterUrl === 'string' ? sanitizeUntrustedText(obj.posterUrl, 300) : null,
    ratings: {
      imdb: typeof ratingsRaw.imdb === 'number' && Number.isFinite(ratingsRaw.imdb) ? ratingsRaw.imdb : null,
      imdbVotes:
        typeof ratingsRaw.imdbVotes === 'number' && Number.isFinite(ratingsRaw.imdbVotes)
          ? ratingsRaw.imdbVotes
          : null,
      rottenTomatoes:
        typeof ratingsRaw.rottenTomatoes === 'string'
          ? sanitizeUntrustedText(ratingsRaw.rottenTomatoes, 20)
          : null,
      tmdbScore:
        typeof ratingsRaw.tmdbScore === 'number' && Number.isFinite(ratingsRaw.tmdbScore)
          ? ratingsRaw.tmdbScore
          : null,
      source:
        ratingsRaw.source === 'imdb-dataset' ||
        ratingsRaw.source === 'omdb' ||
        ratingsRaw.source === 'wikidata'
          ? ratingsRaw.source
          : 'unavailable',
    },
    availableInNoir: Boolean(obj.availableInNoir),
  };
}

function sanitizeCinemaProfile(raw: unknown): CinemaProfileContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  // Never accept PII fields (email, phone, account tokens) in LLM cinema profile
  return {
    authenticated: Boolean(obj.authenticated),
    watchlistTitles: Array.isArray(obj.watchlistTitles)
      ? obj.watchlistTitles.map((t) => sanitizeUntrustedText(t, 100)).filter(Boolean).slice(0, 20)
      : [],
    recentlyWatched: Array.isArray(obj.recentlyWatched)
      ? obj.recentlyWatched
          .slice(0, 12)
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const r = item as Record<string, unknown>;
            const title = sanitizeUntrustedText(r.title, 100);
            if (!title) return null;
            return {
              title,
              year: typeof r.year === 'number' ? r.year : 0,
              genres: Array.isArray(r.genres)
                ? r.genres.map((g) => sanitizeUntrustedText(g, 32)).filter(Boolean).slice(0, 4)
                : [],
            };
          })
          .filter((x): x is { title: string; year: number; genres: string[] } => Boolean(x))
      : [],
    favoriteGenres: Array.isArray(obj.favoriteGenres)
      ? obj.favoriteGenres.map((g) => sanitizeUntrustedText(g, 40)).filter(Boolean).slice(0, 8)
      : [],
    discussedTitles: Array.isArray(obj.discussedTitles)
      ? obj.discussedTitles.map((t) => sanitizeUntrustedText(t, 100)).filter(Boolean).slice(0, 15)
      : [],
  };
}

export function validateAiChatBody(raw: unknown): AiChatRequestBody {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid chat payload.');
  }
  const body = raw as Record<string, unknown>;
  const mode: AiMode =
    typeof body.mode === 'string' && VALID_MODES.has(body.mode as AiMode)
      ? (body.mode as AiMode)
      : 'discovery';
  const interactionMode: AiInteractionMode =
    typeof body.interactionMode === 'string' &&
    VALID_INTERACTION_MODES.has(body.interactionMode as AiInteractionMode)
      ? (body.interactionMode as AiInteractionMode)
      : 'conversational';

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new Error('At least one conversation message is required.');
  }

  // Enforce bounded conversation context window for cost and token control
  const messages: ChatTurnInput[] = body.messages
    .slice(-14)
    .map((m): ChatTurnInput | null => {
      if (!m || typeof m !== 'object') return null;
      const item = m as Record<string, unknown>;
      const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
      if (!role) return null;
      const content = sanitizeUntrustedText(item.content, 2400);
      if (!content) return null;
      const attachedMovies = Array.isArray(item.attachedMovies)
        ? item.attachedMovies
            .map(sanitizeAttachedMovie)
            .filter((x): x is AttachedMovieContext => Boolean(x))
            .slice(0, 5)
        : undefined;
      const recommendationTitles = Array.isArray(item.recommendationTitles)
        ? item.recommendationTitles
            .map((t) => sanitizeUntrustedText(t, 120))
            .filter(Boolean)
            .slice(0, 12)
        : undefined;
      return { role, content, attachedMovies, recommendationTitles };
    })
    .filter((m): m is ChatTurnInput => Boolean(m));

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    throw new Error('The latest message must be a non-empty user inquiry.');
  }

  const attachedMovies = Array.isArray(body.attachedMovies)
    ? body.attachedMovies
        .map(sanitizeAttachedMovie)
        .filter((x): x is AttachedMovieContext => Boolean(x))
        .slice(0, 5)
    : [];

  return {
    conversationId:
      typeof body.conversationId === 'string'
        ? sanitizeUntrustedText(body.conversationId, 80)
        : undefined,
    mode,
    interactionMode,
    messages,
    attachedMovies,
    cinemaProfile: sanitizeCinemaProfile(body.cinemaProfile),
    allowSpoilers: Boolean(body.allowSpoilers),
    stream: body.stream !== false,
  };
}

/**
 * Verifies an incoming Supabase Bearer JWT server-side without ever using or exposing service_role.
 */
export async function verifySupabaseBearerToken(
  authHeader: string | undefined
): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.length < 20) return null;

  const cached = verifiedTokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return { userId: cached.userId };
  }

  const supaUrl = process.env.VITE_SUPABASE_URL?.trim();
  const supaKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supaUrl || !supaKey) return null;

  try {
    const res = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    if (!data?.id) return null;

    verifiedTokenCache.set(token, {
      userId: data.id,
      expiresAt: Date.now() + 60_000,
    });
    if (verifiedTokenCache.size > 500) {
      verifiedTokenCache.clear();
    }
    return { userId: data.id };
  } catch {
    return null;
  }
}
