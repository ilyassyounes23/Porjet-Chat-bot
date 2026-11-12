import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090909] flex items-center justify-center pt-20 px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-6 h-6 border-2 border-[#C6A46A]/30 border-t-[#C6A46A] rounded-full animate-spin" />
          <p className="font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#929292]">
            Verifying Member Session
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    const target = `${location.pathname}${location.search}`;
    return <Navigate to="/login" state={{ from: target }} replace />;
  }

  return <>{children}</>;
}
