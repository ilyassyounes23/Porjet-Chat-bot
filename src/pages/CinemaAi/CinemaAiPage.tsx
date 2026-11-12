import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowUpRight,
  Eye,
  EyeOff,
  Film,
  PanelLeft,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react';
import { useAi } from '@/context/AiContext';
import { AiSidebar } from '@/components/ai/AiSidebar';
import { AiMessageItem } from '@/components/ai/AiMessageItem';
import { AttachMovieModal } from '@/components/ai/AttachMovieModal';

const COMPACT_SUGGESTIONS = [
  'A psychological thriller with a twist.',
  'Something like Interstellar.',
  'An underrated cinematic masterpiece.',
];

export function CinemaAiPage() {
  const {
    capabilities,
    activeConversation,
    interactionMode,
    setInteractionMode,
    allowSpoilers,
    setAllowSpoilers,
    attachedMovies,
    removeAttachedMovie,
    clearAttachedMovies,
    streaming,
    thinkingStatus,
    sqlMigrationNeeded,
    composerFocusTick,
    clearActiveConversation,
    sendMessage,
    stopGeneration,
    retryMessage,
  } = useAi();

  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);

  const feedEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = activeConversation?.messages ?? [];
  const hasConversation = messages.length > 0;

  useEffect(() => {
    if (!hasConversation) return;
    feedEndRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' });
  }, [hasConversation, messages.length, streaming]);

  useEffect(() => {
    if (composerFocusTick > 0) {
      textareaRef.current?.focus();
    }
  }, [composerFocusTick]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (streaming || !input.trim()) return;
    const textToSend = input;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleQuickSuggestion = (prompt: string) => {
    if (streaming) return;
    void sendMessage(prompt);
  };

  return (
    <div className="pt-[63px] h-[100dvh] flex flex-col bg-[#090909] text-[#F5F5F5] overflow-hidden">
      <div className="flex-1 flex min-h-0">
        {/* Minimal Left Sidebar (Conversation Management Only) */}
        <AiSidebar
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />

        {/* Main Studio Canvas */}
        <main className="flex-1 min-w-0 flex flex-col h-full overflow-x-hidden">
          {/* Quiet Top Bar */}
          <header className="h-12 px-4 sm:px-8 border-b border-white/[0.06] bg-[#090909] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open conversations"
                className="lg:hidden inline-flex items-center gap-1.5 py-1 pr-2 text-[#B8B8B8] hover:text-[#F5F5F5] font-mono-tech text-[10px] uppercase tracking-[0.16em] transition-colors cursor-pointer shrink-0"
              >
                <PanelLeft className="w-4 h-4 text-[#C6A46A]" /> History
              </button>

              {hasConversation && activeConversation?.title ? (
                <p className="text-xs text-[#8A8A8A] truncate">{activeConversation.title}</p>
              ) : (
                <span className="hidden lg:inline font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#666666]">
                  Cinema Companion
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Dual Interaction Mode Selector (Conversational vs Direct Recommendations) */}
              <div
                role="group"
                aria-label="Interaction mode"
                className="inline-flex items-center border border-white/[0.1] bg-[#0F0F0F] p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setInteractionMode('conversational')}
                  aria-pressed={interactionMode === 'conversational'}
                  title="Conversational — talk naturally about films, critiques & comparisons"
                  className={`px-2.5 py-1 font-mono-tech text-[9.5px] uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                    interactionMode === 'conversational'
                      ? 'bg-[#C6A46A]/18 text-[#F4DAAB] border border-[#C6A46A]/45'
                      : 'text-[#7F7F7F] hover:text-[#E2E2E2] border border-transparent'
                  }`}
                >
                  Conversational
                </button>
                <button
                  type="button"
                  onClick={() => setInteractionMode('direct')}
                  aria-pressed={interactionMode === 'direct'}
                  title="Direct Recommendations — immediate movie cards without long conversation"
                  className={`px-2.5 py-1 font-mono-tech text-[9.5px] uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                    interactionMode === 'direct'
                      ? 'bg-[#C6A46A]/18 text-[#F4DAAB] border border-[#C6A46A]/45'
                      : 'text-[#7F7F7F] hover:text-[#E2E2E2] border border-transparent'
                  }`}
                >
                  <span className="hidden sm:inline">Direct Recommendations</span>
                  <span className="sm:hidden">Direct</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setAllowSpoilers(!allowSpoilers)}
                aria-label={allowSpoilers ? 'Spoilers on' : 'Spoiler-safe'}
                title={
                  allowSpoilers
                    ? 'Spoilers enabled for deep analysis'
                    : 'Spoiler protection active — click to allow spoilers'
                }
                className={`inline-flex items-center gap-1.5 text-[11px] transition-colors cursor-pointer ${
                  allowSpoilers
                    ? 'text-[#C6A46A] hover:text-[#E2C28B]'
                    : 'text-[#6F6F6F] hover:text-[#BDBDBD]'
                }`}
              >
                {allowSpoilers ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Spoilers on</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-[#8D7850]" />
                    <span className="hidden sm:inline">Spoiler-safe</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Honest Configuration Notice (when API key is missing or AI disabled) */}
          {!capabilities.configured && (
            <div className="px-4 sm:px-8 py-2.5 bg-[#15110B] border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex items-center gap-2 text-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  {capabilities.message ||
                    'Add a valid OPENAI_API_KEY in your .env file and restart NOIR to activate live recommendations.'}
                </span>
              </div>
            </div>
          )}

          {/* Optional SQL Migration Notice */}
          {sqlMigrationNeeded && (
            <div className="px-4 sm:px-8 py-2 bg-[#101010] border-b border-white/[0.06] flex items-center gap-2 text-[11px] text-[#8E8E8E] shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C6A46A] shrink-0" />
              <span>
                Run <code className="text-[#E5C994]">supabase/schema.sql</code> in Supabase SQL
                Editor to sync conversations across devices.
              </span>
            </div>
          )}

          {/* Scrollable Welcome / Conversation Canvas */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8">
            <AnimatePresence mode="wait">
              {!hasConversation ? (
                <motion.section
                  key="welcome"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="min-h-full max-w-3xl mx-auto flex flex-col justify-center py-8 sm:py-12 space-y-7"
                >
                  {/* Clean Editorial Welcome */}
                  <div className="space-y-3">
                    <h1 className="font-serif-display text-3xl sm:text-5xl text-[#F5F5F5] leading-[1.08] tracking-[-0.01em]">
                      Discover your next obsession.
                    </h1>
                    <p className="text-sm sm:text-[15px] text-[#8E8E8E] max-w-xl leading-relaxed">
                      Tell me what you love about cinema. I&apos;ll find something worth watching.
                    </p>
                  </div>

                  {/* Compact Film Dossier (only shown if arrived via "Discuss with NOIR AI") */}
                  {attachedMovies.length > 0 && (
                    <div className="border-l-2 border-[#C6A46A] pl-4 py-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {attachedMovies.map((film) => (
                          <div key={film.id} className="flex items-center gap-2.5">
                            <div className="w-8 aspect-[2/3] bg-[#181818] shrink-0 overflow-hidden flex items-center justify-center">
                              {film.posterUrl ? (
                                <img
                                  src={film.posterUrl}
                                  alt={film.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Film className="w-3.5 h-3.5 text-[#555]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-[#F5F5F5] truncate">
                                {film.title}
                              </p>
                              <p className="text-[11px] text-[#808080] truncate">
                                {film.releaseYear || 'N/A'}
                                {film.director ? ` · ${film.director}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={streaming}
                          onClick={() =>
                            void sendMessage(
                              `Recommend similar films with the atmosphere and storytelling craft of ${attachedMovies
                                .map((m) => m.title)
                                .join(' & ')}.`
                            )
                          }
                          className="px-3 py-1.5 bg-[#C6A46A] text-[#090909] hover:bg-[#D5B57D] font-mono-tech text-[10px] uppercase tracking-[0.16em] transition-colors cursor-pointer"
                        >
                          Recommend similar
                        </button>
                        <button
                          type="button"
                          disabled={streaming}
                          onClick={() =>
                            void sendMessage(
                              `Analyze the themes, direction, and cinematography of ${attachedMovies
                                .map((m) => m.title)
                                .join(' and ')}.`
                            )
                          }
                          className="px-3 py-1.5 border border-white/15 text-[#D8D8D8] hover:border-[#C6A46A] font-mono-tech text-[10px] uppercase tracking-[0.16em] transition-colors cursor-pointer"
                        >
                          Analyze film
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Max 3 Subtle Text-Based Starter Prompts (disappear on first message) */}
                  <div className="flex flex-wrap gap-2">
                    {COMPACT_SUGGESTIONS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={streaming}
                        onClick={() => handleQuickSuggestion(prompt)}
                        className="group inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.08] bg-[#0F0F0F] hover:border-[#C6A46A]/55 hover:bg-[#141310] text-xs text-[#A8A8A8] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                      >
                        <span>{prompt}</span>
                        <ArrowUpRight className="w-3 h-3 text-[#6E6E6E] group-hover:text-[#C6A46A] transition-colors" />
                      </button>
                    ))}
                  </div>
                </motion.section>
              ) : (
                <motion.section
                  key="conversation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-3xl mx-auto py-6 sm:py-8 space-y-7"
                >
                  {messages.map((msg) => (
                    <AiMessageItem
                      key={msg.id}
                      message={msg}
                      thinkingStatus={thinkingStatus}
                      streamingDisabled={streaming}
                      onRetry={(id) => void retryMessage(id)}
                    />
                  ))}
                  <div ref={feedEndRef} />
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* Grounded Bottom Composer */}
          <footer className="border-t border-white/[0.06] bg-[#090909] px-4 sm:px-8 py-3.5 sm:py-4 shrink-0">
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="max-w-3xl mx-auto space-y-2"
            >
              {/* Attached Films Tray */}
              {attachedMovies.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                  {attachedMovies.map((film) => (
                    <div
                      key={film.id}
                      className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 border border-[#C6A46A]/40 bg-[#15130F] text-[11px] text-[#EFE1C4]"
                    >
                      <Film className="w-3 h-3 text-[#C6A46A] shrink-0" />
                      <span className="max-w-[170px] truncate">
                        {film.title}
                        {film.releaseYear ? ` (${film.releaseYear})` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachedMovie(film.id)}
                        aria-label={`Remove ${film.title}`}
                        className="p-0.5 text-[#9A9A9A] hover:text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {attachedMovies.length > 1 && (
                    <button
                      type="button"
                      onClick={clearAttachedMovies}
                      className="text-[11px] text-[#707070] hover:text-[#D5D5D5] ml-1 cursor-pointer"
                    >
                      Clear films
                    </button>
                  )}
                </div>
              )}

              {/* Composer Input Shell */}
              <div className="border border-white/[0.12] focus-within:border-[#C6A46A]/80 bg-[#111111] transition-colors duration-200 px-3.5 pt-3 pb-2.5 space-y-2">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    interactionMode === 'direct'
                      ? 'Describe the movies you want (e.g. "5 psychological thrillers, IMDb above 8")...'
                      : "Tell me what you're in the mood to watch..."
                  }
                  className="w-full bg-transparent text-sm sm:text-[15px] text-[#F5F5F5] placeholder:text-[#666666] resize-none outline-none leading-relaxed max-h-[160px]"
                />

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAttachModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-white/[0.1] hover:border-[#C6A46A]/60 text-[#CCCCCC] hover:text-[#F5F5F5] font-mono-tech text-[10px] uppercase tracking-[0.14em] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-[#C6A46A]" /> Attach Movie
                    </button>

                    {(hasConversation || attachedMovies.length > 0) && (
                      <button
                        type="button"
                        onClick={() => void clearActiveConversation()}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[#707070] hover:text-rose-300 font-mono-tech text-[10px] uppercase tracking-[0.14em] transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 ml-auto">
                    <span className="hidden sm:inline font-mono-tech text-[9.5px] uppercase tracking-[0.12em] text-[#585858]">
                      Enter to send
                    </span>

                    {streaming ? (
                      <button
                        type="button"
                        onClick={stopGeneration}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-rose-500/45 bg-rose-950/30 text-rose-200 hover:bg-rose-900/45 font-mono-tech text-[10px] uppercase tracking-[0.16em] transition-colors cursor-pointer"
                      >
                        <Square className="w-3 h-3 fill-current" /> Stop
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!input.trim()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#C6A46A] text-[#090909] hover:bg-[#D7B983] disabled:opacity-30 disabled:cursor-not-allowed font-mono-tech text-[10px] uppercase tracking-[0.16em] transition-colors cursor-pointer"
                      >
                        <Send className="w-3 h-3" /> Send
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </footer>
        </main>
      </div>

      {/* Movie Picker Modal */}
      <AttachMovieModal open={attachModalOpen} onClose={() => setAttachModalOpen(false)} />
    </div>
  );
}
