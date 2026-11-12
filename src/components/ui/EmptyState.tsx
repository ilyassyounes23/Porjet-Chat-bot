import React from 'react';
import { Film } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="border border-white/[0.08] bg-[#111111]/80 px-6 py-16 text-center max-w-xl mx-auto my-10">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center border border-white/12 bg-[#181818] text-[#C6A46A]">
        {icon ?? <Film className="w-5 h-5" strokeWidth={1.5} />}
      </div>
      <h3 className="font-serif-display text-2xl sm:text-3xl font-medium text-[#F5F5F5] tracking-tight">
        {title}
      </h3>
      <p className="mt-2.5 text-sm text-[#929292] leading-relaxed max-w-md mx-auto">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button variant="ghost" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
