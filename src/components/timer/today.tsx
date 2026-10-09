'use client';
/** Today panel (§4 Timer "Today panel", §2 Signature moment 2 "The logged sparkle"). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton, Tag } from '@/components/ui/feedback';
import { Sparkle, projectVar } from '@/components/ui/brand';
import { Tip } from '@/components/ui/tooltip';
import { useTimer } from '@/components/app/timer-context';
import { useUi } from '@/components/app/ui-context';
import { useSettings } from '@/components/app/settings-context';
import { SessionMenu } from '@/components/app/session-actions';
import { api, ApiError } from '@/lib/client/api';
import { useAlignedNow, useEvent, useReducedMotion } from '@/lib/client/hooks';
import { formatDateStr, formatDuration, formatTimeRange } from '@/lib/format';
import { elapsedSeconds, startOfLocalDay } from '@/lib/time';
import type { SessionRow, TodayResponse } from '@/lib/types';

/** Counts up from its old value to the new one over 400ms (instant under reduced motion). */
export function CountUp({ seconds, className }: { seconds: number; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(seconds);
  const from = useRef(seconds);
  useEffect(() => {
    if (reduced || from.current === seconds) {
      from.current = seconds;
      setShown(seconds);
      return;
    }
    const start = performance.now();
    const a = from.current;
    const b = seconds;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 400);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seconds, reduced]);
  return <span className={className}>{formatDuration(shown)}</span>;
}

function Row({ s, tz, dayStartMs, now, sparkleSeq }: { s: SessionRow; tz: string; dayStartMs: number; now: number; sparkleSeq: number | null }) {
  const running = !s.ended_at;
  const fromYesterday = Date.parse(s.started_at) < dayStartMs;
  // A running session is never zero: it reads `<1m` through its first minute, even between the minute redraws.
  const daySecs = running ? Math.max(1, elapsedSeconds(Math.max(Date.parse(s.started_at), dayStartMs), now)) : s.day_seconds ?? 0;
  const totalSecs = running ? elapsedSeconds(Date.parse(s.started_at), now) : s.duration_seconds ?? 0;
  const ui = useUi();
  const dur = <span className="tnum text-sm text-text-primary">{formatDuration(daySecs)}</span>;
  return (
    <div
      className={`group relative flex h-10 items-center gap-3 border-b border-border pl-4 pr-1 transition-fast last:border-b-0 hover:bg-surface-raised focus-visible:outline-offset-[calc(var(--size-focus)*-1)] ${running ? '' : 'cursor-pointer'}`}
      tabIndex={running ? undefined : 0}
      aria-label={running ? undefined : `Edit ${s.task.name}, ${formatTimeRange(s.started_at, s.ended_at, tz)}`}
      onClick={() => !running && ui.openEditSession(s)}
      onKeyDown={(e) => {
        if (!running && e.key === 'Enter' && e.target === e.currentTarget) ui.openEditSession(s);
      }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[var(--size-edge)]" style={{ backgroundColor: projectVar(s.project?.color) }} />
      <span className="tnum hidden w-36 shrink-0 text-sm text-text-secondary sm:block">{formatTimeRange(s.started_at, s.ended_at, tz)}</span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-sm text-text-primary">{s.task.name}</span>
        <span className="hidden truncate text-meta text-text-muted md:inline">{s.project?.name ?? 'No project'}</span>
      </span>
      <span className="hidden items-center gap-1 lg:flex">
        {s.source === 'manual' ? <Tag>Manual</Tag> : null}
        {s.edited ? <Tag>Edited</Tag> : null}
        {fromYesterday ? <Tag>From yesterday</Tag> : null}
        {running ? (
          <Tag>
            <span className="onair" style={{ width: 6, height: 6 }} aria-hidden />
            Running
          </Tag>
        ) : null}
      </span>
      <span className="relative w-16 shrink-0 text-right">
        {fromYesterday ? (
          <Tip label={`${formatDuration(totalSecs)} in total — ${formatDuration(daySecs)} of it today`}>
            <span tabIndex={0}>{dur}</span>
          </Tip>
        ) : (
          dur
        )}
        {sparkleSeq !== null ? <Sparkle key={sparkleSeq} className="logged-sparkle left-1/2 top-1/2" /> : null}
      </span>
      <SessionMenu session={s} context="today" />
    </div>
  );
}

export function TodayPanel() {
  const timer = useTimer();
  const ui = useUi();
  const { tz } = useSettings();
  const reduced = useReducedMotion();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await api<TodayResponse>('/api/today'));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, tz]);
  useEvent(['sessions-changed', 'data-changed', 'settings-changed'], () => void load());
  const running = timer.view?.status === 'running';
  const now = useAlignedNow(timer.serverNow, 60_000, running);

  // Which logged session gets the sparkle.
  const [sparkle, setSparkle] = useState<{ id: string; seq: number } | null>(null);
  useEffect(() => {
    if (timer.logged) setSparkle(timer.logged);
  }, [timer.logged]);

  if (!data && error) {
    return (
      <section aria-label="Today" className="rounded-md border border-border bg-surface">
        <ErrorState title="Couldn't load today's sessions." onRetry={() => void load()} />
      </section>
    );
  }

  if (!data) {
    return (
      <section aria-label="Today" aria-busy className="rounded-md border border-border bg-surface">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-16" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-10 items-center gap-3 border-b border-border px-4 last:border-b-0">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </section>
    );
  }

  const dayStartMs = startOfLocalDay(data.date, data.time_zone).getTime();
  const nowMs = running ? Math.max(now, timer.serverNow()) : timer.serverNow();
  const total = data.sessions.reduce((sum, s) => {
    if (s.ended_at) return sum + (s.day_seconds ?? 0);
    return sum + Math.max(1, elapsedSeconds(Math.max(Date.parse(s.started_at), dayStartMs), nowMs));
  }, 0);

  return (
    <section aria-label="Today" className="rounded-md border border-border bg-surface">
      <div className="flex h-12 items-center gap-3 border-b border-border px-4">
        <h2 className="micro-label">Today</h2>
        <span className="text-meta text-text-secondary">{formatDateStr(data.date, data.time_zone)}</span>
        <CountUp seconds={total} className="tnum ml-auto text-h2 font-semibold text-text-primary" />
      </div>
      {data.sessions.length === 0 ? (
        <EmptyState
          title="Nothing on the clock yet today."
          body="Type what you're working on and press Start, or pick a saved task."
          actions={
            <Button variant="primary" onClick={() => ui.focusTaskInput()}>
              Start a timer
            </Button>
          }
        />
      ) : (
        <div role="list" aria-label="Today's sessions">
          <AnimatePresence initial={false}>
            {data.sessions.map((s) => (
              <motion.div
                role="listitem"
                key={s.id}
                layout={!reduced}
                initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, height: 40 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: reduced ? 0.12 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: 'visible' }}
              >
                <Row s={s} tz={data.time_zone} dayStartMs={dayStartMs} now={nowMs} sparkleSeq={sparkle?.id === s.id ? sparkle.seq : null} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <div className="border-t border-border px-2 py-2">
        <Button variant="ghost" icon={<Plus className="size-4" aria-hidden />} onClick={() => ui.openAddTime({ date: data.date })}>
          Add time
        </Button>
      </div>
    </section>
  );
}
