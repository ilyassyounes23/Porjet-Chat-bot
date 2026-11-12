import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getInternalCatalogCount,
  hydrateRecommendationPicks,
  resolveAttachedMovieContext,
  retrieveContextForAiChat,
  searchUnifiedMovies,
} from './catalogRetrieval';
import { getLlmProvider } from './providers/llmProvider';
import { LlmProviderError } from './providers/openaiProvider';
import {
  checkRateLimit,
  getClientIp,
  readJsonBody,
  sanitizeUntrustedText,
  validateAiChatBody,
  verifySupabaseBearerToken,
} from './security';
import { buildNoirAiSystemPrompt } from './systemPrompt';
import type { AiRecommendationCard, ChatTurnInput, LlmPickSuggestion } from './types';

interface CacheEntry {
  expiresAt: number;
  status: number;
  body: string;
}

const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 15;
const OPEN_TAG = '<noir_cards>';

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function writeSseEvent(res: ServerResponse, event: string, data: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function getSupabasePublicConfig(): { url: string; key: string; configured: boolean } {
  const rawSupaUrl = process.env.VITE_SUPABASE_URL?.trim() ?? '';
  const validSupaUrl =
    /^https?:\/\/[^/]+\.[^/]+/i.test(rawSupaUrl) && !rawSupaUrl.includes('your-project-ref');
  const rawSupaKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    '';
  const configured = Boolean(validSupaUrl && rawSupaKey && !rawSupaKey.includes('your-supabase'));
  return {
    url: rawSupaUrl.replace(/\/+$/, ''),
    key: rawSupaKey,
    configured,
  };
}

/**
 * Computes the safe prose byte index to stream without leaking partial `<noir_cards>` delimiters.
 */
function findSafeEmitEnd(fullRaw: string, emittedLen: number): number {
  const tailWindow = fullRaw.slice(Math.max(emittedLen, fullRaw.length - (OPEN_TAG.length - 1)));
  const ltOffset = tailWindow.lastIndexOf('<');
  if (ltOffset === -1) {
    return fullRaw.length;
  }

  const candidateSuffix = tailWindow.slice(ltOffset).toLowerCase();
  if (OPEN_TAG.startsWith(candidateSuffix)) {
    return fullRaw.length - candidateSuffix.length;
  }
  return fullRaw.length;
}

/**
 * Splits prose markdown from the trailing `<noir_cards>[...]</noir_cards>` payload cleanly.
 */
export function extractProseAndPicks(
  rawText: string,
  maxPicks = 6
): {
  prose: string;
  picks: LlmPickSuggestion[];
} {
  let prose = rawText.trim();
  let jsonBody = '';

  const match = rawText.match(/<noir_cards>([\s\S]*?)(?:<\/noir_cards>|$)/i);
  if (match && typeof match.index === 'number') {
    prose = rawText.slice(0, match.index).trim();
    jsonBody = match[1].trim();
  } else {
    // Graceful recovery if an open-weight model emits a trailing JSON pick array without wrapper tags
    const bareMatch = rawText.match(/(\[\s*\{\s*"title"\s*:[\s\S]*\])\s*$/);
    if (bareMatch && typeof bareMatch.index === 'number') {
      prose = rawText.slice(0, bareMatch.index).trim();
      jsonBody = bareMatch[1].trim();
    } else {
      return { prose, picks: [] };
    }
  }

  // Strip optional markdown code fences if a model wraps the JSON trailer inside them
  jsonBody = jsonBody.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  if (!jsonBody) {
    return { prose, picks: [] };
  }

  try {
    const parsed = JSON.parse(jsonBody) as unknown;
    if (!Array.isArray(parsed)) {
      return { prose, picks: [] };
    }
    const picks: LlmPickSuggestion[] = parsed
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        title: sanitizeUntrustedText(item.title, 160),
        year:
          typeof item.year === 'number' && Number.isFinite(item.year)
            ? item.year
            : typeof item.year === 'string' && /^\d{4}$/.test(item.year.trim())
              ? Number.parseInt(item.year.trim(), 10)
              : undefined,
        tmdbId: typeof item.tmdbId === 'number' && Number.isFinite(item.tmdbId) ? item.tmdbId : null,
        internalId:
          typeof item.internalId === 'string'
            ? sanitizeUntrustedText(item.internalId, 80) || null
            : null,
        reason: sanitizeUntrustedText(item.reason, 420) || 'Selected for thematic and tonal alignment.',
        similarityExplanation: sanitizeUntrustedText(item.similarityExplanation, 360) || undefined,
      }))
      .filter((p) => Boolean(p.title))
      .slice(0, maxPicks);

    return { prose, picks };
  } catch {
    return { prose, picks: [] };
  }
}

