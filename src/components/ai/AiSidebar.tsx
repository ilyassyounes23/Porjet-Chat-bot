import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Edit3,
  ExternalLink,
  Film,
  MessageSquare,
  MessageSquarePlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useAi } from '@/context/AiContext';

interface AiSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AiSidebar({ mobileOpen, onCloseMobile }: AiSidebarProps) {
  const navigate = useNavigate();
  const {
    conversations,
    activeConversationId,
    savedRecommendations,
    startNewConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    clearAllConversations,
    sendCardToChat,
    toggleSaveRecommendation,
  } = useAi();

  const [tab, setTab] = useState<'history' | 'saved'>('history');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveRename = async (id: string) => {
    if (editTitle.trim()) {
      await renameConversation(id, editTitle);
    }
    setEditingId(null);
  };

  const handleSelectConv = (id: string) => {
    selectConversation(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-[#0B0B0B] border-r border-white/[0.07] text-[#E8E8E8]">
      {/* NOIR AI Logo */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
        <span className="font-serif-display text-xl tracking-[0.22em] text-[#F5F5F5]">
          NOIR <span className="text-[#C6A46A]">AI</span>
        </span>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close sidebar"
          className="lg:hidden p-1.5 text-[#888] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* New Conversation Action */}
      <div className="px-4 py-3.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            startNewConversation();
            setTab('history');
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#C6A46A] text-[#090909] hover:bg-[#D5B57D] font-mono-tech text-[10.5px] font-medium uppercase tracking-[0.18em] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> New Conversation
        </button>
      </div>

      {/* Switcher: History vs Saved */}
      <div className="px-4 border-b border-white/[0.06] flex items-center gap-6 shrink-0">
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`pb-2.5 flex items-center gap-1.5 font-mono-tech text-[10px] uppercase tracking-[0.16em] border-b transition-colors cursor-pointer ${
            tab === 'history'
              ? 'border-[#C6A46A] text-[#F5F5F5]'
              : 'border-transparent text-[#6F6F6F] hover:text-[#CCCCCC]'
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          <span>History</span>
          {conversations.length > 0 && (
            <span className="text-[#7E7E7E]">{conversations.length}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('saved')}
          className={`pb-2.5 flex items-center gap-1.5 font-mono-tech text-[10px] uppercase tracking-[0.16em] border-b transition-colors cursor-pointer ${
            tab === 'saved'
              ? 'border-[#C6A46A] text-[#F5F5F5]'
              : 'border-transparent text-[#6F6F6F] hover:text-[#CCCCCC]'
          }`}
        >
          <Bookmark className="w-3 h-3" />
          <span>Saved</span>
          {savedRecommendations.length > 0 && (
            <span className="text-[#C6A46A]">{savedRecommendations.length}</span>
          )}
        </button>
      </div>

      {/* Primary Scrollable Conversation / Saved List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-3">
        {tab === 'history' ? (
          conversations.length === 0 ? (
            <div className="h-full min-h-[160px] flex items-center justify-center px-4 text-center">
              <p className="text-xs text-[#6B6B6B]">No conversations yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const isEditing = editingId === conv.id;
                return (
                  <div
                    key={conv.id}
                    className={`group border-l-2 transition-colors ${
                      isActive
                        ? 'border-[#C6A46A] bg-[#141310]'
                        : 'border-transparent hover:bg-white/[0.03]'
                    }`}
                  >
                    {isEditing ? (
                      <div className="p-2 flex items-center gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveRename(conv.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 min-w-0 bg-[#1B1B1B] border border-[#C6A46A] px-2 py-1 text-xs text-[#F5F5F5] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveRename(conv.id)}
                          aria-label="Save title"
                          className="p-1 text-[#C6A46A] hover:text-white cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => handleSelectConv(conv.id)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <p
                            className={`text-[13px] truncate transition-colors ${
                              isActive
                                ? 'text-[#F5F5F5] font-medium'
                                : 'text-[#BEBEBE] group-hover:text-[#F5F5F5]'
                            }`}
                          >
                            {conv.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#686868] truncate">
                            {conv.messages.length}{' '}
                            {conv.messages.length === 1 ? 'message' : 'messages'}
                            {conv.attachedMovies.length > 0 &&
                              ` · ${conv.attachedMovies.length} film${conv.attachedMovies.length > 1 ? 's' : ''}`}
                          </p>
                        </button>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartRename(conv.id, conv.title)}
                            title="Rename conversation"
                            aria-label="Rename conversation"
                            className="p-1 text-[#707070] hover:text-[#F5F5F5] cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteConversation(conv.id)}
                            title="Delete conversation"
                            aria-label="Delete conversation"
                            className="p-1 text-[#707070] hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="pt-3 px-2">
                {!confirmClearAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="w-full py-1.5 text-left font-mono-tech text-[9.5px] uppercase tracking-[0.15em] text-[#666] hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    Clear history
                  </button>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        void clearAllConversations();
                        setConfirmClearAll(false);
                      }}
                      className="px-2.5 py-1 bg-rose-900/40 border border-rose-500/45 text-rose-200 font-mono-tech text-[9.5px] uppercase tracking-[0.14em] cursor-pointer"
                    >
                      Confirm clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-2.5 py-1 text-[#8E8E8E] hover:text-white font-mono-tech text-[9.5px] uppercase tracking-[0.14em] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        ) : savedRecommendations.length === 0 ? (
          <div className="h-full min-h-[160px] flex items-center justify-center px-4 text-center">
            <p className="text-xs text-[#6B6B6B]">No saved recommendations yet.</p>
          </div>
        ) : (
          <div className="space-y-2 px-1">
            {savedRecommendations.map((card) => (
              <div
                key={card.id}
                className="p-2.5 border border-white/[0.06] bg-[#101010] hover:border-white/[0.14] transition-colors space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-9 aspect-[2/3] bg-[#181818] shrink-0 overflow-hidden flex items-center justify-center">
                    {card.posterUrl ? (
                      <img
                        src={card.posterUrl}
                        alt={card.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film className="w-3.5 h-3.5 text-[#555]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif-display text-base text-[#F5F5F5] leading-tight truncate">
                      {card.title}
                    </p>
                    <p className="font-mono-tech text-[9px] uppercase tracking-[0.12em] text-[#808080] mt-0.5">
                      {card.releaseYear || 'N/A'} ·{' '}
                      <span className={card.availableInNoir ? 'text-[#C6A46A]' : ''}>
                        {card.availableInNoir ? 'In NOIR' : 'TMDB'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      sendCardToChat(card);
                      onCloseMobile();
                    }}
                    className="flex-1 py-1 border border-[#C6A46A]/35 text-[#E6CA96] hover:bg-[#C6A46A]/15 font-mono-tech text-[9px] uppercase tracking-[0.12em] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <MessageSquarePlus className="w-2.5 h-2.5" /> Discuss
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (card.availableInNoir && card.internalMovieId) {
                        navigate(`/movie/${card.internalMovieId}`);
                      } else if (card.externalUrl) {
                        window.open(card.externalUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="px-2 py-1 border border-white/10 text-[#B8B8B8] hover:text-white font-mono-tech text-[9px] uppercase tracking-[0.1em] flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-2.5 h-2.5" /> Details
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleSaveRecommendation(card)}
                    title="Remove saved film"
                    aria-label="Remove saved film"
                    className="p-1 text-[#787878] hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back to NOIR Footer */}
      <div className="p-3.5 border-t border-white/[0.06] bg-[#0A0A0A] shrink-0">
        <Link
          to="/"
          className="w-full flex items-center justify-center gap-2 py-2 border border-white/[0.1] hover:border-[#C6A46A]/70 text-[#B8B8B8] hover:text-[#F5F5F5] font-mono-tech text-[10px] uppercase tracking-[0.18em] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to NOIR
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-[272px] xl:w-[288px] shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Mobile Collapsible Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 lg:hidden flex bg-black/75"
            onClick={(e) => {
              if (e.target === e.currentTarget) onCloseMobile();
            }}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-[84vw] max-w-[300px] h-full shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
