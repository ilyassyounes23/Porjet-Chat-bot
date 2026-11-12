import type { LlmCompletionParams, LlmProvider } from '../types';

export class LlmProviderError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function inferProviderName(baseUrl: string): string {
  const lower = baseUrl.toLowerCase();
  if (lower.includes('groq.com')) return 'Groq';
  if (lower.includes('openrouter.ai')) return 'OpenRouter';
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return 'Ollama (Local)';
  if (lower.includes('together.xyz')) return 'Together AI';
  if (lower.includes('openai.com')) return 'OpenAI';
  return 'OpenAI-Compatible';
}

function parseShortRetryDelayMs(message: string, retryAfterHeader: string | null): number | null {
  const msMatch = message.match(/try again in\s+(\d+(?:\.\d+)?)\s*ms/i);
  if (msMatch) {
    const ms = Math.ceil(Number.parseFloat(msMatch[1])) + 150;
    return ms > 0 && ms <= 4500 ? ms : null;
  }
  const secMatch = message.match(/try again in\s+(\d+(?:\.\d+)?)\s*s\b/i);
  if (secMatch) {
    const ms = Math.ceil(Number.parseFloat(secMatch[1]) * 1000) + 150;
    return ms > 0 && ms <= 4500 ? ms : null;
  }
  if (retryAfterHeader) {
    const sec = Number.parseFloat(retryAfterHeader);
    if (Number.isFinite(sec) && sec > 0 && sec <= 4) {
      return Math.ceil(sec * 1000) + 150;
    }
  }
  return null;
}

function waitWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class OpenAiProvider implements LlmProvider {
  readonly name: string;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly enabled: boolean;
  private readonly isLocalEndpoint: boolean;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    this.model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
    this.baseUrl = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(
      /\/+$/,
      ''
    );
    this.enabled = process.env.AI_ENABLED?.trim().toLowerCase() !== 'false';
    this.name = inferProviderName(this.baseUrl);
    this.isLocalEndpoint =
      this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isConfigured(): boolean {
    if (!this.enabled) return false;
    if (this.isLocalEndpoint) return true;
    return (
      Boolean(this.apiKey) &&
      !this.apiKey.includes('your-openai') &&
      this.apiKey.length >= 16
    );
  }

  async *streamChat(params: LlmCompletionParams): AsyncIterable<string> {
    if (!this.enabled) {
      throw new LlmProviderError(503, 'NOIR AI is currently disabled via AI_ENABLED=false.');
    }
    if (!this.isConfigured()) {
      throw new LlmProviderError(
        503,
        'AI API key is not configured on the server. Add OPENAI_API_KEY (or Groq/OpenRouter free key) in .env and restart NOIR.'
      );
    }

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 60_000);
    const onParentAbort = () => timeoutController.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey || 'ollama'}`,
    };
    if (this.name === 'OpenRouter') {
      headers['HTTP-Referer'] = 'http://localhost:5173';
      headers['X-Title'] = 'NOIR Cinema AI';
    }

    const requestBody = JSON.stringify({
      model: this.model,
      stream: true,
      temperature: params.temperature ?? 0.65,
      max_tokens: params.maxTokens ?? (this.name === 'Groq' ? 780 : 1200),
      messages: [
        { role: 'system', content: params.systemPrompt },
        ...params.messages,
      ],
    });

    let response!: Response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: requestBody,
          signal: timeoutController.signal,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        params.signal?.removeEventListener('abort', onParentAbort);
        if (params.signal?.aborted) {
          return;
        }
        throw new LlmProviderError(
          502,
          err instanceof Error && err.name === 'AbortError'
            ? `${this.name} request timed out. Please try again.`
            : `Unable to reach ${this.name} service. Check your network connection or base URL and retry.`
        );
      }

      if (response.ok && response.body) {
        break;
      }

      let apiMsg = '';
      try {
        const errJson = (await response.json()) as { error?: { message?: string; code?: string } };
        apiMsg = errJson.error?.message ?? '';
      } catch {
        // Ignore parse errors
      }

      if (response.status === 429 && attempt === 0) {
        const shortDelay = parseShortRetryDelayMs(apiMsg, response.headers.get('retry-after'));
        if (shortDelay && !timeoutController.signal.aborted) {
          await waitWithSignal(shortDelay, timeoutController.signal);
          if (params.signal?.aborted) {
            clearTimeout(timeoutId);
            params.signal?.removeEventListener('abort', onParentAbort);
            return;
          }
          continue;
        }
      }

      clearTimeout(timeoutId);
      params.signal?.removeEventListener('abort', onParentAbort);

      if (response.status === 401 || response.status === 403) {
        throw new LlmProviderError(
          401,
          `Invalid or unauthorized ${this.name} API key. Check OPENAI_API_KEY in .env and restart NOIR.`
        );
      }
      if (response.status === 429) {
        throw new LlmProviderError(
          429,
          apiMsg || `${this.name} rate limit or quota exceeded. Wait briefly before trying again.`
        );
      }
      throw new LlmProviderError(
        response.status >= 500 ? 502 : response.status,
        apiMsg || `${this.name} returned status ${response.status}.`
      );
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      params.signal?.removeEventListener('abort', onParentAbort);
      throw new LlmProviderError(502, `${this.name} returned an empty response body.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              yield token;
            }
          } catch {
            // Skip partial or keep-alive frames cleanly
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      params.signal?.removeEventListener('abort', onParentAbort);
      try {
        await reader.cancel();
      } catch {
        // Ignore stream cancel errors
      }
    }
  }
}
