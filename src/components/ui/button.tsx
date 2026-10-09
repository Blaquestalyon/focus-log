'use client';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type MouseEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';
import { Tip } from './tooltip';

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type Size = 'md' | 'lg' | 'sm';

const VARIANT: Record<Variant, { base: string; live: string }> = {
  primary: { base: 'bg-accent text-on-accent', live: 'hover:bg-accent-hover active:bg-accent-pressed' },
  secondary: {
    base: 'bg-surface-raised text-text-primary border border-border-strong',
    live: 'hover:bg-surface-overlay active:bg-surface',
  },
  ghost: { base: 'bg-transparent text-text-secondary', live: 'hover:bg-surface-raised hover:text-text-primary active:bg-surface' },
  danger: { base: 'bg-danger text-white', live: 'hover:bg-danger-hover active:bg-danger-pressed' },
};

const SIZE: Record<Size, string> = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  sm: 'h-8 px-3 text-micro',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Tooltip shown (hover/focus) — required while disabled when the reason isn't obvious. */
  tip?: ReactNode;
  block?: boolean;
}

/**
 * The shared button with the full state matrix (§4): hover, focus-visible ring, pressed,
 * disabled (aria-disabled, 0.4 opacity, not-allowed, inert) and an in-flight spinner.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, loading, disabled, tip, block, className, children, onClick, type = 'button', ...rest },
  ref,
) {
  const inert = Boolean(disabled || loading);
  const v = VARIANT[variant];
  const btn = (
    <button
      ref={ref}
      type={type}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (inert) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
      className={cn(
        'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold transition-fast',
        SIZE[size],
        v.base,
        !inert && v.live,
        disabled && 'cursor-not-allowed opacity-40',
        loading && 'cursor-progress',
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
  return tip ? <Tip label={tip}>{btn}</Tip> : btn;
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'aria-label'> {
  label: string;
  tip?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
  size?: 'md' | 'sm';
}

/** 40×40 icon-only button; its label is both the accessible name and the tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tip, disabled, loading, children, className, onClick, size = 'md', type = 'button', ...rest },
  ref,
) {
  const inert = Boolean(disabled || loading);
  return (
    <Tip label={tip ?? label}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-disabled={inert || undefined}
        onClick={(e) => {
          if (inert) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-sm text-text-secondary transition-fast',
          size === 'md' ? 'size-10' : 'size-8',
          !inert && 'hover:bg-surface-raised hover:text-text-primary active:bg-surface',
          disabled && 'cursor-not-allowed opacity-40',
          className,
        )}
        {...rest}
      >
        {loading ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : children}
      </button>
    </Tip>
  );
});

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('kbd', className)}>{children}</kbd>;
}
