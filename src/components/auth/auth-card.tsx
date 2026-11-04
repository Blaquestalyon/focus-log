'use client';
import { useRef, type ReactNode } from 'react';
import { Mark, Starfield } from '@/components/ui/brand';

/**
 * Welcome canvas (sign-in and set-password): the welcome art beside a 400px glass card with a
 * ribbon top edge, over the room's light and a twinkling sparkle field. Stacks below 1024px.
 */
export function AuthCard({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  const canvas = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLElement>(null);
  const card = useRef<HTMLElement>(null);
  return (
    <div ref={canvas} className="relative flex min-h-dvh items-center overflow-hidden px-4 py-8 md:px-8 lg:py-12">
      <Starfield count={18} seed={20261008} minSize={6} maxSize={14} minOpacity={0.08} maxOpacity={0.22} avoid={[art, card]} containerRef={canvas} />
      <main className="relative z-[1] mx-auto grid w-full max-w-[var(--size-welcome)] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_var(--size-auth-card)] lg:gap-12">
        <figure ref={art} className="welcome-art">
          <img
            src="/brand/welcome.webp"
            width={1672}
            height={941}
            fetchPriority="high"
            alt="Focus Log. Own your focus. Track your work. A private focus and time-tracking app built for individuals, shown on a laptop with its Timer, Reports, History, Settings and Your data screens."
            className="block h-auto w-full"
          />
        </figure>
        <section ref={card} className="panel panel-gold welcome-card ribbon-edge w-full max-w-[var(--size-auth-card)] justify-self-center p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Mark size={40} />
            <h1 className="mt-4">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-text-secondary">{subtitle}</p> : null}
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}
