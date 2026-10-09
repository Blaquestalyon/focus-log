'use client';
/**
 * Keyboard shortcuts (§4): ⌘K/Ctrl K palette, N focus task input, P pause/resume, S stop,
 * A add time, G then T/R/H/D/S navigation, ? shortcuts. Never while typing in a text field,
 * and never while a dialog is open (Esc there closes the topmost layer).
 */
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isTyping } from '@/lib/client/hooks';
import { todayStr } from '@/lib/time';
import { useUi } from './ui-context';
import { useTimer } from './timer-context';
import { useSettings } from './settings-context';

const GO: Record<string, string> = { t: '/', r: '/reports', h: '/history', d: '/data', s: '/settings' };

export function Shortcuts() {
  const ui = useUi();
  const timer = useTimer();
  const { tz } = useSettings();
  const router = useRouter();
  const pathname = usePathname();
  const gPending = useRef<number>(0);
  const ref = useRef({ ui, timer, tz, router, pathname });
  ref.current = { ui, timer, tz, router, pathname };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { ui, timer, tz, router, pathname } = ref.current;
      if (e.defaultPrevented || isTyping(e.target)) return;
      const modal = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"]');
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault();
        ui.setPalette(!ui.palette);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || modal) return;
      if (gPending.current && Date.now() - gPending.current < 1500) {
        gPending.current = 0;
        const dest = GO[key];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        return;
      }
      switch (e.key) {
        case 'g':
        case 'G':
          gPending.current = Date.now();
          return;
        case 'n':
        case 'N':
          e.preventDefault();
          if (pathname !== '/') {
            router.push('/');
            setTimeout(() => ref.current.ui.focusTaskInput(), 300);
          } else ui.focusTaskInput();
          return;
        case 'p':
        case 'P':
          e.preventDefault();
          if (timer.view?.status === 'running') void timer.pause();
          else if (timer.view?.status === 'paused') void timer.resume();
          return;
        case 's':
        case 'S':
          if (timer.view?.status === 'running' || timer.view?.status === 'paused') {
            e.preventDefault();
            void timer.stop();
          }
          return;
        case 'a':
        case 'A':
          e.preventDefault();
          ui.openAddTime({ date: todayStr(tz) });
          return;
        case '?':
          e.preventDefault();
          ui.setShortcuts(true);
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
