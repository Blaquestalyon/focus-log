'use client';
import * as P from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { useDropdownLayer } from './layer';

export const PopoverRoot = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({
  children,
  className,
  align = 'start',
  onOpenAutoFocus,
}: {
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end' | 'center';
  onOpenAutoFocus?: (e: Event) => void;
}) {
  const layer = useDropdownLayer();
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={4}
        collisionPadding={8}
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn('anim-menu rounded-md border border-border bg-surface-raised p-1 shadow-overlay', layer, className)}
      >
        {children}
      </P.Content>
    </P.Portal>
  );
}
