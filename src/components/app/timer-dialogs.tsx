'use client';
/** Timer dialogs (§4 "Timer dialogs"): Stop at…, Edit start time…, Discard timer. */
import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/client/toast';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogRoot, DialogClose, ConfirmDialog } from '@/components/ui/dialog';
import { Field, FieldError, Input } from '@/components/ui/form';
import { useTimer } from './timer-context';
import { useUi } from './ui-context';
import { useSettings } from './settings-context';
import { api, ApiError, messageOf } from '@/lib/client/api';
import { emit } from '@/lib/client/events';
import { formatDuration, formatStartedFlank, formatTime } from '@/lib/format';
import { browserTimeZone, elapsedSeconds, localDateStr, localDateTimeToInstant, localTimeStr } from '@/lib/time';
import { closeNudgeNotifications } from '@/lib/client/push';

export function ZoneNote({ tz }: { tz: string }) {
  const [differs, setDiffers] = useState(false);
  useEffect(() => setDiffers(browserTimeZone() !== tz), [tz]);
  if (!differs) return null;
  return <p className="mt-3 text-meta text-text-secondary">Times are in {tz}.</p>;
}

export function StopAtDialog() {
  const ui = useUi();
  const timer = useTimer();
  const { tz, settings } = useSettings();
  const open = Boolean(ui.stopAt);
  const pending = ui.stopAt?.pendingStart;
  const v = timer.view;
  const sessionStart = v?.session ? Date.parse(v.session.started_at) : null;
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Default: session start + threshold when elapsed exceeds it, otherwise now rounded down.
  useEffect(() => {
    if (!open || !sessionStart) return;
    const now = timer.serverNow();
    const after = (settings?.nudge_after_minutes ?? 240) * 60_000;
    const dflt = now - sessionStart > after ? sessionStart + after : now;
    const floored = Math.floor(dflt / 60_000) * 60_000;
    setDate(localDateStr(floored, tz));
    setTime(localTimeStr(floored, tz));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionStart]);

  const chosen = useMemo(() => {
    if (!date || !time) return null;
    try {
      return localDateTimeToInstant(date, time, tz).getTime();
    } catch {
      return null;
    }
  }, [date, time, tz]);

  // The timer changed underneath (another device): nothing left to stop at.
  useEffect(() => {
    if (open && v && v.status !== 'running' && !busy) ui.closeStopAt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, v?.status]);

  const task = v?.task?.name ?? '';
  const closed = v?.run?.closed_seconds ?? 0;
  const sessSecs = chosen && sessionStart ? elapsedSeconds(sessionStart, chosen) : 0;
  const runStart = v?.run?.started_at ?? v?.session?.started_at ?? null;
  const live =
    chosen && sessionStart
      ? closed > 0 && runStart
        ? `Logs ${formatDuration(sessSecs)} to ${task} (${formatDuration(closed + sessSecs)} on this timer since ${formatStartedFlank(runStart, tz, timer.serverNow())}).`
        : `Logs ${formatDuration(sessSecs)} to ${task}.`
      : '';
  const timeLabel = chosen ? formatTime(chosen, tz) : '';
  const over24 = timer.over24();

  const submit = async () => {
    if (!chosen) {
      setError('Pick a date and a time.');
      return;
    }
    setBusy(true);
    setError(null);
    const iso = new Date(chosen).toISOString();
    const r = pending ? await timer.stopThenStart(iso, pending) : await timer.stop(iso, { fromDialog: true });
    setBusy(false);
    if (r.ok) ui.closeStopAt();
    else if (r.error) setError(r.error.message);
  };

  return (
    <DialogRoot open={open} onOpenChange={(o) => !o && !busy && ui.closeStopAt()}>
      {open ? (
        <DialogContent
          title="When did you stop?"
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost" disabled={busy}>
                  Cancel
                </Button>
              </DialogClose>
              <Button variant="primary" loading={busy} onClick={submit}>
                {pending ? `Stop and start ${pending.label}` : `Stop at ${timeLabel}`}
              </Button>
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {pending || over24 ? (
              <p className="mb-4 text-meta text-text-secondary">
                {pending
                  ? `This timer has run for over 24 hours. Pick when you actually stopped, then ${pending.label} starts.`
                  : 'This timer has run for over 24 hours. Pick when you actually stopped.'}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" error={null}>
                {({ id }) => (
                  <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} invalid={Boolean(error)} required />
                )}
              </Field>
              <Field label="Time">
                {({ id }) => (
                  <Input id={id} type="time" step={60} value={time} onChange={(e) => setTime(e.target.value)} invalid={Boolean(error)} required />
                )}
              </Field>
            </div>
            {error ? <FieldError>{error}</FieldError> : null}
            <p className="tnum mt-4 text-sm text-text-secondary" aria-live="polite">
              {live}
            </p>
            <ZoneNote tz={tz} />
            <button type="submit" hidden />
          </form>
        </DialogContent>
      ) : null}
    </DialogRoot>
  );
}

export function EditStartDialog() {
  const ui = useUi();
  const timer = useTimer();
  const { tz } = useSettings();
  const open = Boolean(ui.editStart);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ui.editStart) return;
    setDate(localDateStr(ui.editStart.startedAt, tz));
    setTime(localTimeStr(ui.editStart.startedAt, tz));
    setError(null);
  }, [ui.editStart, tz]);

  const chosen = date && time ? localDateTimeToInstant(date, time, tz).getTime() : null;
  const v = timer.view;
  const clockIf = chosen ? (v?.run?.closed_seconds ?? 0) + elapsedSeconds(chosen, timer.serverNow()) : 0;

  const submit = async () => {
    if (!ui.editStart || !chosen) return;
    if (chosen > timer.serverNow()) {
      setError("The start time can't be in the future.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/sessions/${ui.editStart.sessionId}`, { method: 'PATCH', body: { started_at: new Date(chosen).toISOString() } });
      await timer.refresh();
      emit('sessions-changed');
      toast.success('Session updated.');
      ui.closeEditStart();
    } catch (e) {
      setError(messageOf(e));
      if (e instanceof ApiError && e.status !== 400 && e.code !== 'OVERLAP') void timer.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={(o) => !o && !busy && ui.closeEditStart()}>
      {open ? (
        <DialogContent
          title="When did you start?"
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost" disabled={busy}>
                  Cancel
                </Button>
              </DialogClose>
              <Button variant="primary" loading={busy} onClick={submit}>
                Save start time
              </Button>
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date">
                {({ id }) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} invalid={Boolean(error)} />}
              </Field>
              <Field label="Time">
                {({ id }) => <Input id={id} type="time" step={60} value={time} onChange={(e) => setTime(e.target.value)} invalid={Boolean(error)} />}
              </Field>
            </div>
            {error ? <FieldError>{error}</FieldError> : null}
            <p className="tnum mt-4 text-sm text-text-secondary" aria-live="polite">
              {chosen ? `The clock will show ${formatDuration(clockIf)}.` : ''}
            </p>
            <ZoneNote tz={tz} />
            <button type="submit" hidden />
          </form>
        </DialogContent>
      ) : null}
    </DialogRoot>
  );
}

export function DiscardDialog() {
  const ui = useUi();
  const timer = useTimer();
  const { tz } = useSettings();
  const v = timer.view;
  const task = v?.task?.name ?? 'current';
  const running = v?.status === 'running';
  const sofar = running ? timer.sessionSeconds(timer.serverNow()) : 0;
  const started = v?.session?.started_at;
  const body = running && started
    ? `The current ${task} timer (started ${formatTime(started, tz)}, ${formatDuration(sofar)} so far) will be thrown away and nothing will be logged for it. Earlier sessions stay.`
    : `The paused ${task} timer will end. Earlier sessions stay.`;
  return (
    <ConfirmDialog
      open={ui.discard}
      onOpenChange={ui.setDiscard}
      title="Discard this timer?"
      description={body}
      confirmLabel="Discard timer"
      onConfirm={async () => {
        const sid = v?.session?.id;
        const ok = await timer.discard();
        if (ok && sid) void closeNudgeNotifications(sid);
        return ok;
      }}
    />
  );
}
