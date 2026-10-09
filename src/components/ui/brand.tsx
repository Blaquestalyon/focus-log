'use client';
/**
 * Brand motifs (§2): the four-point sparkle (from the owner's logo), the app mark, the gold
 * wordmark, project dots, and the fixed, seeded starfields on sign-in and the Timer stage.
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { ProjectColor } from '@/lib/types';
import { cn } from './cn';

/** Four-point star with concave sides, in a 24×24 box. */
export const SPARKLE_PATH =
  'M12 0C12.9 7.2 16.8 11.1 24 12C16.8 12.9 12.9 16.8 12 24C11.1 16.8 7.2 12.9 0 12C7.2 11.1 11.1 7.2 12 0Z';

export function Sparkle({ size = 12, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} className={className} style={style}>
      <path d={SPARKLE_PATH} />
    </svg>
  );
}

/** Empty-state mark: stroke-only sparkle, muted. */
export function SparkleOutline({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="-1 -1 26 26" width={size} height={size} className={cn('text-text-muted', className)}>
      <path d={SPARKLE_PATH} fill="none" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
    </svg>
  );
}

function GoldGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style={{ stopColor: 'var(--gold-1)' }} />
      <stop offset="0.42" style={{ stopColor: 'var(--gold-2)' }} />
      <stop offset="0.68" style={{ stopColor: 'var(--gold-3)' }} />
      <stop offset="1" style={{ stopColor: 'var(--gold-4)' }} />
    </linearGradient>
  );
}

/** App mark: a 16px metallic-gold sparkle inside a 24px ring with a 1.5px gold stroke. */
export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  const gid = `g${useId().replace(/:/g, '')}`;
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} className={cn('shrink-0', className)}>
      <defs>
        <GoldGradient id={gid} />
      </defs>
      <circle cx="12" cy="12" r="11.25" fill="none" style={{ stroke: 'var(--color-accent)' }} strokeWidth={1.5} />
      <g transform="translate(4 4) scale(0.6667)">
        <path d={SPARKLE_PATH} fill={`url(#${gid})`} />
      </g>
    </svg>
  );
}

/** "Focus Log" in the polished gold lettering. */
export function Wordmark({ className, as: Tag = 'span' }: { className?: string; as?: 'span' | 'h1' }) {
  return <Tag className={cn('wordmark text-gold', className)}>Focus Log</Tag>;
}

export function projectVar(color: ProjectColor | null | undefined): string {
  return color ? `var(--color-project-${color})` : 'var(--color-border-strong)';
}

export function ProjectDot({ color, className }: { color: ProjectColor | null | undefined; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-pill', className)}
      style={{ backgroundColor: projectVar(color) }}
    />
  );
}

// ------------------------------------------------------------------ starfield

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star { x: number; y: number; size: number; opacity: number }

/**
 * A fixed field of white sparkles. Candidate positions come from a fixed seed (identical on
 * every visit); stars whose box would touch any `avoid` element are skipped. Never animates.
 */
export function Starfield({
  count,
  seed,
  minSize,
  maxSize,
  minOpacity,
  maxOpacity,
  avoid,
  containerRef,
}: {
  count: number;
  seed: number;
  minSize: number;
  maxSize: number;
  minOpacity: number;
  maxOpacity: number;
  avoid: RefObject<HTMLElement | null>[];
  containerRef: RefObject<HTMLElement | null>;
}) {
  const candidates = useMemo<Star[]>(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: 200 }, () => ({
      x: rnd(),
      y: rnd(),
      size: Math.round(minSize + rnd() * (maxSize - minSize)),
      opacity: minOpacity + rnd() * (maxOpacity - minOpacity),
    }));
  }, [seed, minSize, maxSize, minOpacity, maxOpacity]);
  const [stars, setStars] = useState<(Star & { left: number; top: number })[]>([]);
  const avoidRef = useRef(avoid);
  avoidRef.current = avoid;

  // A passive effect, not a layout effect: a child's layout effect runs before the parent's ref
  // (the container) is attached, which left the field empty.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const pad = 6;
      const blocks = avoidRef.current
        .map((r) => r.current?.getBoundingClientRect())
        .filter((b): b is DOMRect => Boolean(b && b.width && b.height))
        .map((b) => ({ l: b.left - box.left - pad, t: b.top - box.top - pad, r: b.right - box.left + pad, b: b.bottom - box.top + pad }));
      const out: (Star & { left: number; top: number })[] = [];
      for (const c of candidates) {
        if (out.length >= count) break;
        const left = c.x * (box.width - c.size);
        const top = c.y * (box.height - c.size);
        const hit = blocks.some((k) => left < k.r && left + c.size > k.l && top < k.b && top + c.size > k.t);
        if (!hit) out.push({ ...c, left, top });
      }
      setStars(out);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    for (const r of avoidRef.current) if (r.current) ro.observe(r.current);
    return () => ro.disconnect();
  }, [candidates, count, containerRef]);

  return (
    <div className="starfield" aria-hidden>
      {stars.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={s.size}
          height={s.size}
          style={{ left: s.left, top: s.top, opacity: s.opacity }}
        >
          <path d={SPARKLE_PATH} />
        </svg>
      ))}
    </div>
  );
}
