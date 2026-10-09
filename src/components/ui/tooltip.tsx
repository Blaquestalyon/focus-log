'use client';
import * as T from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <T.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </T.Provider>
  );
}

/** Hover and keyboard-focus tooltip (400ms delay, 140ms fade). */
export function Tip({
  label,
  children,
  side = 'top',
  disabled,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}) {
  if (disabled || !label) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="anim-tooltip z-[var(--z-tooltip)] max-w-80 rounded-sm border border-border bg-surface-overlay p-2 text-micro text-text-primary"
        >
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
