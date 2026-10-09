'use client';
import { useRef, type ReactNode } from 'react';
import { Mark, Starfield } from '@/components/ui/brand';

/** Sign-in canvas: bg-0 with the fixed 14-sparkle field; a 400px card with a ribbon top edge. */
export function AuthCard({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  const canvas = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  return (
    <div ref={canvas} className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg-0 px-4 py-12">
      <Starfield count={14} seed={20261008} minSize={6} maxSize={14} minOpacity={0.04} maxOpacity={0.1} avoid={[card]} containerRef={canvas} />
      <main
        ref={card}
        className="ribbon-edge relative z-[1] w-full max-w-[var(--size-auth-card)] rounded-md border border-border bg-surface p-8"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <Mark size={40} />
          <h1 className="mt-4">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-text-secondary">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}

