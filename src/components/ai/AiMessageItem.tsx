import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Copy,
  Film,
  RotateCcw,
} from 'lucide-react';
import type { AiMessage } from '@/types/ai';
import { AiRecommendationCard } from '@/components/ai/AiRecommendationCard';

interface AiMessageItemProps {
  message: AiMessage;
  thinkingStatus: string | null;
  streamingDisabled: boolean;
  onRetry: (assistantMessageId: string) => void;
}

function cleanDisplayContent(raw: string): string {
  return raw
    .replace(/\[Numbered recommendations from this response:[^\]]*\]/gi, '')
    .replace(/\[Attached movies in this turn:[^\]]*\]/gi, '')
    .trim();
}

function renderInlineMarkdown(line: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(line.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${idx}`} className="font-semibold text-[#F5F5F5]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={`${keyPrefix}-i-${idx}`} className="italic text-[#D8C296] pr-[0.14em]">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="bg-[#181818] border border-white/10 px-1.5 py-0.5 font-mono-tech text-[11px] text-[#E3C690]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIdx = match.index + token.length;
    idx += 1;
  }

  if (lastIdx < line.length) {
    nodes.push(line.slice(lastIdx));
  }

  return nodes;
}

function MarkdownProse({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: { ordered: boolean; items: string[] } | null = null;
  let blockIdx = 0;

  const flushList = () => {
    if (!listItems) return;
    const current = listItems;
    listItems = null;
    if (current.ordered) {
      blocks.push(
        <ol
          key={`ol-${blockIdx++}`}
          className="list-decimal list-outside ml-5 space-y-1.5 text-[14.5px] sm:text-[15px] text-[#DCDCDC] leading-7"
        >
          {current.items.map((item, i) => (
            <li key={i} className="pl-1">
              {renderInlineMarkdown(item, `ol-${blockIdx}-${i}`)}
            </li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul
          key={`ul-${blockIdx++}`}
          className="space-y-1.5 text-[14.5px] sm:text-[15px] text-[#DCDCDC] leading-7"
        >
          {current.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="text-[#C6A46A] mt-[10px] w-1.5 h-1.5 bg-[#C6A46A] shrink-0" />
              <span>{renderInlineMarkdown(item, `ul-${blockIdx}-${i}`)}</span>
            </li>
          ))}
        </ul>
      );
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushList();
      blocks.push(<hr key={`hr-${blockIdx++}`} className="border-white/[0.06] my-3" />);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      blocks.push(
        level === 1 ? (
          <h3
            key={`h-${blockIdx++}`}
            className="font-serif-display text-2xl text-[#F5F5F5] pt-2 pb-1 border-b border-white/[0.06]"
          >
            {renderInlineMarkdown(text, `h1-${blockIdx}`)}
          </h3>
        ) : (
          <h4
            key={`h-${blockIdx++}`}
            className="font-serif-display text-xl text-[#E9D1A5] pt-1.5"
          >
            {renderInlineMarkdown(text, `h2-${blockIdx}`)}
          </h4>
        )
      );
      continue;
    }

    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      if (listItems && listItems.ordered) flushList();
      if (!listItems) listItems = { ordered: false, items: [] };
      listItems.items.push(bulletMatch[1]);
      continue;
    }

    const numMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numMatch) {
      if (listItems && !listItems.ordered) flushList();
      if (!listItems) listItems = { ordered: true, items: [] };
      listItems.items.push(numMatch[1]);
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${blockIdx++}`} className="text-[14.5px] sm:text-[15px] text-[#E0E0E0] leading-7">
        {renderInlineMarkdown(trimmed, `p-${blockIdx}`)}
      </p>
    );
  }

  flushList();

  return (
    <div className="space-y-3">
      {blocks}
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-[#C6A46A] align-middle animate-pulse ml-1" />
      )}
    </div>
  );
}

