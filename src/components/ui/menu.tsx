'use client';
import * as M from '@radix-ui/react-dropdown-menu';
import { forwardRef, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './button';
import { Tip } from './tooltip';

/** ⋯ overflow menu (§4 "Menus"): arrow keys, Enter selects, Esc closes, destructive last. */
export function MoreMenu({
  children,
  label = 'More actions',
  align = 'end',
  triggerClassName,
}: {
  children: ReactNode;
  label?: string;
  align?: 'start' | 'end';
  triggerClassName?: string;
}) {
  return (
    <M.Root modal={false}>
      <M.Trigger asChild>
        <IconButton label={label} className={triggerClassName} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" aria-hidden />
        </IconButton>
      </M.Trigger>
      <MenuContent align={align}>{children}</MenuContent>
    </M.Root>
  );
}

export const MenuRoot = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={4}
        collisionPadding={8}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'anim-menu z-[var(--z-dropdown)] min-w-48 rounded-md border border-border bg-surface-raised p-1 shadow-overlay',
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

/**
 * The ⋯ trigger of the menu whose item was just chosen. A dialog opened from a menu item mounts as
 * the menu (and the focused item) is removed, so it cannot see where focus came from; it takes this
 * instead and returns focus there when it closes (§4: focus returns to the trigger).
 */
let menuReturn: { el: HTMLElement; at: number } | null = null;

export function takeMenuReturnTarget(): HTMLElement | null {
  const r = menuReturn;
  menuReturn = null;
  return r && Date.now() - r.at < 2000 && r.el.isConnected ? r.el : null;
}

function rememberMenuTrigger(item: EventTarget | null) {
  const menu = item instanceof HTMLElement ? item.closest('[role="menu"]') : null;
  const trigger = menu?.id ? document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(menu.id)}"]`) : null;
  menuReturn = trigger ? { el: trigger, at: Date.now() } : null;
}

export const MenuItem = forwardRef<
  HTMLDivElement,
  { children: ReactNode; icon?: ReactNode; danger?: boolean; disabled?: boolean; tip?: string; onSelect?: () => void }
>(function MenuItem({ children, icon, danger, disabled, tip, onSelect }, ref) {
  const item = (
    <M.Item
      ref={ref}
      disabled={disabled}
      onSelect={(e) => {
        rememberMenuTrigger(e.currentTarget ?? e.target);
        onSelect?.();
      }}
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm outline-none transition-fast',
        danger ? 'text-danger-text' : 'text-text-primary',
        'data-[highlighted]:bg-surface-overlay',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
      )}
    >
      {icon ? <span className={cn('inline-flex size-4 items-center justify-center', danger ? 'text-danger-text' : 'text-text-secondary')}>{icon}</span> : null}
      <span className="flex-1">{children}</span>
    </M.Item>
  );
  if (disabled && tip) {
    return (
      <Tip label={tip} side="left">
        <div>{item}</div>
      </Tip>
    );
  }
  return item;
});

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-border" />;
}
