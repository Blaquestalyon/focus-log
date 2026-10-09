'use client';
import * as T from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from './cn';

export const TabsRoot = T.Root;
/**
 * Tab panel. Radix makes it focusable (one Tab stop into the panel), so it shows the same gold
 * focus ring as everything else, even where a screen passes `outline-none`.
 */
export function TabsContent({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  return (
    <T.Content
      value={value}
      className={cn(className, 'focus-visible:outline-solid focus-visible:outline-[length:var(--size-focus)] focus-visible:outline-accent focus-visible:outline-offset-2')}
    >
      {children}
    </T.Content>
  );
}

export function TabsList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <T.List aria-label={label} className="flex gap-1 border-b border-border">
      {children}
    </T.List>
  );
}

/** Selected tab: 2px gold underline. Arrow keys move between tabs (Radix). */
export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Trigger
      value={value}
      className={cn(
        'relative -mb-px h-10 px-3 text-sm text-text-secondary transition-fast hover:text-text-primary',
        'border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-text-primary',
      )}
    >
      {children}
    </T.Trigger>
  );
}
