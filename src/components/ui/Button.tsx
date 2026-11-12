import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      icon,
      children,
      className = '',
      disabled,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2.5 font-medium tracking-[0.04em] transition-all duration-200 select-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed rounded-[2px]';

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-[#F5F5F5] text-[#090909] hover:bg-[#FFFFFF] active:scale-[0.99] border border-transparent',
      accent:
        'bg-[#C6A46A] text-[#090909] hover:bg-[#d3b37c] active:scale-[0.99] border border-[#C6A46A]',
      secondary:
        'bg-[#181818] text-[#F5F5F5] hover:bg-[#242424] border border-white/12 hover:border-white/25',
      ghost:
        'bg-transparent text-[#F5F5F5]/85 hover:text-[#F5F5F5] hover:bg-white/[0.06] border border-white/15 hover:border-white/30',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'text-xs px-3.5 py-2 uppercase tracking-[0.09em]',
      md: 'text-xs px-5 py-2.5 uppercase tracking-[0.1em]',
      lg: 'text-[13px] px-6 py-3.5 uppercase tracking-[0.11em]',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...rest}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
