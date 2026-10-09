'use client';
import * as D from '@radix-ui/react-dialog';
import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Button, IconButton } from './button';

export const DialogRoot = D.Root;
export const DialogClose = D.Close;

/**
 * Modal dialog (§4 "Dialogs"): 480px (560px wide), overlay surface, overlay shadow, dimmed
 * backdrop, focus trapped, Esc/Cancel close and focus returns to the trigger.
 */
export function DialogContent({
  title,
  description,
  children,
  footer,
  wide,
  className,
  onOpenAutoFocus,
  hideClose,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
  onOpenAutoFocus?: (e: Event) => void;
  hideClose?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="anim-backdrop fixed inset-0 z-[var(--z-dialog)] bg-backdrop" />
      <D.Content
        onOpenAutoFocus={onOpenAutoFocus}
        aria-describedby={description ? undefined : undefined}
        className={cn(
          'anim-dialog dialog-center z-[var(--z-dialog)] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col rounded-md border border-border bg-surface-overlay shadow-overlay',
          className,
        )}
        style={{ maxWidth: wide ? 'var(--size-dialog-wide)' : 'var(--size-dialog)' }}
      >
        <div className="flex items-start gap-4 px-6 pt-6">
          <div className="min-w-0 flex-1">
            <D.Title className="section-heading text-text-primary">{title}</D.Title>
            {description ? (
              <D.Description className="mt-2 text-sm text-text-secondary">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>
            )}
          </div>
          {!hideClose && (
            <D.Close asChild>
              <IconButton label="Close" className="-mr-2 -mt-2">
                <X className="size-4" aria-hidden />
              </IconButton>
            </D.Close>
          )}
        </div>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4">{children}</div> : null}
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 px-6 pb-6 pt-6">{footer}</div> : <div className="pb-6" />}
      </D.Content>
    </D.Portal>
  );
}

/**
 * Confirm dialog for destructive actions: the title names the thing, the danger button repeats
 * the verb, and the button shows a spinner until the server answers.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  danger = true,
  children,
  confirmDisabled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<boolean | void> | boolean | void;
  danger?: boolean;
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <DialogRoot open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        title={title}
        description={description}
        footer={
          <>
            <D.Close asChild>
              <Button variant="ghost" disabled={busy}>
                Cancel
              </Button>
            </D.Close>
            <Button
              variant={danger ? 'danger' : 'primary'}
              loading={busy}
              disabled={confirmDisabled}
              onClick={async () => {
                setBusy(true);
                try {
                  const keepOpen = (await onConfirm()) === false;
                  if (!keepOpen) onOpenChange(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {children}
      </DialogContent>
    </DialogRoot>
  );
}
