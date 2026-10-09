'use client';
/**
 * The timer on the client (§6 "The run and the clock"). The clock never counts ticks: every
 * redraw computes from the server's start time and `serverNow = Date.now() + offset`, where the
 * offset comes from each timer view's `server_now`. Refetches on focus, on becoming visible and
 * every 30 seconds while visible.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from '@/lib/client/toast';
import { apiTimed, ApiError, TIMER_NETWORK_MESSAGE } from '@/lib/client/api';
import { emit } from '@/lib/client/events';
import { formatClock, formatDuration } from '@/lib/format';
import { elapsedSeconds } from '@/lib/time';
import type { ClosedSession, TimerView } from '@/lib/types';
import { useUi, type StartInput } from './ui-context';
import { closeNudgeNotifications } from '@/lib/client/push';

export const DAY_SECONDS = 24 * 3600;

interface Ctx {
  view: TimerView | null;
  loading: boolean;
  error: ApiError | null;
  busy: string | null;
  serverNow: () => number;
  clockSeconds: (now: number) => number;
  sessionSeconds: (now: number) => number;
  over24: () => boolean;
  refresh: () => Promise<void>;
  start: (input: StartInput) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: (stopAt?: string, opts?: { fromDialog?: boolean }) => Promise<{ ok: boolean; error?: ApiError }>;
  stopThenStart: (stopAt: string, input: StartInput) => Promise<{ ok: boolean; error?: ApiError }>;
  discard: () => Promise<boolean>;
  acknowledge: () => Promise<void>;
  /** Bumps whenever a timer start should replay the digit entrance. */
  enterSeq: number;
  /** The last session a Pause/Stop/Switch logged (for the Today sparkle). */
  logged: { id: string; seq: number } | null;
  announcement: string;
}

const TimerCtx = createContext<Ctx | null>(null);

