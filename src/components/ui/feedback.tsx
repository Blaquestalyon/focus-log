'use client';
import type { ReactNode, CSSProperties } from 'react';
import { CircleAlert, X } from 'lucide-react';
import { cn } from './cn';
import { Button, IconButton } from './button';
import { SparkleOutline } from './brand';

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn('skeleton', className)} style={style} />;
}

/** Designed empty state: mark, headline in the app's voice, one line of guidance, an action. */
export function EmptyState({
  icon,
  title,
  body,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 text-text-muted">{icon ?? <SparkleOutline size={40} />}</div>
      <h3 className="card-heading text-text-primary">{title}</h3>
      {body ? <p className="mt-2 max-w-md text-sm text-text-secondary">{body}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body = 'Check your connection, then try again.',
  onRetry,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <CircleAlert className="mb-4 size-10 text-danger-text" strokeWidth={1.5} aria-hidden />
      <h3 className="card-heading text-text-primary">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-text-secondary">{body}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Notice above the stage / page content (§4 Timer "Notices"). */
export function Notice({
  title,
  body,
  icon,
  actions,
  onDismiss,
  edge,
  role,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
  edge?: 'warning' | 'danger';
  role?: 'alert' | 'status';
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        'relative flex items-start gap-3 overflow-hidden rounded-md border border-border bg-surface p-4',
        className,
      )}
    >
      {edge ? (
        <span
          aria-hidden
          className={cn('absolute inset-y-0 left-0 w-[var(--size-edge)]', edge === 'danger' ? 'bg-danger-text' : 'bg-warning')}
        />
      ) : null}
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-text-primary">{title}</div>
        {body ? <div className="mt-1 text-sm text-text-secondary">{body}</div> : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {onDismiss ? (
        <IconButton label="Dismiss" onClick={onDismiss} className="-mr-2 -mt-2">
          <X className="size-4" aria-hidden />
        </IconButton>
      ) : null}
    </div>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('tag', className)}>{children}</span>;
}
