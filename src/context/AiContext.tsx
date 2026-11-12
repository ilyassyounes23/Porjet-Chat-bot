import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { useWatchlist } from '@/context/WatchlistContext';
import {
  appendMessagePersistence,
  cardToAttachedMovie,
  clearAllConversationsPersistence,
  createConversationPersistence,
  deleteConversationPersistence,
  fetchAiCapabilities,
  fetchConversationsPersistence,
  fetchPreferredInteractionMode,
  fetchSavedRecommendationsPersistence,
  readLocalInteractionMode,
  savePreferredInteractionMode,
  streamAiChat,
  toggleSavedRecommendationPersistence,
  updateConversationPersistence,
} from '@/services/ai/aiService';
import { detectAiIntent } from '@/utils/aiIntent';
import type {
  AiCapabilities,
  AiConversation,
  AiInteractionMode,
  AiMessage,
  AiMode,
  AiRecommendationCard,
  AttachedMovieContext,
  CinemaProfileContext,
} from '@/types/ai';

interface AiContextValue {
  capabilities: AiCapabilities;
  conversations: AiConversation[];
  activeConversationId: string | null;
  activeConversation: AiConversation | null;
  mode: AiMode;
  setMode: (mode: AiMode) => void;
  interactionMode: AiInteractionMode;
  setInteractionMode: (mode: AiInteractionMode) => void;
  allowSpoilers: boolean;
  setAllowSpoilers: (allow: boolean) => void;
  attachedMovies: AttachedMovieContext[];
  attachMovie: (movie: AttachedMovieContext) => void;
  removeAttachedMovie: (movieId: string) => void;
  clearAttachedMovies: () => void;
  savedRecommendations: AiRecommendationCard[];
  isRecommendationSaved: (cardId: string) => boolean;
  toggleSaveRecommendation: (card: AiRecommendationCard) => Promise<boolean>;
  loadingHistory: boolean;
  streaming: boolean;
  thinkingStatus: string | null;
  sqlMigrationNeeded: boolean;
  cinemaProfile: CinemaProfileContext;
  composerFocusTick: number;
  startNewConversation: (initialAttached?: AttachedMovieContext[]) => void;
  selectConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearAllConversations: () => Promise<void>;
  clearActiveConversation: () => Promise<void>;
  sendMessage: (
    text: string,
    overrideOptions?: {
      mode?: AiMode;
      interactionMode?: AiInteractionMode;
      attached?: AttachedMovieContext[];
    }
  ) => Promise<void>;
  sendCardToChat: (card: AiRecommendationCard) => void;
  askAiAboutCard: (card: AiRecommendationCard) => void;
  findSimilarToCard: (card: AiRecommendationCard) => Promise<void>;
  stopGeneration: () => void;
  regenerateLastResponse: () => Promise<void>;
  retryMessage: (assistantMessageId: string) => Promise<void>;
}

const AiContext = createContext<AiContextValue | null>(null);

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildConversationTitle(text: string, attached: AttachedMovieContext[]): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned) {
    return cleaned.length > 48 ? `${cleaned.slice(0, 45)}...` : cleaned;
  }
  if (attached.length > 0) {
    return `Discussion: ${attached.map((m) => m.title).join(' & ').slice(0, 42)}`;
  }
  return 'New Screening Session';
}