export function AiMessageItem({
  message,
  thinkingStatus,
  streamingDisabled,
  onRetry,
}: AiMessageItemProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const clean = cleanDisplayContent(message.content);
    const cardSummary = (message.movieContext?.recommendations ?? [])
      .map((c, idx) => `${idx + 1}. ${c.title} (${c.releaseYear || 'N/A'}) — ${c.reason}`)
      .join('\n');
    const toCopy = [clean, cardSummary].filter(Boolean).join('\n\n');
    if (!toCopy) return;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  if (message.role === 'user') {
    const attached = message.movieContext?.attachedMovies ?? [];
    return (
      <motion.div
        data-message-role="user"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="max-w-[88%] sm:max-w-xl border border-[#C6A46A]/25 bg-[#151310] px-4 py-3 space-y-2">
          {attached.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attached.map((film) => (
                <span
                  key={film.id}
                  className="inline-flex items-center gap-1.5 border border-white/12 bg-[#0C0C0C] px-2 py-0.5 font-mono-tech text-[10px] text-[#E6E6E6]"
                >
                  <Film className="w-3 h-3 text-[#C6A46A]" />
                  {film.title} ({film.releaseYear || 'N/A'})
                </span>
              ))}
            </div>
          )}

          <p className="text-sm sm:text-[15px] text-[#F5F5F5] leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </motion.div>
    );
  }

  const recommendations = message.movieContext?.recommendations ?? [];
  const isError = Boolean(message.movieContext?.error);
  const isDirect = message.movieContext?.interactionMode === 'direct';
  const displayContent = cleanDisplayContent(message.content);

  return (
    <motion.div
      data-message-role="assistant"
      data-interaction-mode={isDirect ? 'direct' : 'conversational'}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="group space-y-4 py-1"
    >
      {/* Minimal Header Line */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#C6A46A]" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#9A9A9A]">
            {isDirect ? 'NOIR AI · Direct' : 'NOIR AI'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {!message.streaming && !isError && (displayContent || recommendations.length > 0) && (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1 px-2 py-1 text-[#7D7D7D] hover:text-[#F5F5F5] font-mono-tech text-[10px] uppercase tracking-[0.12em] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-[#C6A46A]" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
          {!message.streaming && (
            <button
              type="button"
              disabled={streamingDisabled}
              onClick={() => onRetry(message.id)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[#7D7D7D] hover:text-[#F5F5F5] font-mono-tech text-[10px] uppercase tracking-[0.12em] transition-colors cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" /> {isError ? 'Retry' : 'Regenerate'}
            </button>
          )}
        </div>
      </div>

      {/* Response Body */}
      {isError ? (
        <div className="border border-amber-500/30 bg-amber-950/15 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-amber-200 leading-relaxed">
            <p className="font-mono-tech uppercase tracking-[0.14em] text-amber-300">
              Response Unavailable
            </p>
            <p>{displayContent}</p>
          </div>
        </div>
      ) : message.streaming && !displayContent ? (
        isDirect ? (
          <div className="py-1 space-y-3">
            <div className="flex items-center gap-3 font-mono-tech text-[11px] uppercase tracking-[0.16em] text-[#C6A46A]">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-[#C6A46A] animate-bounce" />
                <span
                  className="w-1.5 h-1.5 bg-[#C6A46A] animate-bounce"
                  style={{ animationDelay: '120ms' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-[#C6A46A] animate-bounce"
                  style={{ animationDelay: '240ms' }}
                />
              </span>
              <span>{thinkingStatus || 'Selecting curated films & verifying ratings...'}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 opacity-35">
              <div className="h-36 border border-white/10 bg-[#121212] animate-pulse" />
              <div className="h-36 border border-white/10 bg-[#121212] animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="py-2 space-y-2.5">
            <div className="flex items-center gap-3 font-mono-tech text-[11px] uppercase tracking-[0.16em] text-[#C6A46A]">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-[#C6A46A] animate-bounce" />
                <span
                  className="w-1.5 h-1.5 bg-[#C6A46A] animate-bounce"
                  style={{ animationDelay: '120ms' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-[#C6A46A] animate-bounce"
                  style={{ animationDelay: '240ms' }}
                />
              </span>
              <span>{thinkingStatus || 'Consulting archive & curating picks...'}</span>
            </div>
            <div className="space-y-2 max-w-md opacity-30">
              <div className="h-2.5 bg-white/15 w-11/12 animate-pulse" />
              <div className="h-2.5 bg-white/15 w-4/5 animate-pulse" />
            </div>
          </div>
        )
      ) : displayContent ? (
        <div data-message-prose="true">
          <MarkdownProse content={displayContent} isStreaming={message.streaming} />
        </div>
      ) : null}

      {/* Telemetry while hydrating cards right at end of stream */}
      {message.streaming && displayContent && thinkingStatus && (
        <div className="font-mono-tech text-[10px] uppercase tracking-[0.15em] text-[#C6A46A]">
          {thinkingStatus}
        </div>
      )}

      {/* Recommendation Cards Grid */}
      {recommendations.length > 0 && (
        <div
          className={`${
            displayContent || !isDirect ? 'pt-4 border-t border-white/[0.06]' : ''
          } space-y-3`}
        >
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#8E8E8E]">
            {isDirect ? 'Direct Recommendations' : 'Recommended Films'} · {recommendations.length}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {recommendations.map((card, idx) => (
              <AiRecommendationCard key={`${card.id}-${idx}`} card={card} index={idx} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
