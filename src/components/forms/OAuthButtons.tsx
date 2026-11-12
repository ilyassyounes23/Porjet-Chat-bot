import React, { useState } from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { OAuthProvider } from '@/types/movie';

interface OAuthButtonsProps {
  mode: 'login' | 'register';
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 fill-current" aria-hidden="true">
      <path d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3 .9-3.8 2.3-1.7 2.9-.4 7.1 1.2 9.4.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.8 3-.8 1.4 0 1.8.8 3 .8 1.3 0 2.1-1.1 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1-.1-2.5-1-2.5-3.8zm-2.3-6.9c.6-.8 1.1-1.9.9-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3z" />
    </svg>
  );
}

function RedditMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#FF4500" />
      <path
        fill="#FFFFFF"
        d="M17.2 12.2c0-.7-.6-1.3-1.3-1.3-.4 0-.7.1-.9.4-.9-.6-2.1-1-3.5-1.1l.6-2.8 2 .4c0 .5.4.9.9.9s.9-.4.9-.9-.4-.9-.9-.9c-.4 0-.7.2-.8.6l-2.3-.5c-.2 0-.4.1-.4.3l-.7 3.1c-1.4 0-2.7.5-3.6 1.1-.2-.2-.6-.4-.9-.4-.7 0-1.3.6-1.3 1.3 0 .5.3 1 .8 1.2v.4c0 2 2.3 3.6 5.2 3.6s5.2-1.6 5.2-3.6v-.4c.4-.2.7-.7.7-1.2zm-7.5.9c0-.5.4-.9.9-.9s.9.4.9.9-.4.9-.9.9-.9-.4-.9-.9zm4.9 2.4c-.6.6-1.8.7-2.6.7s-2-.1-2.6-.7c-.1-.1-.1-.3 0-.4s.3-.1.4 0c.4.4 1.3.6 2.2.6s1.8-.2 2.2-.6c.1-.1.3-.1.4 0s.1.3 0 .4zm-.2-1.5c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9z"
      />
    </svg>
  );
}

export function OAuthButtons({ mode }: OAuthButtonsProps) {
  const { capabilities, loginWithOAuth } = useAuth();
  const [notice, setNotice] = useState<{ reason: string; envHint?: string } | null>(null);
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);

  const verb = mode === 'login' ? 'Continue' : 'Register';

  const handleClick = async (provider: OAuthProvider) => {
    setNotice(null);
    setBusyProvider(provider);
    try {
      const result = await loginWithOAuth(provider);
      if (!result.started) {
        setNotice({
          reason: result.reason ?? `${provider} OAuth is unavailable.`,
          envHint: result.envHint,
        });
      }
    } finally {
      setBusyProvider(null);
    }
  };

  const providers: Array<{ id: OAuthProvider; label: string; icon: React.ReactNode }> = [
    { id: 'google', label: `${verb} with Google`, icon: <GoogleMark /> },
    { id: 'apple', label: `${verb} with Apple`, icon: <AppleMark /> },
    { id: 'reddit', label: `${verb} with Reddit`, icon: <RedditMark /> },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5">
        {providers.map((p) => {
          const configured = capabilities.oauthProviders[p.id];
          return (
            <button
              key={p.id}
              type="button"
              disabled={busyProvider !== null}
              onClick={() => void handleClick(p.id)}
              className="group flex items-center justify-between w-full bg-[#131313] hover:bg-[#1b1b1b] border border-white/12 hover:border-white/25 px-4 py-2.5 text-xs tracking-[0.06em] text-[#F5F5F5] transition-all duration-200 rounded-[2px] cursor-pointer disabled:opacity-50"
            >
              <span className="flex items-center gap-3">
                {p.icon}
                <span>{busyProvider === p.id ? 'Connecting...' : p.label}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-mono-tech uppercase tracking-wider text-[#929292]">
                {configured ? (
                  <span className="text-[#C6A46A]">Ready</span>
                ) : (
                  <span>Setup Req.</span>
                )}
                <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          );
        })}
      </div>

      {notice && (
        <div
          role="status"
          className="border border-[#C6A46A]/35 bg-[#C6A46A]/[0.06] px-3.5 py-3 text-xs space-y-1"
        >
          <div className="flex items-center gap-2 text-[#C6A46A] font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{notice.reason}</span>
          </div>
          {notice.envHint && (
            <p className="text-[11px] text-[#b4b4b4] leading-relaxed pl-5">
              {notice.envHint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
