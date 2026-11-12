import type { LlmProvider } from '../types';
import { OpenAiProvider } from './openaiProvider';

export function getLlmProvider(): LlmProvider {
  // Currently OpenAI is default; new providers (e.g. Anthropic, Gemini) plug in cleanly here
  const providerName = (process.env.AI_PROVIDER?.trim() || 'openai').toLowerCase();
  switch (providerName) {
    case 'openai':
    default:
      return new OpenAiProvider();
  }
}
