'use client';
/** Notices above the content (§4 Timer "Notices", §3 "The example notice"). */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useSettings } from './settings-context';
import { api, messageOf } from '@/lib/client/api';
import { emit } from '@/lib/client/events';
import { useEvent, safeLocal } from '@/lib/client/hooks';
import { toast } from '@/lib/client/toast';
import { browserTimeZone } from '@/lib/time';
import type { DataSummary, StatusResponse } from '@/lib/types';
import { statusNoticeVisible, type StoredDismissal } from '@/lib/status-notice';

/** Data summary, refreshed whenever sessions or data change. */
export function useDataSummary() {
  const [summary, setSummary] = useState<DataSummary | null>(null);
  const load = useCallback(async () => {
    try {
      setSummary(await api<DataSummary>('/api/data/summary'));
    } catch {
      /* notices simply stay hidden */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEvent(['sessions-changed', 'data-changed', 'tasks-changed', 'projects-changed'], () => void load());
  return { summary, reload: load };
}

export function exampleTotal(s: DataSummary | null): number {
  if (!s) return 0;
  const c = s.example_counts;
  return c.projects + c.tasks + c.sessions + c.emails;
}

function list(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The "Remove example data?" confirmation (Your data card and the example notice). */
export function RemoveExamplesDialog({ open, onOpenChange, summary }: { open: boolean; onOpenChange: (o: boolean) => void; summary: DataSummary | null }) {
  const c = summary?.example_counts ?? { projects: 0, tasks: 0, sessions: 0, emails: 0 };
  const keptNames = [...(summary?.kept.projects ?? []), ...(summary?.kept.tasks ?? [])].map((x) => x.name);
  const body =
    `This deletes the ${c.projects} example ${c.projects === 1 ? 'project' : 'projects'}, ${c.tasks} ${c.tasks === 1 ? 'task' : 'tasks'}, ` +
    `${c.sessions} ${c.sessions === 1 ? 'session' : 'sessions'} and ${c.emails} email ${c.emails === 1 ? 'record' : 'records'}. Anything you created yourself stays.` +
    (keptNames.length ? ` ${list(keptNames)} ${keptNames.length === 1 ? 'stays' : 'stay'}, because you've logged time on ${keptNames.length === 1 ? 'it' : 'them'}.` : '');
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Remove example data?"
      description={body}
      confirmLabel="Remove example data"
      onConfirm={async () => {
        try {
          const r = await api<{ kept: { projects: { name: string }[]; tasks: { name: string }[] } }>('/api/data/remove-examples', { method: 'POST', body: {} });
          const kp = r.kept.projects.length;
          const kt = r.kept.tasks.length;
          if (kp || kt) {
            const parts = [kp ? `${kp} ${kp === 1 ? 'project' : 'projects'}` : '', kt ? `${kt} ${kt === 1 ? 'task' : 'tasks'}` : ''].filter(Boolean).join(' and ');
            toast.success(`Example data removed. Kept ${parts} you've logged time on: ${[...r.kept.projects, ...r.kept.tasks].map((x) => x.name).join(', ')}.`);
          } else toast.success('Example data removed.');
          emit('data-changed');
          emit('sessions-changed');
          return true;
        } catch (e) {
          toast.error(messageOf(e));
          return false;
        }
      }}
    />
  );
}

/** Example notice on Timer, Reports and History (dismissal is stored on the account). */
export function ExampleNotice() {
  const { settings, update } = useSettings();
  const { summary } = useDataSummary();
  const [confirm, setConfirm] = useState(false);
  if (!settings || settings.example_notice_dismissed_at || exampleTotal(summary) === 0) return null;
  return (
    <>
      <Notice
        title="You're looking at example data so you can see how things work."
        actions={
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Remove example data
          </Button>
        }
        onDismiss={() => void update({ example_notice_dismissed: true })}
      />
      <RemoveExamplesDialog open={confirm} onOpenChange={setConfirm} summary={summary} />
    </>
  );
}

export function WelcomeNotice({ summary }: { summary: DataSummary | null }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(Boolean(safeLocal()?.getItem('fl-welcome-dismissed'))), []);
  if (hidden || !summary) return null;
  const real = summary.totals.sessions - summary.example_counts.sessions;
  if (real > 0) return null;
  const dismiss = () => {
    safeLocal()?.setItem('fl-welcome-dismissed', '1');
    setHidden(true);
  };
  return (
    <Notice
      title="Welcome to Focus Log."
      body={
        <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5">
          <li>Type what you&apos;re working on and press Start.</li>
          <li>Pause when you step away. Resume picks up where you left off.</li>
          <li>Press ⌘K any time to jump around or start a task.</li>
        </ol>
      }
      actions={
        <Button variant="secondary" onClick={dismiss}>
          Got it
        </Button>
      }
      onDismiss={dismiss}
    />
  );
}

export function TimeZoneNotice() {
  const { settings, update } = useSettings();
  const [zone, setZone] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const z = browserTimeZone();
    setZone(z);
    setHidden(Boolean(safeLocal()?.getItem(`fl-tz-dismissed-${z}`)));
  }, []);
  if (!settings || !settings.time_zone_confirmed || !zone || zone === settings.time_zone || hidden) return null;
  const dismiss = () => {
    safeLocal()?.setItem(`fl-tz-dismissed-${zone}`, '1');
    setHidden(true);
  };
  return (
    <Notice
      title={`This computer is set to ${zone}, but Focus Log is using ${settings.time_zone}.`}
      actions={
        <>
          <Button variant="secondary" onClick={async () => (await update({ time_zone: zone })) && dismiss()}>
            Switch to {zone}
          </Button>
          <Button variant="ghost" onClick={dismiss}>
            Keep {settings.time_zone}
          </Button>
        </>
      }
      onDismiss={dismiss}
    />
  );
}

