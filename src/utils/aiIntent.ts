import type { AiMode } from '@/types/ai';

/**
 * Infers the underlying cinematic intent from natural user phrasing so NOIR AI
 * adapts seamlessly between discovery, critique, comparison, hidden gems, and
 * evening curation without forcing users to pick a UI mode.
 */
export function detectAiIntent(text: string, attachedMoviesCount = 0): AiMode {
  const normalized = text.toLowerCase().trim();
  if (!normalized) {
    return attachedMoviesCount >= 2 ? 'comparison' : 'discovery';
  }

  // 1. Comparison intent
  if (
    /\b(compar(?:e|ing|ison|er)|versus|vs\.?|difference between|which (?:one |film |movie )?is better|side[- ]by[- ]side|matchup|contraste|différence entre)\b/i.test(
      normalized
    ) ||
    (attachedMoviesCount >= 2 && /\b(both|between|these two|these films|ces films)\b/i.test(normalized))
  ) {
    return 'comparison';
  }

  // 2. Deep critical analysis intent
  if (
    /\b(analy[sz](?:e|is|er)|meaning|symbolism|metaphor|motif|cinematography breakdown|explain(?: the)?(?: ending)?|narrative structure|thematic|character study|critique|deconstruct|interpret(?:ation)?|signification|fin du film)\b/i.test(
      normalized
    )
  ) {
    return 'analysis';
  }

  // 3. Hidden gems / overlooked cinema intent
  if (
    /\b(underrated|hidden gem|overlooked|less(?:er)?[- ]?known|less popular|underseen|obscure|cult classic|deep cut|under[- ]the[- ]radar|slept on|pépite|méconnu|sous[- ]cot[ée])\b/i.test(
      normalized
    )
  ) {
    return 'hidden_gems';
  }

  // 4. Evening / Watch tonight mood & runtime intent
  if (
    /\b(tonight|this evening|right now|what should i watch|in the mood (?:for|tonight)|under \d+\s*(?:min|minutes|h|hours)|quick watch|late[- ]night|ce soir|regarder ce soir)\b/i.test(
      normalized
    )
  ) {
    return 'tonight';
  }

  return 'discovery';
}