function sanitizeAssistantProse(prose: string, isDirect: boolean): string {
  // Strip accidental bracketed history artifacts or internal tags
  let clean = prose
    .replace(/\[Numbered recommendations from this response:[^\]]*\]/gi, '')
    .replace(/\[Attached movies in this turn:[^\]]*\]/gi, '')
    .trim();

  if (isDirect && clean) {
    // Remove cliché filler intros in Direct Recommendations mode
    const fillerOnly =
      /^(?:of course[!,.:\s]*|sure[!,.:\s]*|certainly[!,.:\s]*|bien s[uû]r[!,.:\s]*|voici[!,.:\s]*|here (?:are|is)[^.\n]{0,120}[.:!]\s*)+$/i;
    if (fillerOnly.test(clean)) {
      clean = '';
    } else {
      clean = clean
        .replace(
          /^(?:of course!?|sure[!,.]?|certainly[!,.]?|bien s[uû]r[!,.]?)\s*(?:here (?:are|is)[^\n]*[:.!]|voici[^\n]*[:.!])?\s*/i,
          ''
        )
        .replace(/^(?:here (?:are|is)[^\n]{0,90}recommendations?[^\n]*[:.!]|voici[^\n]{0,90}recommandations?[^\n]*[:.!])\s*/i, '')
        .trim();
    }
  }

  return clean;
}

