'use client';
/**
 * Side effects of the running timer that live outside any one screen:
 * the tab title (§2 "Tab title"), the background-tab nudge flash (F8 step 3) and the in-tab
 * pop-up fallback for browsers with permission but no push sign-up (§6 "In-tab fallback").
 */
import { useEffect, useRef } from 'react';
import { useTimer } from './timer-context';
import { useSettings } from './settings-context';
import { formatClock, formatDuration } from '@/lib/format';
import { useAlignedNow, safeLocal } from '@/lib/client/hooks';
import { currentSubscription, permission, showTabNotification } from '@/lib/client/push';

export function useNudgeActive(now: number): boolean {
  const { view, sessionSeconds } = useTimer();
  const { settings } = useSettings();
  if (!view || view.status !== 'running' || !view.session || !view.nudge) return false;
  if (view.nudge.acknowledged) return false;
  const after = (settings?.nudge_after_minutes ?? view.nudge.after_minutes) * 60;
  return sessionSeconds(now) >= after;
}

export function TimerEffects() {
  const { view, serverNow, clockSeconds, sessionSeconds } = useTimer();
  const { settings } = useSettings();
  const active = view?.status === 'running' || view?.status === 'paused';
  const now = useAlignedNow(serverNow, 1000, active);
  const nudge = useNudgeActive(now);
  const flip = useRef(false);

  // Tab title, updated every second; alternates with the nudge line while hidden.
  useEffect(() => {
    if (!view || view.status === 'idle' || !view.task) {
      document.title = 'Focus Log';
      return;
    }
    const base = `${view.status === 'running' ? '▶' : '❚❚'} ${formatClock(clockSeconds(now))} · ${view.task.name} — Focus Log`;
    if (nudge && document.visibilityState === 'hidden') {
      flip.current = !flip.current;
      document.title = flip.current ? `⚠ Still running · ${formatDuration(sessionSeconds(now))}` : base;
    } else {
      flip.current = false;
      document.title = base;
    }
  }, [view, now, nudge, clockSeconds, sessionSeconds]);

  // In-tab fallback pop-up, once per session per browser.
  useEffect(() => {
    if (!nudge || !view?.session || !view.task || !settings?.nudge_browser_enabled) return;
    if (permission() !== 'granted') return;
    const sid = view.session.id;
    const key = `fl-nudged-${sid}`;
    const ls = safeLocal();
    if (ls?.getItem(key)) return;
    let cancelled = false;
    void (async () => {
      const sub = await currentSubscription();
      if (cancelled || sub) return; // a browser with a push sign-up never shows a second pop-up
      ls?.setItem(key, '1');
      await showTabNotification(
        'Focus Log: timer still running',
        `${view.task!.name} has been running for ${formatDuration(sessionSeconds(serverNow()))}.`,
        `fl-nudge-${sid}`,
        `/?nudge=${sid}`,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [nudge, view, settings?.nudge_browser_enabled, sessionSeconds, serverNow]);

  return null;
}
