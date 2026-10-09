'use client';
import { useEffect, useRef, useState } from 'react';
import { on, type AppEvent } from './events';

/** Re-run `fn` whenever any of the named events fires. */
export function useEvent(names: AppEvent | AppEvent[], fn: (detail?: unknown) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  const key = Array.isArray(names) ? names.join(',') : names;
  useEffect(() => {
    const offs = key.split(',').map((n) => on(n as AppEvent, (d) => ref.current(d)));
    return () => offs.forEach((o) => o());
  }, [key]);
}

/** prefers-reduced-motion */
export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const f = () => setR(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return r;
}

export function useMediaQuery(q: string): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setR(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return r;
}

/** A value that re-renders every `ms`, aligned to whole multiples of `ms` of `nowFn()`. */
export function useAlignedNow(nowFn: () => number, ms = 1000, enabled = true): number {
  const [now, setNow] = useState(() => nowFn());
  const fnRef = useRef(nowFn);
  fnRef.current = nowFn;
  useEffect(() => {
    if (!enabled) return;
    let t: ReturnType<typeof setTimeout>;
    let raf = 0;
    const schedule = () => {
      const n = fnRef.current();
      const wait = ms - (n % ms) + 5;
      t = setTimeout(() => {
        raf = requestAnimationFrame(() => {
          setNow(fnRef.current());
          schedule();
        });
      }, wait);
    };
    setNow(fnRef.current());
    schedule();
    const vis = () => setNow(fnRef.current());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [ms, enabled]);
  return now;
}

/** True when keyboard focus is in a text field (shortcuts must not fire). */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'range', 'color'].includes(type);
  }
  return el.isContentEditable;
}

export function safeLocal() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