function formatMessagesForLlm(
  turns: ChatTurnInput[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return turns.map((turn) => {
    if (turn.role === 'user' && turn.attachedMovies && turn.attachedMovies.length > 0) {
      const filmList = turn.attachedMovies
        .map((m) => `${m.title} (${m.releaseYear || 'N/A'})`)
        .join(', ');
      return {
        role: 'user',
        content: `${turn.content}\n\n(Context films referenced: ${filmList})`,
      };
    }
    return {
      role: turn.role,
      content: turn.content,
    };
  });
}

async function handleTmdbProxy(parsed: URL, res: ServerResponse): Promise<void> {
  const readToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();

  if (!readToken && !apiKey) {
    return sendJson(res, 503, {
      configured: false,
      error: 'TMDB API credentials are not configured on the server.',
    });
  }

  const tmdbSubPath = parsed.pathname.slice('/api/tmdb/'.length);
  const allowedPrefixes = [
    'movie/',
    'trending/movie/',
    'discover/movie',
    'search/movie',
    'genre/movie/list',
  ];
  if (!allowedPrefixes.some((prefix) => tmdbSubPath.startsWith(prefix))) {
    return sendJson(res, 400, { error: 'Unsupported TMDB endpoint.' });
  }

  const targetUrl = new URL(`https://api.themoviedb.org/3/${tmdbSubPath}`);
  parsed.searchParams.forEach((value, key) => {
    if (key !== 'api_key') {
      targetUrl.searchParams.set(key, value);
    }
  });
  if (!readToken && apiKey) {
    targetUrl.searchParams.set('api_key', apiKey);
  }

  const cacheKey = `tmdb:${targetUrl.pathname}?${parsed.searchParams.toString()}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.statusCode = cached.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Noir-Cache', 'HIT');
    res.end(cached.body);
    return;
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (readToken) {
      headers.Authorization = `Bearer ${readToken}`;
    }
    const upstream = await fetch(targetUrl.toString(), { headers });
    const body = await upstream.text();
    if (upstream.ok) {
      apiCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        status: upstream.status,
        body,
      });
    }
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(body);
  } catch (error) {
    sendJson(res, 502, {
      error: 'Failed to reach TMDB upstream service.',
      detail: error instanceof Error ? error.message : 'Unknown network error',
    });
  }
}

async function handleOmdbRatings(parsed: URL, res: ServerResponse): Promise<void> {
  const omdbKey = process.env.OMDB_API_KEY?.trim();
  if (!omdbKey) {
    return sendJson(res, 503, {
      configured: false,
      error: 'OMDB_API_KEY is not configured.',
    });
  }

  const imdbId = parsed.searchParams.get('imdbId')?.trim();
  const title = parsed.searchParams.get('title')?.trim();
  const year = parsed.searchParams.get('year')?.trim();

  if (!imdbId && !title) {
    return sendJson(res, 400, { error: 'Provide imdbId or title parameter.' });
  }

  const targetUrl = new URL('https://www.omdbapi.com/');
  targetUrl.searchParams.set('apikey', omdbKey);
  if (imdbId && /^tt\d+$/.test(imdbId)) {
    targetUrl.searchParams.set('i', imdbId);
  } else if (title) {
    targetUrl.searchParams.set('t', title);
    if (year && /^\d{4}$/.test(year)) {
      targetUrl.searchParams.set('y', year);
    }
    targetUrl.searchParams.set('type', 'movie');
  }

  const cacheKey = `omdb:${imdbId || `${title}:${year || ''}`}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.statusCode = cached.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(cached.body);
    return;
  }

  try {
    const upstream = await fetch(targetUrl.toString());
    const data = (await upstream.json()) as {
      Response?: string;
      imdbRating?: string;
      imdbVotes?: string;
      Ratings?: Array<{ Source: string; Value: string }>;
    };

    if (data.Response !== 'True') {
      return sendJson(res, 200, {
        configured: true,
        imdbRating: null,
        imdbVotes: null,
        rottenTomatoes: null,
      });
    }

    const rtEntry = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes');
    const parsedImdb =
      data.imdbRating && data.imdbRating !== 'N/A' ? Number.parseFloat(data.imdbRating) : null;
    const parsedVotes =
      data.imdbVotes && data.imdbVotes !== 'N/A'
        ? Number.parseInt(data.imdbVotes.replace(/,/g, ''), 10)
        : null;

    const payload = JSON.stringify({
      configured: true,
      imdbRating: Number.isFinite(parsedImdb) ? parsedImdb : null,
      imdbVotes: Number.isFinite(parsedVotes) ? parsedVotes : null,
      rottenTomatoes: rtEntry?.Value ?? null,
    });

    apiCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS * 4,
      status: 200,
      body: payload,
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(payload);
  } catch (error) {
    sendJson(res, 502, {
      error: 'Failed to reach OMDb ratings service.',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function handleAiStatus(res: ServerResponse): void {
  const llm = getLlmProvider();
  const enabled = llm.isEnabled();
  const configured = llm.isConfigured();

  let message: string | null = null;
  if (!enabled) {
    message = 'NOIR AI is currently disabled (AI_ENABLED=false in server environment).';
  } else if (!configured) {
    message =
      'OPENAI_API_KEY is not configured on the server. Add a valid key in .env and restart NOIR to enable live AI responses.';
  }

  sendJson(res, 200, {
    enabled,
    configured,
    provider: llm.name,
    model: llm.model,
    internalCatalogCount: getInternalCatalogCount(),
    message,
  });
}

async function handleAiMovieSearch(
  req: IncomingMessage,
  parsed: URL,
  res: ServerResponse
): Promise<void> {
  const ip = getClientIp(req);
  const limitCheck = checkRateLimit(`ai-search:${ip}`, 60, 60_000);
  if (!limitCheck.allowed) {
    res.setHeader('Retry-After', String(limitCheck.retryAfterSeconds));
    return sendJson(res, 429, {
      error: 'Too many search requests. Please wait a moment.',
      retryAfterSeconds: limitCheck.retryAfterSeconds,
    });
  }

  const query = sanitizeUntrustedText(parsed.searchParams.get('q') ?? '', 120);
  const genre = sanitizeUntrustedText(parsed.searchParams.get('genre') ?? '', 40) || undefined;
  const rawLimit = Number.parseInt(parsed.searchParams.get('limit') ?? '12', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(24, Math.max(1, rawLimit)) : 12;

  const candidates = await searchUnifiedMovies({ query, genre, limit });
  const results = candidates.map((c) => ({
    id: c.internalId ?? (c.tmdbId ? `tmdb-${c.tmdbId}` : c.title),
    tmdbId: c.tmdbId,
    imdbId: c.imdbId,
    title: c.title,
    releaseYear: c.releaseYear,
    genres: c.genres,
    description: c.description,
    director: c.director,
    actors: c.actors.slice(0, 8),
    duration: c.duration,
    language: c.language,
    country: c.country,
    posterUrl: c.posterUrl,
    ratings: c.ratings,
    availableInNoir: c.availableInNoir,
  }));

  sendJson(res, 200, { results });
}

async function handleAiMovieContext(
  req: IncomingMessage,
  parsed: URL,
  res: ServerResponse
): Promise<void> {
  let id = parsed.searchParams.get('id')?.trim();
  let tmdbIdRaw = parsed.searchParams.get('tmdbId')?.trim();
  let title = parsed.searchParams.get('title')?.trim();
  let yearRaw = parsed.searchParams.get('year')?.trim();

  if (req.method === 'POST') {
    try {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      if (typeof body.id === 'string') id = body.id;
      if (typeof body.tmdbId === 'number' || typeof body.tmdbId === 'string') {
        tmdbIdRaw = String(body.tmdbId);
      }
      if (typeof body.title === 'string') title = body.title;
      if (typeof body.year === 'number' || typeof body.year === 'string') {
        yearRaw = String(body.year);
      }
    } catch (err) {
      return sendJson(res, 400, {
        error: err instanceof Error ? err.message : 'Malformed JSON payload.',
      });
    }
  }

  const tmdbId = tmdbIdRaw && /^\d+$/.test(tmdbIdRaw) ? Number.parseInt(tmdbIdRaw, 10) : undefined;
  const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number.parseInt(yearRaw, 10) : undefined;

  if (!id && !tmdbId && !title) {
    return sendJson(res, 400, { error: 'Provide id, tmdbId, or title to resolve movie context.' });
  }

  const movie = await resolveAttachedMovieContext({
    id: id ? sanitizeUntrustedText(id, 80) : undefined,
    tmdbId,
    title: title ? sanitizeUntrustedText(title, 140) : undefined,
    year,
  });

  if (!movie) {
    return sendJson(res, 404, { error: 'Film not found in NOIR catalog or TMDB.' });
  }

  sendJson(res, 200, { movie });
}

/**
 * Authenticated RLS-enforced REST forwarder for `/api/ai/conversations`.
 * Strictly forwards the caller's own Supabase JWT — never uses or accesses `service_role`.
 */
async function handleAiConversations(
  req: IncomingMessage,
  parsed: URL,
  res: ServerResponse
): Promise<void> {
  const supa = getSupabasePublicConfig();
  if (!supa.configured) {
    return sendJson(res, 503, {
      error: 'Supabase authentication and persistence are not configured on the server.',
    });
  }

  const authHeader = req.headers.authorization;
  const verified = await verifySupabaseBearerToken(authHeader);
  if (!verified || !authHeader) {
    return sendJson(res, 401, {
      error: 'Authentication required to access saved NOIR AI conversations.',
    });
  }

  const headers: Record<string, string> = {
    apikey: supa.key,
    Authorization: authHeader,
    'Content-Type': 'application/json',
  };

  try {
    if (req.method === 'GET') {
      const convId = sanitizeUntrustedText(parsed.searchParams.get('id') ?? '', 64);
      if (convId) {
        const msgUrl = `${supa.url}/rest/v1/ai_messages?conversation_id=eq.${encodeURIComponent(convId)}&order=created_at.asc`;
        const upstream = await fetch(msgUrl, { headers });
        const body = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(body);
        return;
      }

      const convUrl = `${supa.url}/rest/v1/ai_conversations?order=updated_at.desc&limit=50`;
      const upstream = await fetch(convUrl, { headers });
      const body = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(body);
      return;
    }

    if (req.method === 'DELETE') {
      const convId = sanitizeUntrustedText(parsed.searchParams.get('id') ?? '', 64);
      const target = convId
        ? `${supa.url}/rest/v1/ai_conversations?id=eq.${encodeURIComponent(convId)}`
        : `${supa.url}/rest/v1/ai_conversations?user_id=eq.${encodeURIComponent(verified.userId)}`;
      const upstream = await fetch(target, { method: 'DELETE', headers });
      if (!upstream.ok) {
        return sendJson(res, upstream.status, { error: 'Unable to delete conversations.' });
      }
      return sendJson(res, 200, { deleted: true });
    }

    sendJson(res, 405, { error: 'Method not allowed on /api/ai/conversations.' });
  } catch {
    sendJson(res, 502, { error: 'Unable to reach Supabase persistence service.' });
  }
}

async function handleAiChat(
  req: IncomingMessage,
  res: ServerResponse,
  forceJsonResponse = false
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'POST method required for /api/ai/chat.' });
  }

  let validated;
  try {
    const rawBody = await readJsonBody(req);
    validated = validateAiChatBody(rawBody);
  } catch (err) {
    return sendJson(res, 400, {
      error: err instanceof Error ? err.message : 'Invalid request payload.',
    });
  }

  const auth = await verifySupabaseBearerToken(req.headers.authorization);
  const rateKey = auth ? `user:${auth.userId}` : `ip:${getClientIp(req)}`;
  const rate = checkRateLimit(`ai-chat:${rateKey}`, 20, 60_000);
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));

  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return sendJson(res, 429, {
      error: `Rate limit reached. Please wait ${rate.retryAfterSeconds}s before sending another request.`,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  const llm = getLlmProvider();
  if (!llm.isEnabled()) {
    return sendJson(res, 503, {
      configured: false,
      error: 'NOIR AI is currently disabled (AI_ENABLED=false).',
    });
  }
  if (!llm.isConfigured()) {
    return sendJson(res, 503, {
      configured: false,
      error:
        'OPENAI_API_KEY is not configured on the server. Add your OpenAI API key in .env and restart NOIR.',
    });
  }

  const abortController = new AbortController();
  const handleClose = () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  };
  req.on('close', handleClose);
  res.on('close', handleClose);

  const shouldStream = !forceJsonResponse && validated.stream !== false;
  const isDirect = validated.interactionMode === 'direct';
  const maxPicks = isDirect ? 10 : 6;
  const latestQuery = validated.messages[validated.messages.length - 1]?.content ?? '';
  const recentUserQueries = validated.messages
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => m.content);
  const latestAssistantWithRecs = [...validated.messages]
    .reverse()
    .find((m) => m.role === 'assistant' && m.recommendationTitles && m.recommendationTitles.length > 0);
  const priorRecommendations =
    latestAssistantWithRecs?.recommendationTitles ?? validated.cinemaProfile?.discussedTitles ?? [];
  const discussedTitles = [
    ...(validated.cinemaProfile?.discussedTitles ?? []),
    ...validated.messages.flatMap((m) => m.recommendationTitles ?? []),
  ];

  if (shouldStream) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    writeSseEvent(res, 'status', {
      stage: 'retrieving',
      label: isDirect
        ? 'Searching catalog & TMDB for matches...'
        : 'Cross-referencing NOIR Archive & TMDB registry...',
    });
  }

  try {
    const candidates = await retrieveContextForAiChat({
      latestQuery,
      recentUserQueries,
      priorRecommendations,
      mode: validated.mode,
      interactionMode: validated.interactionMode,
      attachedMovies: validated.attachedMovies,
      cinemaProfile: validated.cinemaProfile,
      discussedTitles,
    });

    if (abortController.signal.aborted) {
      if (shouldStream && !res.writableEnded) res.end();
      return;
    }

    const systemPrompt = buildNoirAiSystemPrompt({
      mode: validated.mode,
      interactionMode: validated.interactionMode,
      attachedMovies: validated.attachedMovies,
      candidates,
      cinemaProfile: validated.cinemaProfile,
      allowSpoilers: validated.allowSpoilers,
      priorRecommendations,
    });

    const llmMessages = formatMessagesForLlm(validated.messages);

    if (shouldStream) {
      writeSseEvent(res, 'status', {
        stage: 'thinking',
        label: isDirect
          ? 'Selecting films & preparing cards...'
          : 'Composing editorial critique & curation...',
        candidateCount: candidates.length,
        provider: llm.name,
        model: llm.model,
      });
    }

    let fullRaw = '';
    let emittedLen = 0;
    let cardTagStarted = false;

    for await (const token of llm.streamChat({
      systemPrompt,
      messages: llmMessages,
      temperature: isDirect ? 0.35 : 0.65,
      maxTokens: isDirect ? 520 : undefined,
      signal: abortController.signal,
    })) {
      if (abortController.signal.aborted) break;
      fullRaw += token;

      if (!shouldStream || cardTagStarted) {
        continue;
      }

      const tagMatch = fullRaw.match(/<noir_cards>/i);
      if (tagMatch && typeof tagMatch.index === 'number') {
        if (!isDirect && tagMatch.index > emittedLen) {
          const proseSlice = fullRaw.slice(emittedLen, tagMatch.index);
          writeSseEvent(res, 'delta', { text: proseSlice });
          emittedLen = tagMatch.index;
        }
        cardTagStarted = true;
        writeSseEvent(res, 'status', {
          stage: 'verifying',
          label: 'Verifying ratings & NOIR catalog availability...',
        });
      } else if (!isDirect) {
        const safeEnd = findSafeEmitEnd(fullRaw, emittedLen);
        if (safeEnd > emittedLen) {
          writeSseEvent(res, 'delta', { text: fullRaw.slice(emittedLen, safeEnd) });
          emittedLen = safeEnd;
        }
      }
    }

    if (abortController.signal.aborted) {
      if (shouldStream && !res.writableEnded) res.end();
      return;
    }

    const { prose, picks } = extractProseAndPicks(fullRaw, maxPicks);
    const cleanProse = sanitizeAssistantProse(prose, isDirect);

    if (shouldStream && isDirect && cleanProse) {
      writeSseEvent(res, 'delta', { text: cleanProse });
    } else if (shouldStream && !isDirect && !cardTagStarted && emittedLen < cleanProse.length) {
      writeSseEvent(res, 'delta', { text: cleanProse.slice(emittedLen) });
    }

    let cards: AiRecommendationCard[] = [];
    if (picks.length > 0) {
      cards = await hydrateRecommendationPicks(picks, maxPicks);
    }

    if (shouldStream) {
      if (cards.length > 0) {
        writeSseEvent(res, 'recommendations', { cards });
      }
      writeSseEvent(res, 'done', {
        text: cleanProse,
        cards,
        model: llm.model,
        provider: llm.name,
        candidateCount: candidates.length,
      });
      res.end();
      return;
    }

    sendJson(res, 200, {
      text: cleanProse,
      cards,
      model: llm.model,
      provider: llm.name,
      candidateCount: candidates.length,
    });
  } catch (err) {
    const statusCode = err instanceof LlmProviderError ? err.statusCode : 502;
    const message =
      err instanceof Error ? err.message : 'Unable to generate NOIR AI response right now.';
    if (shouldStream) {
      writeSseEvent(res, 'error', { message, statusCode });
      if (!res.writableEnded) res.end();
      return;
    }
    sendJson(res, statusCode, { error: message });
  } finally {
    req.off('close', handleClose);
    res.off('close', handleClose);
  }
}

