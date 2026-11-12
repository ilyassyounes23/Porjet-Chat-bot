import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  isPassword?: boolean;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, isPassword = false, id, className = '', type, ...rest }, ref) => {
    const [visible, setVisible] = useState(false);
    const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const resolvedType = isPassword ? (visible ? 'text' : 'password') : (type ?? 'text');

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-[11px] uppercase tracking-[0.16em] text-[#929292] font-medium"
        >
          {label}
        </label>
        <div className="relative group">
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            aria-invalid={Boolean(error)}
            className={`w-full bg-[#131313] border px-3.5 py-3 text-sm text-[#F5F5F5] placeholder:text-[#555555] transition-colors duration-200 rounded-[2px] focus:outline-none ${
              error
                ? 'border-red-400/70 focus:border-red-400'
                : 'border-white/12 hover:border-white/22 focus:border-[#C6A46A]'
            } ${isPassword ? 'pr-11' : ''} ${className}`}
            {...rest}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setVisible((prev) => !prev)}
              aria-label={visible ? `Hide ${label}` : `Show ${label}`}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#929292] hover:text-[#F5F5F5] transition-colors p-1 cursor-pointer"
            >
              {visible ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
            </button>
          )}
        </div>
        {error ? (
          <p className="text-xs text-red-400/95 tracking-wide">{error}</p>
        ) : hint ? (
          <p className="text-[11px] text-[#6d6d6d]">{hint}</p>
        ) : null}
      </div>
    );
  }
);

TextField.displayName = 'TextField';