export function AiProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { watchlist, history } = useWatchlist();

  const [capabilities, setCapabilities] = useState<AiCapabilities>({
    enabled: true,
    configured: false,
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    message: 'Checking NOIR AI engine configuration...',
  });

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draftMode, setDraftMode] = useState<AiMode>('discovery');
  const [interactionMode, setInteractionModeState] = useState<AiInteractionMode>(() =>
    readLocalInteractionMode(user)
  );
  const [draftAttached, setDraftAttached] = useState<AttachedMovieContext[]>([]);
  const [allowSpoilers, setAllowSpoilers] = useState(false);
  const [savedRecommendations, setSavedRecommendations] = useState<AiRecommendationCard[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
  const [sqlMigrationNeeded, setSqlMigrationNeeded] = useState(false);
  const [composerFocusTick, setComposerFocusTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const activeIdRef = useRef(activeConversationId);
  activeIdRef.current = activeConversationId;
  const draftModeRef = useRef(draftMode);
  draftModeRef.current = draftMode;
  const interactionModeRef = useRef(interactionMode);
  interactionModeRef.current = interactionMode;
  const draftAttachedRef = useRef(draftAttached);
  draftAttachedRef.current = draftAttached;
  const savedRecsRef = useRef(savedRecommendations);
  savedRecsRef.current = savedRecommendations;
  const allowSpoilersRef = useRef(allowSpoilers);
  allowSpoilersRef.current = allowSpoilers;

  const userSyncKey = user ? `${user.authMode}:${user.id}` : 'guest';

  useEffect(() => {
    let active = true;
    void fetchAiCapabilities().then((caps) => {
      if (active) setCapabilities(caps);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const currentUser = userRef.current;

    async function load() {
      setLoadingHistory(true);
      const [convResult, savedList, prefInteraction] = await Promise.all([
        fetchConversationsPersistence(currentUser),
        fetchSavedRecommendationsPersistence(currentUser),
        fetchPreferredInteractionMode(currentUser),
      ]);
      if (!active) return;

      setConversations(convResult.conversations);
      setSqlMigrationNeeded(convResult.sqlMigrationNeeded);
      setSavedRecommendations(savedList);
      setInteractionModeState(prefInteraction);
      setActiveConversationId((prev) => {
        if (prev && convResult.conversations.some((c) => c.id === prev)) return prev;
        return convResult.conversations[0]?.id ?? null;
      });
      setLoadingHistory(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [userSyncKey]);

  const setInteractionMode = useCallback((nextMode: AiInteractionMode) => {
    interactionModeRef.current = nextMode;
    setInteractionModeState(nextMode);
    void savePreferredInteractionMode(userRef.current, nextMode);
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const mode = activeConversation?.mode ?? draftMode;
  const attachedMovies = activeConversation ? activeConversation.attachedMovies : draftAttached;

  const cinemaProfile = useMemo<CinemaProfileContext>(() => {
    const genreCounts = new Map<string, number>();
    for (const m of watchlist) {
      for (const g of m.genres) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 2);
      }
    }
    for (const entry of history) {
      for (const g of entry.movie.genres) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
    }

    const favoriteGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g);

    const discussedSet = new Set<string>();
    if (activeConversation) {
      for (const att of activeConversation.attachedMovies) {
        discussedSet.add(att.title);
      }
      for (const msg of activeConversation.messages) {
        for (const rec of msg.movieContext?.recommendations ?? []) {
          discussedSet.add(rec.title);
        }
      }
    }

    return {
      authenticated: Boolean(user),
      watchlistTitles: watchlist.slice(0, 15).map((m) => m.title),
      recentlyWatched: history.slice(0, 10).map((h) => ({
        title: h.movie.title,
        year: h.movie.releaseYear,
        genres: h.movie.genres.slice(0, 3),
      })),
      favoriteGenres,
      discussedTitles: [...discussedSet].slice(0, 15),
    };
  }, [user, watchlist, history, activeConversation]);

  const cinemaProfileRef = useRef(cinemaProfile);
  cinemaProfileRef.current = cinemaProfile;

  const setMode = useCallback((nextMode: AiMode) => {
    setDraftMode(nextMode);
    const activeId = activeIdRef.current;
    if (!activeId) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        const updated = { ...c, mode: nextMode };
        void updateConversationPersistence(userRef.current, updated);
        return updated;
      })
    );
  }, []);

  const attachMovie = useCallback((movie: AttachedMovieContext) => {
    const activeId = activeIdRef.current;
    if (!activeId) {
      setDraftAttached((prev) => {
        if (prev.some((m) => m.id === movie.id || (movie.tmdbId && m.tmdbId === movie.tmdbId))) {
          return prev;
        }
        return [...prev, movie].slice(0, 5);
      });
      return;
    }

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        if (
          c.attachedMovies.some(
            (m) => m.id === movie.id || (movie.tmdbId && m.tmdbId === movie.tmdbId)
          )
        ) {
          return c;
        }
        const updated: AiConversation = {
          ...c,
          attachedMovies: [...c.attachedMovies, movie].slice(0, 5),
        };
        void updateConversationPersistence(userRef.current, updated);
        return updated;
      })
    );
  }, []);

  const removeAttachedMovie = useCallback((movieId: string) => {
    const activeId = activeIdRef.current;
    if (!activeId) {
      setDraftAttached((prev) => prev.filter((m) => m.id !== movieId));
      return;
    }
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        const updated: AiConversation = {
          ...c,
          attachedMovies: c.attachedMovies.filter((m) => m.id !== movieId),
        };
        void updateConversationPersistence(userRef.current, updated);
        return updated;
      })
    );
  }, []);

  const clearAttachedMovies = useCallback(() => {
    const activeId = activeIdRef.current;
    if (!activeId) {
      setDraftAttached([]);
      return;
    }
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        const updated: AiConversation = { ...c, attachedMovies: [] };
        void updateConversationPersistence(userRef.current, updated);
        return updated;
      })
    );
  }, []);

  const startNewConversation = useCallback((initialAttached?: AttachedMovieContext[]) => {
    abortRef.current?.abort();
    setStreaming(false);
    setThinkingStatus(null);
    setActiveConversationId(null);
    setDraftAttached(initialAttached?.slice(0, 5) ?? []);
  }, []);

  const selectConversation = useCallback((id: string) => {
    abortRef.current?.abort();
    setStreaming(false);
    setThinkingStatus(null);
    setActiveConversationId(id);
    const target = conversationsRef.current.find((c) => c.id === id);
    if (target) {
      setDraftMode(target.mode);
    }
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const existing = conversationsRef.current.find((c) => c.id === id);
    if (!existing) return;
    const updatedTarget: AiConversation = { ...existing, title: trimmed };
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
    );
    await updateConversationPersistence(userRef.current, updatedTarget);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const target = conversationsRef.current.find((c) => c.id === id);
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (activeIdRef.current === id) {
        setActiveConversationId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
    if (target) {
      await deleteConversationPersistence(userRef.current, id, target.persistedMode);
    }
  }, []);

  const clearAllConversations = useCallback(async () => {
    abortRef.current?.abort();
    setStreaming(false);
    setThinkingStatus(null);
    setConversations([]);
    setActiveConversationId(null);
    setDraftAttached([]);
    await clearAllConversationsPersistence(userRef.current);
  }, []);

  const clearActiveConversation = useCallback(async () => {
    const activeId = activeIdRef.current;
    if (!activeId) {
      setDraftAttached([]);
      return;
    }
    await deleteConversation(activeId);
    setDraftAttached([]);
  }, [deleteConversation]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setThinkingStatus(null);
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        messages: c.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
      }))
    );
  }, []);

  const executeAssistantTurn = useCallback(
    async (
      targetConv: AiConversation,
      historyMessages: AiMessage[],
      turnMode: AiMode,
      turnInteractionMode: AiInteractionMode,
      turnAttached: AttachedMovieContext[]
    ) => {
      const assistantMsgId = makeUuid();
      const assistantCreatedAt = new Date().toISOString();
      const placeholder: AiMessage = {
        id: assistantMsgId,
        conversationId: targetConv.id,
        role: 'assistant',
        content: '',
        movieContext: { mode: turnMode, interactionMode: turnInteractionMode },
        createdAt: assistantCreatedAt,
        streaming: true,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConv.id
            ? {
                ...c,
                messages: [...historyMessages, placeholder],
                updatedAt: assistantCreatedAt,
              }
            : c
        )
      );

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setThinkingStatus(
        turnInteractionMode === 'direct'
          ? 'Searching catalog & verifying picks...'
          : 'Connecting to NOIR AI studio...'
      );

      let liveContent = '';
      let liveCards: AiRecommendationCard[] = [];
      let usedModel = capabilities.model;
      let usedProvider = capabilities.provider;

      try {
        const apiMessages = historyMessages
          .filter(
            (m) =>
              !m.movieContext?.error &&
              (m.content.trim().length > 0 || (m.movieContext?.recommendations?.length ?? 0) > 0)
          )
          .map((m) => ({
            role: m.role,
            content:
              m.content.trim().length > 0
                ? m.content
                : `Recommended film cards: ${(
                    m.movieContext?.recommendations?.map((r) => r.title) ?? []
                  ).join(', ')}.`,
            attachedMovies: m.movieContext?.attachedMovies,
            recommendationTitles: m.movieContext?.recommendations?.map((r) => r.title),
          }));

        const result = await streamAiChat(
          {
            conversationId: targetConv.id,
            mode: turnMode,
            interactionMode: turnInteractionMode,
            messages: apiMessages,
            attachedMovies: turnAttached,
            cinemaProfile: cinemaProfileRef.current,
            allowSpoilers: allowSpoilersRef.current,
          },
          {
            onStatus: (status) => {
              setThinkingStatus(status.label);
              if (status.model) usedModel = status.model;
              if (status.provider) usedProvider = status.provider;
            },
            onDelta: (delta) => {
              liveContent += delta;
              setConversations((prev) =>
                prev.map((c) =>
                  c.id !== targetConv.id
                    ? c
                    : {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantMsgId ? { ...m, content: liveContent } : m
                        ),
                      }
                )
              );
            },
            onRecommendations: (cards) => {
              liveCards = cards;
              setConversations((prev) =>
                prev.map((c) =>
                  c.id !== targetConv.id
                    ? c
                    : {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantMsgId
                            ? {
                                ...m,
                                movieContext: {
                                  mode: turnMode,
                                  interactionMode: turnInteractionMode,
                                  recommendations: cards,
                                  model: usedModel,
                                  provider: usedProvider,
                                },
                              }
                            : m
                        ),
                      }
                )
              );
            },
          },
          controller.signal
        );

        const finalText = result.text || liveContent;
        const finalCards = result.cards.length > 0 ? result.cards : liveCards;
        const completedAssistant: AiMessage = {
          id: assistantMsgId,
          conversationId: targetConv.id,
          role: 'assistant',
          content: finalText,
          movieContext: {
            mode: turnMode,
            interactionMode: turnInteractionMode,
            recommendations: finalCards,
            model: result.model || usedModel,
            provider: result.provider || usedProvider,
          },
          createdAt: assistantCreatedAt,
          streaming: false,
        };

        const baseConv =
          conversationsRef.current.find((c) => c.id === targetConv.id) ?? targetConv;
        const hasPlaceholder = baseConv.messages.some((m) => m.id === assistantMsgId);
        const convForPersist: AiConversation = {
          ...baseConv,
          messages: hasPlaceholder
            ? baseConv.messages.map((m) => (m.id === assistantMsgId ? completedAssistant : m))
            : [...historyMessages, completedAssistant],
          updatedAt: new Date().toISOString(),
        };

        setConversations((prev) =>
          prev.map((c) => (c.id === targetConv.id ? convForPersist : c))
        );

        await appendMessagePersistence(userRef.current, convForPersist, completedAssistant);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        const messageText =
          err instanceof Error ? err.message : 'Unable to generate NOIR AI response.';
        const errorAssistant: AiMessage = {
          id: assistantMsgId,
          conversationId: targetConv.id,
          role: 'assistant',
          content: messageText,
          movieContext: {
            mode: turnMode,
            interactionMode: turnInteractionMode,
            error: true,
          },
          createdAt: assistantCreatedAt,
          streaming: false,
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id !== targetConv.id
              ? c
              : {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId ? errorAssistant : m
                  ),
                }
          )
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setStreaming(false);
        setThinkingStatus(null);
      }
    },
    [capabilities.model, capabilities.provider]
  );

  const sendMessage = useCallback(
    async (
      text: string,
      overrideOptions?: {
        mode?: AiMode;
        interactionMode?: AiInteractionMode;
        attached?: AttachedMovieContext[];
      }
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const activeId = activeIdRef.current;
      let targetConv = activeId
        ? conversationsRef.current.find((c) => c.id === activeId) ?? null
        : null;

      const effectiveAttached =
        overrideOptions?.attached ??
        (targetConv ? targetConv.attachedMovies : draftAttachedRef.current);
      const effectiveMode =
        overrideOptions?.mode ?? detectAiIntent(trimmed, effectiveAttached.length);
      const effectiveInteractionMode =
        overrideOptions?.interactionMode ?? interactionModeRef.current;

      setDraftMode(effectiveMode);

      if (!targetConv) {
        const title = buildConversationTitle(trimmed, effectiveAttached);
        targetConv = await createConversationPersistence(userRef.current, {
          title,
          mode: effectiveMode,
          attachedMovies: effectiveAttached,
        });
        setConversations((prev) => [targetConv!, ...prev]);
        setActiveConversationId(targetConv.id);
        setDraftAttached([]);
      } else if (overrideOptions?.attached || targetConv.mode !== effectiveMode) {
        targetConv = {
          ...targetConv,
          attachedMovies: effectiveAttached,
          mode: effectiveMode,
        };
        setConversations((prev) =>
          prev.map((c) => (c.id === targetConv!.id ? targetConv! : c))
        );
        void updateConversationPersistence(userRef.current, targetConv);
      }

      const userMsg: AiMessage = {
        id: makeUuid(),
        conversationId: targetConv.id,
        role: 'user',
        content: trimmed,
        movieContext: {
          mode: effectiveMode,
          interactionMode: effectiveInteractionMode,
          attachedMovies: effectiveAttached.length > 0 ? effectiveAttached : undefined,
        },
        createdAt: new Date().toISOString(),
      };

      const updatedHistory = [...targetConv.messages, userMsg];
      const updatedConv: AiConversation = {
        ...targetConv,
        messages: updatedHistory,
        updatedAt: userMsg.createdAt,
      };

      setConversations((prev) =>
        prev.map((c) => (c.id === updatedConv.id ? updatedConv : c))
      );
      await appendMessagePersistence(userRef.current, updatedConv, userMsg);

      await executeAssistantTurn(
        updatedConv,
        updatedHistory,
        effectiveMode,
        effectiveInteractionMode,
        effectiveAttached
      );
    },
    [executeAssistantTurn]
  );

  const sendCardToChat = useCallback(
    (card: AiRecommendationCard) => {
      attachMovie(cardToAttachedMovie(card));
    },
    [attachMovie]
  );

  const askAiAboutCard = useCallback(
    (card: AiRecommendationCard) => {
      setInteractionMode('conversational');
      attachMovie(cardToAttachedMovie(card));
      setComposerFocusTick((n) => n + 1);
    },
    [attachMovie, setInteractionMode]
  );

  const findSimilarToCard = useCallback(
    async (card: AiRecommendationCard) => {
      const ctx = cardToAttachedMovie(card);
      const currentAttached = activeIdRef.current
        ? conversationsRef.current.find((c) => c.id === activeIdRef.current)?.attachedMovies ?? []
        : draftAttachedRef.current;
      const nextAttached = currentAttached.some((m) => m.id === ctx.id)
        ? currentAttached
        : [...currentAttached, ctx].slice(-5);

      await sendMessage(
        `Find five films with similar atmosphere, visual storytelling, and emotional resonance to "${card.title}" (${card.releaseYear || 'N/A'}).`,
        {
          mode: 'discovery',
          interactionMode: interactionModeRef.current,
          attached: nextAttached,
        }
      );
    },
    [sendMessage]
  );

  const retryMessage = useCallback(
    async (assistantMessageId: string) => {
      const activeId = activeIdRef.current;
      if (!activeId) return;
      const conv = conversationsRef.current.find((c) => c.id === activeId);
      if (!conv) return;

      const idx = conv.messages.findIndex((m) => m.id === assistantMessageId);
      if (idx === -1) return;

      const truncatedHistory = conv.messages.slice(0, idx);
      if (truncatedHistory.length === 0) return;

      const targetMsg = conv.messages[idx];
      const retryInteraction =
        targetMsg?.movieContext?.interactionMode ?? interactionModeRef.current;

      await executeAssistantTurn(
        conv,
        truncatedHistory,
        conv.mode,
        retryInteraction,
        conv.attachedMovies
      );
    },
    [executeAssistantTurn]
  );

  const regenerateLastResponse = useCallback(async () => {
    const activeId = activeIdRef.current;
    if (!activeId) return;
    const conv = conversationsRef.current.find((c) => c.id === activeId);
    if (!conv) return;

    const lastAssistant = [...conv.messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) {
      await retryMessage(lastAssistant.id);
    }
  }, [retryMessage]);

  const savedRecIds = useMemo(
    () => new Set(savedRecommendations.map((r) => r.id)),
    [savedRecommendations]
  );

  const isRecommendationSaved = useCallback(
    (cardId: string) => savedRecIds.has(cardId),
    [savedRecIds]
  );

  const toggleSaveRecommendation = useCallback(async (card: AiRecommendationCard) => {
    const { next, saved } = await toggleSavedRecommendationPersistence(
      userRef.current,
      card,
      savedRecsRef.current
    );
    setSavedRecommendations(next);
    return saved;
  }, []);

  const value = useMemo<AiContextValue>(
    () => ({
      capabilities,
      conversations,
      activeConversationId,
      activeConversation,
      mode,
      setMode,
      interactionMode,
      setInteractionMode,
      allowSpoilers,
      setAllowSpoilers,
      attachedMovies,
      attachMovie,
      removeAttachedMovie,
      clearAttachedMovies,
      savedRecommendations,
      isRecommendationSaved,
      toggleSaveRecommendation,
      loadingHistory,
      streaming,
      thinkingStatus,
      sqlMigrationNeeded,
      cinemaProfile,
      composerFocusTick,
      startNewConversation,
      selectConversation,
      renameConversation,
      deleteConversation,
      clearAllConversations,
      clearActiveConversation,
      sendMessage,
      sendCardToChat,
      askAiAboutCard,
      findSimilarToCard,
      stopGeneration,
      regenerateLastResponse,
      retryMessage,
    }),
    [
      capabilities,
      conversations,
      activeConversationId,
      activeConversation,
      mode,
      setMode,
      interactionMode,
      setInteractionMode,
      allowSpoilers,
      attachedMovies,
      attachMovie,
      removeAttachedMovie,
      clearAttachedMovies,
      savedRecommendations,
      isRecommendationSaved,
      toggleSaveRecommendation,
      loadingHistory,
      streaming,
      thinkingStatus,
      sqlMigrationNeeded,
      cinemaProfile,
      composerFocusTick,
      startNewConversation,
      selectConversation,
      renameConversation,
      deleteConversation,
      clearAllConversations,
      clearActiveConversation,
      sendMessage,
      sendCardToChat,
      askAiAboutCard,
      findSimilarToCard,
      stopGeneration,
      regenerateLastResponse,
      retryMessage,
    ]
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi() {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error('useAi must be used within AiProvider');
  return ctx;
}