export async function handleNoirApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const urlStr = req.url ?? '/';
  if (!urlStr.startsWith('/api/')) {
    return false;
  }

  const parsed = new URL(urlStr, 'http://localhost:5173');
  const pathname = parsed.pathname;

  if (pathname === '/api/health') {
    sendJson(res, 200, { status: 'ok', app: 'NOIR', timestamp: Date.now() });
    return true;
  }

  if (pathname === '/api/config/status') {
    const tmdbConfigured = Boolean(
      process.env.TMDB_READ_ACCESS_TOKEN?.trim() || process.env.TMDB_API_KEY?.trim()
    );
    const omdbConfigured = Boolean(process.env.OMDB_API_KEY?.trim());
    const supa = getSupabasePublicConfig();
    const llm = getLlmProvider();

    sendJson(res, 200, {
      tmdbConfigured,
      omdbConfigured,
      supabaseConfigured: supa.configured,
      aiEnabled: llm.isEnabled(),
      aiConfigured: llm.isConfigured(),
      aiProvider: llm.name,
      aiModel: llm.model,
      internalCatalogCount: getInternalCatalogCount(),
      oauthProviders: {
        google: supa.configured && process.env.VITE_SUPABASE_GOOGLE_ENABLED === 'true',
        apple: supa.configured && process.env.VITE_SUPABASE_APPLE_ENABLED === 'true',
        reddit: Boolean(process.env.VITE_REDDIT_CLIENT_ID?.trim()),
      },
    });
    return true;
  }

  if (pathname.startsWith('/api/tmdb/')) {
    await handleTmdbProxy(parsed, res);
    return true;
  }

  if (pathname === '/api/ratings') {
    await handleOmdbRatings(parsed, res);
    return true;
  }

  if (pathname === '/api/ai/status') {
    handleAiStatus(res);
    return true;
  }

  if (pathname === '/api/ai/movies/search') {
    await handleAiMovieSearch(req, parsed, res);
    return true;
  }

  if (pathname === '/api/ai/movie-context') {
    await handleAiMovieContext(req, parsed, res);
    return true;
  }

  if (pathname === '/api/ai/conversations') {
    await handleAiConversations(req, parsed, res);
    return true;
  }

  if (pathname === '/api/ai/chat') {
    await handleAiChat(req, res, false);
    return true;
  }

  if (pathname === '/api/ai/recommend') {
    await handleAiChat(req, res, true);
    return true;
  }

  sendJson(res, 404, { error: 'Unknown API route.' });
  return true;
}