// ------------------------------------------------------------------ status
export function StatusNotice() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [stored, setStored] = useState<StoredDismissal | null>(null);
  const load = useCallback(async () => {
    try {
      setStatus(await api<StatusResponse>('/api/status'));
    } catch {
      /* keep the last known status */
    }
  }, []);
  useEffect(() => {
    try {
      const raw = safeLocal()?.getItem('fl-status-dismissed');
      setStored(raw ? (JSON.parse(raw) as StoredDismissal) : null);
    } catch {
      setStored(null);
    }
    void load();
    const iv = setInterval(() => void load(), 5 * 60_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  // When old failures age out, lower the stored count so the next failure still shows.
  useEffect(() => {
    if (!status || !stored || status.email.failed_7d >= stored.failed) return;
    const next = { ...stored, failed: status.email.failed_7d };
    safeLocal()?.setItem('fl-status-dismissed', JSON.stringify(next));
    setStored(next);
  }, [status, stored]);

  if (!status || !statusNoticeVisible(status, stored)) return null;
  const problems = status.problems;
  const red = problems.some((p) => p.level === 'problem');
  const more = problems.length - 1;
  const dismiss = () => {
    const next = { keys: problems.map((p) => p.key), at: Date.now(), failed: status.email.failed_7d };
    safeLocal()?.setItem('fl-status-dismissed', JSON.stringify(next));
    setStored(next);
  };
  return (
    <Notice
      role="status"
      edge={red ? 'danger' : 'warning'}
      icon={<TriangleAlert className={red ? 'size-4 text-danger-text' : 'size-4 text-warning'} aria-hidden />}
      title={problems[0].message}
      body={`${more > 0 ? `And ${more} more ${more === 1 ? 'issue' : 'issues'}. ` : ''}See Settings → System status for what to do.`}
      actions={
        <Link
          href="/settings#status"
          className="inline-flex h-10 items-center rounded-sm border border-border-strong bg-surface-raised px-4 text-sm font-semibold text-text-primary transition-fast hover:bg-surface-overlay active:bg-surface"
        >
          Open System status
        </Link>
      }
      onDismiss={dismiss}
    />
  );
}