function startBody(input: StartInput) {
  return 'task_id' in input ? { task_id: input.task_id } : { task_name: input.task_name, project_id: input.project_id };
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const ui = useUi();
  const [view, setView] = useState<TimerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [enterSeq, setEnterSeq] = useState(0);
  const [logged, setLogged] = useState<{ id: string; seq: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const offsetRef = useRef(0);
  const viewRef = useRef<TimerView | null>(null);
  viewRef.current = view;

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const accept = useCallback((v: TimerView, sentAt: number, receivedAt: number) => {
    offsetRef.current = Date.parse(v.server_now) - (sentAt + receivedAt) / 2;
    setView(v);
    setError(null);
  }, []);

  const clockSeconds = useCallback((now: number) => {
    const v = viewRef.current;
    if (!v || v.status === 'idle' || !v.run) return 0;
    if (v.status === 'paused') return v.run.closed_seconds;
    const started = v.session ? Date.parse(v.session.started_at) : now;
    return v.run.closed_seconds + elapsedSeconds(started, now);
  }, []);

  const sessionSeconds = useCallback((now: number) => {
    const v = viewRef.current;
    if (!v || v.status !== 'running' || !v.session) return 0;
    return elapsedSeconds(Date.parse(v.session.started_at), now);
  }, []);

  const over24 = useCallback(() => sessionSeconds(serverNow()) >= DAY_SECONDS, [sessionSeconds, serverNow]);

  const refresh = useCallback(async () => {
    try {
      const r = await apiTimed<TimerView>('/api/timer');
      accept(r.data, r.sentAt, r.receivedAt);
    } catch (e) {
      if (e instanceof ApiError) setError(e);
    } finally {
      setLoading(false);
    }
  }, [accept]);

  // Initial load, focus/visibility refetch, and a 30-second poll while visible.
  useEffect(() => {
    void refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onFocus = () => void refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      clearInterval(iv);
    };
  }, [refresh]);

  const fail = useCallback(
    (e: unknown, opts: { silent?: boolean } = {}) => {
      const err = e instanceof ApiError ? e : new ApiError(0, 'NETWORK', TIMER_NETWORK_MESSAGE);
      if (!opts.silent && err.status !== 401) toast.error(err.message);
      if (err.code === 'FL_TASK_NOT_FOUND') emit('tasks-changed');
      void refresh();
      return err;
    },
    [refresh],
  );

  const post = useCallback(
    async (path: string, body?: unknown) => {
      const r = await apiTimed<TimerView>(path, { method: 'POST', body: body ?? {}, networkMessage: TIMER_NETWORK_MESSAGE });
      accept(r.data, r.sentAt, r.receivedAt);
      emit('sessions-changed');
      return r.data;
    },
    [accept],
  );

  const markLogged = useCallback((cs: ClosedSession | undefined) => {
    if (cs && !cs.dropped) setLogged((cur) => ({ id: cs.id, seq: (cur?.seq ?? 0) + 1 }));
  }, []);

  const startDirect = useCallback(
    async (input: StartInput, opts: { silentErrors?: boolean } = {}) => {
      const prev = viewRef.current;
      setBusy('start');
      try {
        const v = await post('/api/timer/start', startBody(input));
        const name = v.task?.name ?? input.label;
        if (v.unarchived) toast.success(`Unarchived ${name}.`);
        if (v.already_running) {
          toast(`${name} is already running.`);
        } else if (v.resumed) {
          toast(`Resumed ${name}.`);
          setAnnouncement(`Resumed ${name}`);
        } else if (v.closed_session) {
          const cs = v.closed_session;
          markLogged(cs);
          if (cs.dropped) toast('Under 5 seconds — nothing logged.');
          else toast.success(`Switched to ${name}. Logged ${formatDuration(cs.run_seconds)} to ${prev?.task?.name ?? 'the last task'}.`);
          setAnnouncement(`Switched to ${name}`);
          setEnterSeq((n) => n + 1);
          if (prev?.session) void closeNudgeNotifications(prev.session.id);
        } else {
          setAnnouncement(`Timer started: ${name}`);
          setEnterSeq((n) => n + 1);
        }
        emit('tasks-changed');
        return true;
      } catch (e) {
        const err = e instanceof ApiError ? e : null;
        if (err?.code === 'FL_STOP_TOO_LONG') {
          void refresh();
          ui.openStopAt(input);
          return false;
        }
        fail(e, { silent: opts.silentErrors });
        if (opts.silentErrors && err) toast.error(err.message);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [post, markLogged, fail, refresh, ui],
  );

  const start = useCallback(
    async (input: StartInput) => {
      if (busy) return false;
      if (over24()) {
        ui.openStopAt(input);
        return false;
      }
      return startDirect(input);
    },
    [busy, over24, startDirect, ui],
  );

  const pause = useCallback(async () => {
    if (busy) return;
    if (over24()) {
      ui.openStopAt();
      return;
    }
    setBusy('pause');
    try {
      const v = await post('/api/timer/pause');
      const cs = v.closed_session;
      if (cs?.dropped) toast('Under 5 seconds — nothing logged.');
      markLogged(cs);
      setAnnouncement(`Paused at ${formatClock(v.run?.closed_seconds ?? 0)}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'FL_STOP_TOO_LONG') {
        void refresh();
        ui.openStopAt();
      } else fail(e);
    } finally {
      setBusy(null);
    }
  }, [busy, over24, post, markLogged, fail, refresh, ui]);

  const resume = useCallback(async () => {
    if (busy) return;
    setBusy('resume');
    try {
      const v = await post('/api/timer/resume');
      setAnnouncement(`Resumed ${v.task?.name ?? ''}`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }, [busy, post, fail]);

  const undoStop = useCallback(
    async (cs: ClosedSession) => {
      try {
        const v = await post('/api/timer/undo-stop', { session_id: cs.id, restore: cs.from });
        setAnnouncement(v.status === 'running' ? `Resumed ${v.task?.name ?? ''}` : `Paused at ${formatClock(v.run?.closed_seconds ?? 0)}`);
      } catch (e) {
        fail(e);
      }
    },
    [post, fail],
  );

  const stop = useCallback(
    async (stopAt?: string, opts: { fromDialog?: boolean } = {}) => {
      if (busy && !opts.fromDialog) return { ok: false };
      if (!stopAt && !opts.fromDialog && over24()) {
        ui.openStopAt();
        return { ok: false };
      }
      const prev = viewRef.current;
      setBusy('stop');
      try {
        const v = await post('/api/timer/stop', stopAt ? { stop_at: stopAt } : {});
        const cs = v.closed_session;
        const name = prev?.task?.name ?? '';
        if (!cs) {
          toast('Timer stopped. Nothing was logged.');
          setAnnouncement('Stopped. Nothing was logged.');
        } else if (cs.dropped) {
          toast('Under 5 seconds — nothing logged.');
          setAnnouncement('Stopped. Nothing was logged.');
        } else {
          markLogged(cs);
          toast.success(`Logged ${formatDuration(cs.run_seconds)} to ${name}.`, {
            duration: 5000,
            action: { label: 'Undo', onClick: () => void undoStop(cs) },
          });
          setAnnouncement(`Stopped. Logged ${formatDuration(cs.run_seconds)}.`);
        }
        if (prev?.session) void closeNudgeNotifications(prev.session.id);
        return { ok: true };
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, 'NETWORK', TIMER_NETWORK_MESSAGE);
        if (opts.fromDialog && err.code.startsWith('FL_STOP_')) {
          void refresh();
          return { ok: false, error: err };
        }
        if (!opts.fromDialog && err.code === 'FL_STOP_TOO_LONG') {
          void refresh();
          ui.openStopAt();
          return { ok: false, error: err };
        }
        fail(e, { silent: false });
        return { ok: false, error: err };
      } finally {
        setBusy(null);
      }
    },
    [busy, over24, post, markLogged, undoStop, fail, refresh, ui],
  );

  const stopThenStart = useCallback(
    async (stopAt: string, input: StartInput) => {
      const r = await stop(stopAt, { fromDialog: true });
      if (!r.ok) return r;
      await startDirect(input, { silentErrors: true });
      return { ok: true };
    },
    [stop, startDirect],
  );

  const discard = useCallback(async () => {
    const prev = viewRef.current;
    setBusy('discard');
    try {
      await post('/api/timer/discard');
      if (prev?.session) void closeNudgeNotifications(prev.session.id);
      setAnnouncement('Timer discarded.');
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(null);
    }
  }, [post, fail]);

  const acknowledge = useCallback(async () => {
    const v = viewRef.current;
    if (!v?.session) return;
    try {
      await post('/api/timer/acknowledge-nudge', { session_id: v.session.id });
      void closeNudgeNotifications(v.session.id);
    } catch (e) {
      fail(e);
    }
  }, [post, fail]);

  const value = useMemo<Ctx>(
    () => ({
      view, loading, error, busy, serverNow, clockSeconds, sessionSeconds, over24, refresh, start, pause, resume, stop,
      stopThenStart, discard, acknowledge, enterSeq, logged, announcement,
    }),
    [view, loading, error, busy, serverNow, clockSeconds, sessionSeconds, over24, refresh, start, pause, resume, stop, stopThenStart, discard, acknowledge, enterSeq, logged, announcement],
  );

  return <TimerCtx.Provider value={value}>{children}</TimerCtx.Provider>;
}

export function useTimer(): Ctx {
  const c = useContext(TimerCtx);
  if (!c) throw new Error('TimerProvider missing');
  return c;
}
