import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { AuthLayout } from '@/components/forms/AuthLayout';
import { Button } from '@/components/ui/Button';

export function RedditCallbackPage() {
  const [params] = useSearchParams();
  const [statusMessage, setStatusMessage] = useState('Validating Reddit authorization callback...');

  useEffect(() => {
    const error = params.get('error');
    const code = params.get('code');
    const state = params.get('state');
    const storedState = sessionStorage.getItem('noir_reddit_oauth_state');

    if (error) {
      setStatusMessage(`Reddit authorization declined: ${error}`);
      return;
    }

    if (!code || !state || state !== storedState) {
      setStatusMessage('Invalid or expired OAuth state parameter.');
      return;
    }

    sessionStorage.removeItem('noir_reddit_oauth_state');
    setStatusMessage(
      'Authorization code received from Reddit. Complete server-side token exchange with your Reddit Client Secret (never stored in browser code) to create a session.'
    );
  }, [params]);

  return (
    <AuthLayout
      eyebrow="OAuth Verification"
      title="Reddit Authorization"
      subtitle="External provider handshake status"
    >
      <div className="border border-white/15 bg-[#111111] p-5 space-y-4">
        <div className="flex items-start gap-3 text-xs text-[#d4d4d4] leading-relaxed">
          <AlertCircle className="w-4 h-4 text-[#C6A46A] shrink-0 mt-0.5" />
          <p>{statusMessage}</p>
        </div>
        <div className="flex gap-3">
          <Link to="/login">
            <Button variant="accent" size="sm">
              Return to Sign In
            </Button>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              Browse Catalog
            </Button>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
