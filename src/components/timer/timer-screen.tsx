'use client';
/** Timer screen (§4 "Screen: Timer"), route `/`. */
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AlarmClock, Plus } from 'lucide-react';
import { PageHeader } from '@/components/app/shell';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/feedback';
import { useTimer } from '@/components/app/timer-context';
import { useUi } from '@/components/app/ui-context';
import { useSettings } from '@/components/app/settings-context';
import { useNudgeActive } from '@/components/app/timer-effects';
import { ExampleNotice, StatusNotice, TimeZoneNotice, WelcomeNotice, useDataSummary } from '@/components/app/notices';
import { Stage } from './stage';
import { RecentRow } from './recent';
import { TodayPanel } from './today';
import { formatDayLong, formatDuration, formatTime } from '@/lib/format';
import { useAlignedNow, safeLocal } from '@/lib/client/hooks';
import { allowAlerts, permission, pushSupport } from '@/lib/client/push';
import { api } from '@/lib/client/api';
import { toast } from '@/lib/client/toast';
import { todayStr } from '@/lib/time';
import type { PushSubscriptionsResponse } from '@/lib/types';

function NudgeBanner() {
  const timer = useTimer();
  const ui = useUi();
  const { tz } = useSettings();
  const now = useAlignedNow(timer.serverNow, 60_000, timer.view?.status === 'running');
  const active = useNudgeActive(Math.max(now, timer.serverNow()));
  const v = timer.view;
  if (!active || !v?.session || !v.task) return null;
  const secs = timer.sessionSeconds(timer.serverNow());
  return (
    <div role="alert" className="relative flex items-start gap-3 overflow-hidden rounded-md border border-border bg-surface-raised p-4">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[var(--size-edge)] bg-warning" />
      <AlarmClock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-text-primary">Your timer has been running for {formatDuration(secs)}.</div>
        <div className="mt-1 text-sm text-text-secondary">
          Still on {v.task.name}? It&apos;s been running since {formatTime(v.session.started_at, tz)} without a pause.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void timer.acknowledge()}>
            Keep going
          </Button>
          <Button variant="primary" loading={timer.busy === 'stop'} onClick={() => void timer.stop()}>
            Stop now
          </Button>
          <Button variant="ghost" onClick={() => ui.openStopAt()}>
            Stop at…
          </Button>
        </div>
      </div>
    </div>
  );
}

/** "Want a pop-up on this computer…" — shown once, after the first timer start. */
function AlertPrompt() {
  const { settings } = useSettings();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const check = () => {
      const ls = safeLocal();
      setShow(
        Boolean(ls?.getItem('fl-started-once')) &&
          !ls?.getItem('fl-notify-prompt-dismissed') &&
          permission() === 'default' &&
          pushSupport().canPush,
      );
    };
    check();
    window.addEventListener('fl-started', check);
    return () => window.removeEventListener('fl-started', check);
  }, []);
  if (!show || !settings?.nudge_browser_enabled) return null;
  const dismiss = () => {
    safeLocal()?.setItem('fl-notify-prompt-dismissed', '1');
    setShow(false);
  };
  return (
    <Notice
      title="Want a pop-up on this computer if a timer runs too long?"
      body="It appears even with Focus Log closed, as long as your browser is open. The reminder email arrives either way."
      actions={
        <>
          <Button
            variant="secondary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const cfg = await api<PushSubscriptionsResponse>('/api/push/subscriptions');
                if (!cfg.configured) {
                  toast.error("Pop-up alerts aren't set up yet.");
                  return;
                }
                const r = await allowAlerts(cfg.public_key);
                if (r === 'on') toast.success('Pop-up alerts are on for this browser.');
                else if (r === 'blocked') toast.error("Alerts are blocked. You'll still get the reminder email.");
                else if (r === 'failed') toast.error("This browser couldn't turn on pop-ups. You'll still get the reminder email.");
                if (r !== 'dismissed') dismiss();
              } catch {
                toast.error("This browser couldn't turn on pop-ups. You'll still get the reminder email.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Allow alerts
          </Button>
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </>
      }
      onDismiss={dismiss}
    />
  );
}

export function TimerScreen() {
  const ui = useUi();
  const timer = useTimer();
  const { tz } = useSettings();
  const { summary } = useDataSummary();
  const sp = useSearchParams();
  const router = useRouter();
  const handled = useRef<string | null>(null);

  // `/?nudge=<session_id>` from the email or a pop-up opens Stop at… (F9).
  const nudge = sp.get('nudge');
  useEffect(() => {
    if (!nudge || timer.loading || !timer.view || handled.current === nudge) return;
    handled.current = nudge;
    if (timer.view.status === 'running' && timer.view.session?.id === nudge) ui.openStopAt();
    else toast.info('That timer was already stopped.');
    router.replace('/');
  }, [nudge, timer.loading, timer.view, ui, router]);

  const [today, setToday] = useState('');
  useEffect(() => setToday(formatDayLong(todayStr(tz), tz)), [tz]);

  return (
    <>
      <PageHeader
        title="Timer"
        subtitle={today}
        actions={
          <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => ui.openAddTime({ date: todayStr(tz) })}>
            Add time
          </Button>
        }
      />
      <div className="flex flex-col gap-3 empty:hidden">
        <StatusNotice />
        <ExampleNotice />
        <WelcomeNotice summary={summary} />
        <TimeZoneNotice />
        <AlertPrompt />
        <NudgeBanner />
      </div>
      <div className="mt-6 flex flex-col gap-6">
        <Stage />
        <RecentRow />
        <TodayPanel />
      </div>
    </>
  );
}
