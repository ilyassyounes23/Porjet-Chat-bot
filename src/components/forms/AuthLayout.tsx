import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function NoirWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        viewBox="0 0 28 28"
        className="w-6 h-6 text-[#C6A46A]"
        fill="none"
        aria-hidden="true"
      >
        <rect x="2" y="4" width="24" height="20" stroke="currentColor" strokeWidth="1.4" />
        <line x1="7" y1="4" x2="7" y2="24" stroke="currentColor" strokeWidth="1.1" />
        <line x1="21" y1="4" x2="21" y2="24" stroke="currentColor" strokeWidth="1.1" />
        <polygon points="12,10.5 17.5,14 12,17.5" fill="currentColor" />
      </svg>
      <span className="font-serif-display text-2xl font-semibold tracking-[0.28em] text-[#F5F5F5]">
        NOIR
      </span>
    </span>
  );
}

export function AuthLayout({ eyebrow, title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#090909] text-[#F5F5F5] grid grid-cols-1 lg:grid-cols-12 relative overflow-hidden">
      {/* Subtle film grain */}
      <div className="fixed inset-0 noir-grain z-50" />

      {/* Left Cinematic Exhibition Column */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative flex-col justify-between p-12 border-r border-white/[0.08] overflow-hidden bg-[#0c0c0c]">
        {/* Slow breathing monochrome architectural cinema atmosphere */}
        <motion.div
          initial={{ scale: 1.06, opacity: 0.7 }}
          animate={{ scale: 1.0, opacity: 0.9 }}
          transition={{ duration: 14, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="absolute inset-0 pointer-events-none"
        >
          <div
            className="w-full h-full bg-cover bg-center grayscale contrast-125 opacity-35"
            style={{
              backgroundImage:
                "url('https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Blade_Runner_-_47102814774.jpg/1280px-Blade_Runner_-_47102814774.jpg')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/65 to-[#090909]/85" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#090909]/70 via-transparent to-[#090909]" />
        </motion.div>

        {/* Top Bar */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <NoirWordmark />
          </Link>
          <span className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-[#929292]">
            Edition 01 — Archive Access
          </span>
        </div>

        {/* Center Editorial Frame */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-w-xl space-y-6 my-auto"
        >
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-[#C6A46A]" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#C6A46A]">
              Curated Streaming House
            </span>
          </div>
          <h2 className="font-serif-display text-5xl xl:text-6xl font-medium leading-[1.03] tracking-tight text-[#F5F5F5]">
            Cinema preserved in shadow, light, and{' '}
            <span className="italic font-normal text-[#C6A46A]">quiet precision.</span>
          </h2>
          <p className="text-sm text-[#929292] leading-relaxed max-w-md">
            Over five hundred essential works of world cinema—from restored silver-screen classics
            to contemporary auteur premieres—organized with editorial rigor.
          </p>
        </motion.div>

        {/* Bottom Colophon */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/[0.08] pt-5 text-[11px] font-mono-tech text-[#757575] uppercase tracking-[0.16em]">
          <span>24 FPS / 4K Mastering</span>
          <span>IMDb &amp; Critics Verified Metadata</span>
        </div>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-14 bg-[#090909] relative z-10">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#929292] hover:text-[#F5F5F5] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Back to Catalog</span>
          </Link>
          <Link to="/" className="lg:hidden">
            <NoirWordmark />
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md mx-auto my-10"
        >
          <p className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-[#C6A46A] mb-2">
            {eyebrow}
          </p>
          <h1 className="font-serif-display text-4xl font-medium text-[#F5F5F5] tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-sm text-[#929292] leading-relaxed">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </motion.div>

        <div className="text-[11px] text-[#606060] font-mono-tech tracking-wider text-center lg:text-left">
          NOIR STREAMING PLATFORM — PRIVATE SCREENING ROOM
        </div>
      </div>
    </div>
  );
}
