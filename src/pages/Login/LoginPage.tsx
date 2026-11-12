import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthLayout } from '@/components/forms/AuthLayout';
import { TextField } from '@/components/forms/TextField';
import { OAuthButtons } from '@/components/forms/OAuthButtons';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';

export function LoginPage() {
  const { login, forgotPassword, capabilities } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as {
    from?: string;
    prefillEmail?: string;
    justRegistered?: boolean;
  } | null;
  const redirectTarget = locationState?.from ?? '/';
  const prefillEmail = (locationState?.prefillEmail ?? searchParams.get('email') ?? '').trim();
  const justRegistered = Boolean(locationState?.justRegistered);

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forgot password inline mode
  const [forgotMode, setForgotMode] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [prefillEmail]);

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (!forgotMode && password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setResetMessage(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (forgotMode) {
        const msg = await forgotPassword(email);
        setResetMessage(msg);
      } else {
        const profile = await login({ email, password, rememberMe });
        notify(`Welcome back, ${profile.fullName}.`, 'success');
        navigate(redirectTarget, { replace: true });
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow={forgotMode ? 'Account Recovery' : 'Member Entrance'}
      title={forgotMode ? 'Reset Passphrase' : 'Sign in to NOIR'}
      subtitle={
        forgotMode
          ? 'Enter the email associated with your screening room account.'
          : capabilities.supabaseConfigured
          ? 'Authenticate with your Supabase member credentials or linked provider.'
          : 'Sign in with a local studio account (Supabase is unconfigured — see .env.example).'
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-5">
        {justRegistered && !forgotMode && !serverError && !resetMessage && (
          <div className="flex items-start gap-2.5 border border-[#C6A46A]/40 bg-[#C6A46A]/10 px-3.5 py-3 text-xs text-[#F5F5F5]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#C6A46A]" />
            <span>
              Your NOIR account is ready. Enter your password below to sign in.
            </span>
          </div>
        )}

        {redirectTarget !== '/' && !justRegistered && !forgotMode && !serverError && (
          <div className="border border-[#C6A46A]/35 bg-[#C6A46A]/[0.06] px-3.5 py-2.5 text-xs text-[#e5e5e5]">
            Sign in with your member credentials to continue to <span className="font-mono-tech text-[#C6A46A]">{redirectTarget}</span>.
          </div>
        )}

        {serverError && (
          <div className="flex items-start gap-2.5 border border-red-400/35 bg-red-500/10 px-3.5 py-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        {resetMessage && (
          <div className="flex items-start gap-2.5 border border-[#C6A46A]/40 bg-[#C6A46A]/10 px-3.5 py-3 text-xs text-[#F5F5F5]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#C6A46A]" />
            <span>{resetMessage}</span>
          </div>
        )}

        <TextField
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="director@studio.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        {!forgotMode && (
          <TextField
            label="Password"
            isPassword
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
        )}

        <div className="flex items-center justify-between pt-0.5">
          {!forgotMode ? (
            <label className="inline-flex items-center gap-2.5 text-xs text-[#b5b5b5] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#C6A46A] bg-[#131313] border border-white/25 cursor-pointer"
              />
              <span>Remember me</span>
            </label>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => {
              setForgotMode((prev) => !prev);
              setServerError(null);
              setResetMessage(null);
              setErrors({});
            }}
            className="text-xs text-[#C6A46A] hover:underline cursor-pointer tracking-wide"
          >
            {forgotMode ? 'Back to Sign In' : 'Forgot password?'}
          </button>
        </div>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          loading={submitting}
          className="w-full"
          icon={<ArrowRight className="w-4 h-4" strokeWidth={1.75} />}
        >
          {forgotMode ? 'Send Recovery Link' : 'Enter Screening Room'}
        </Button>
      </form>

      {!forgotMode && (
        <>
          <div className="my-7 flex items-center gap-4">
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#757575]">
              Or Authenticate Via
            </span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <OAuthButtons mode="login" />
        </>
      )}

      <p className="mt-8 text-center text-xs text-[#929292]">
        New to NOIR?{' '}
        <Link to="/register" className="text-[#F5F5F5] hover:text-[#C6A46A] underline underline-offset-4 transition-colors">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
