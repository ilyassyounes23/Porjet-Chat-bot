import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { AuthLayout } from '@/components/forms/AuthLayout';
import { TextField } from '@/components/forms/TextField';
import { OAuthButtons } from '@/components/forms/OAuthButtons';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';

export function RegisterPage() {
  const { register, capabilities } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationNote, setConfirmationNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) {
      next.fullName = 'Please enter your full name.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (password.length < 8) {
      next.password = 'Use at least 8 characters for your password.';
    }
    if (confirmPassword !== password) {
      next.confirmPassword = 'Passwords do not match.';
    }
    if (!acceptedTerms) {
      next.terms = 'You must agree to the Terms of Screening & Privacy Policy.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setConfirmationNote(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await register({ fullName, email, password });
      const cleanEmail = email.trim().toLowerCase();
      if (result.requiresEmailConfirmation) {
        setConfirmationNote(
          `Account created for ${cleanEmail}, but Supabase still has "Confirm email" enabled. Disable "Confirm email" in Supabase Dashboard → Authentication → Providers → Email so new members can sign in immediately without verification emails.`
        );
      } else {
        notify('Account created. Sign in with your email and password.', 'success');
        navigate(`/login?email=${encodeURIComponent(cleanEmail)}`, {
          replace: true,
          state: { prefillEmail: cleanEmail, justRegistered: true },
        });
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="New Membership"
      title="Join NOIR"
      subtitle={
        capabilities.supabaseConfigured
          ? 'Create your profile to synchronize watchlists and viewing history across devices.'
          : 'Create a local studio profile to save your watchlist and viewing history immediately.'
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
        {serverError && (
          <div className="flex items-start gap-2.5 border border-red-400/35 bg-red-500/10 px-3.5 py-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        {confirmationNote && (
          <div className="flex items-start gap-2.5 border border-[#C6A46A]/40 bg-[#C6A46A]/10 px-3.5 py-3 text-xs text-[#F5F5F5]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#C6A46A]" />
            <span>{confirmationNote}</span>
          </div>
        )}

        <TextField
          label="Full Name"
          autoComplete="name"
          placeholder="Claire Denis"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
        />

        <TextField
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="claire@cinema.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Password"
            isPassword
            autoComplete="new-password"
            placeholder="Min. 8 chars"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <TextField
            label="Confirm Password"
            isPassword
            autoComplete="new-password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
          />
        </div>

        <div className="space-y-1 pt-1">
          <label className="flex items-start gap-2.5 text-xs text-[#b5b5b5] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 accent-[#C6A46A] bg-[#131313] border border-white/25 cursor-pointer"
            />
            <span className="leading-relaxed">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-[#C6A46A] hover:underline cursor-pointer"
              >
                Terms of Screening &amp; Privacy Notice
              </button>
              .
            </span>
          </label>
          {errors.terms && <p className="text-xs text-red-400">{errors.terms}</p>}
        </div>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          loading={submitting}
          className="w-full mt-2"
          icon={<ArrowRight className="w-4 h-4" strokeWidth={1.75} />}
        >
          Create Membership
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#757575]">
          Or Register With
        </span>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>

      <OAuthButtons mode="register" />

      <p className="mt-7 text-center text-xs text-[#929292]">
        Already a member?{' '}
        <Link to="/login" className="text-[#F5F5F5] hover:text-[#C6A46A] underline underline-offset-4 transition-colors">
          Sign in
        </Link>
      </p>

      {showTermsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Terms of Screening"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="bg-[#111111] border border-white/15 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="font-serif-display text-2xl text-[#F5F5F5]">
                Terms of Screening &amp; Privacy
              </h2>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                aria-label="Close terms"
                className="text-[#929292] hover:text-[#F5F5F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-[#b5b5b5] space-y-2.5 leading-relaxed">
              <p>
                NOIR respects copyright and content licensing. Commercial films present curated
                metadata, official trailers, and legitimate public rating integrations; full-feature
                playback is reserved strictly for public-domain archives and authorized open-cinema
                works.
              </p>
              <p>
                When Supabase is configured, your account profile, watchlist, and playback progress
                are stored under Row-Level Security policies tied strictly to your user ID. In local
                demo mode, credentials remain strictly inside your browser storage.
              </p>
            </div>
            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setAcceptedTerms(true);
                  setShowTermsModal(false);
                }}
              >
                Accept &amp; Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
