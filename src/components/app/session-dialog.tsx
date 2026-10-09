'use client';
/** Add time / Edit session (§4 History "Session dialog", F10, F11). 560px wide. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { toast } from '@/lib/client/toast';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent, DialogRoot } from '@/components/ui/dialog';
import { Checkbox, Field, Input } from '@/components/ui/form';
import { useUi } from './ui-context';
import { useSettings } from './settings-context';
import { useCatalog } from './catalog-context';
import { useTimer } from './timer-context';
import { ProjectPicker, TaskCombobox } from './pickers';
import { ZoneNote } from './timer-dialogs';
import { api, ApiError } from '@/lib/client/api';
import { emit } from '@/lib/client/events';
import { formatDuration } from '@/lib/format';
import { addDays, localDateStr, localDateTimeToInstant, localTimeStr, todayStr } from '@/lib/time';
import type { SessionRow, SessionsResponse, TaskItem } from '@/lib/types';

const FIVE_YEARS = 5 * 365.25 * 24 * 3600 * 1000;

export function SessionDialog() {
  const ui = useUi();
  const { tz, settings } = useSettings();
  const { projects } = useCatalog();
  const timer = useTimer();
  const st = ui.addTime;
  const open = Boolean(st);
  const editing = st?.mode === 'edit' ? st.session : undefined;

  const [text, setText] = useState('');
  const [task, setTask] = useState<TaskItem | null>(null);
  const [highlight, setHighlight] = useState<TaskItem | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('09:30');
  const [multi, setMulti] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set once the owner edits the date or a time, so the late-arriving default never overwrites them.
  const timesTouched = useRef(false);

  // Defaults.
  useEffect(() => {
    if (!st) return;
    timesTouched.current = false;
    setErrors({});
    setBanner(null);
    setHighlight(null);
    if (editing) {
      setText(editing.task.name);
      setTask({
        id: editing.task.id, name: editing.task.name, project: editing.project, archived: editing.task.archived,
        session_count: 0, total_seconds: 0, last_used_at: null, is_example: editing.is_example,
      });
      setProjectId(editing.project?.id ?? null);
      const d = localDateStr(editing.started_at, tz);
      setDate(d);
      setStart(localTimeStr(editing.started_at, tz));
      if (editing.ended_at) {
        const ed = localDateStr(editing.ended_at, tz);
        setEnd(localTimeStr(editing.ended_at, tz));
        setEndDate(ed);
        setMulti(ed !== d);
      }
      return;
    }
    const d = st.date ?? todayStr(tz);
    setText('');
    setTask(null);
    const lp = projects.find((p) => p.id === settings?.last_project_id && !p.archived)?.id ?? null;
    setProjectId(lp);
    setDate(d);
    setMulti(false);
    setEndDate(addDays(d, 1));
    const now = Date.now();
    const applyStart = (startMs: number) => {
      const endMs = Math.min(startMs + 30 * 60_000, Math.floor(now / 60_000) * 60_000);
      setStart(localTimeStr(startMs, tz));
      setEnd(localTimeStr(Math.max(endMs, startMs), tz));
      const ed = localDateStr(Math.max(endMs, startMs), tz);
      if (ed !== d) {
        setMulti(true);
        setEndDate(ed);
      }
    };
    applyStart(localDateTimeToInstant(d, '09:00', tz).getTime());
    // The start is the end of the latest session on that date, or 9:00 AM.
    void (async () => {
      try {
        const r = await api<SessionsResponse>(`/api/sessions?range=custom&from=${d}&to=${d}&sort=date&limit=50`);
        const ends = r.rows.filter((x) => x.ended_at).map((x) => Date.parse(x.ended_at!));
        if (ends.length && !timesTouched.current) applyStart(Math.max(...ends));
      } catch {
        /* keep 9:00 AM */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st]);

  const shownTask = highlight ?? task;
  const startMs = useMemo(() => (date && start ? localDateTimeToInstant(date, start, tz).getTime() : NaN), [date, start, tz]);
  const endMs = useMemo(() => {
    const ed = multi ? endDate : date;
    return ed && end ? localDateTimeToInstant(ed, end, tz).getTime() : NaN;
  }, [multi, endDate, date, end, tz]);
  const duration = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs ? Math.floor((endMs - startMs) / 1000) : 0;

  // An end time earlier than the start ticks "Ends on a different day" and sets the next day.
  const onEndChange = (v: string) => {
    timesTouched.current = true;
    setEnd(v);
    if (!multi && v && start && v < start) {
      setMulti(true);
      setEndDate(addDays(date, 1));
    }
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const now = Date.now();
    if (!editing && !text.trim()) e.task = 'Type a task name.';
    if (text.trim().length > 80) e.task = 'Keep task names under 80 characters.';
    if (!Number.isFinite(startMs)) e.started_at = 'Pick a date and a start time.';
    else if (!Number.isFinite(endMs)) e.ended_at = 'Pick an end time.';
    else if (startMs > now || endMs > now) e[endMs > now ? 'ended_at' : 'started_at'] = "Times can't be in the future.";
    else if (endMs <= startMs) e.ended_at = 'The end time has to be after the start time.';
    else if (endMs - startMs > 24 * 3600_000) e.ended_at = 'A single session can be at most 24 hours. Split it into two entries.';
    else if ((!editing || editing.source === 'manual') && endMs - startMs < 60_000) e.ended_at = 'Entries need to be at least 1 minute long.';
    else if (startMs < now - FIVE_YEARS) e.started_at = 'Pick a date within the last 5 years.';
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    setBanner(null);
    if (Object.keys(e).length) {
      const first = ['task', 'started_at', 'ended_at'].find((k) => e[k]);
      document.getElementById(`sd-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { started_at: new Date(startMs).toISOString(), ended_at: new Date(endMs).toISOString() };
      let row: SessionRow;
      if (editing) {
        if (task && task.id !== editing.task.id) body.task_id = task.id;
        else if (!task && text.trim() && text.trim() !== editing.task.name) {
          // A new name in edit mode: create it under the chosen project, then move the session.
          const t = await api<TaskItem>('/api/tasks', { method: 'POST', body: { name: text.trim(), project_id: projectId } }).catch(async (err) => {
            if (err instanceof ApiError && err.code === 'DUPLICATE_NAME') {
              const list = await api<TaskItem[]>(`/api/tasks?q=${encodeURIComponent(text.trim())}&include_archived=1`);
              const hit = list.find((x) => x.name.toLowerCase() === text.trim().toLowerCase() && (x.project?.id ?? null) === projectId);
              if (hit) return hit;
            }
            throw err;
          });
          body.task_id = t.id;
          emit('tasks-changed');
        }
        row = await api<SessionRow>(`/api/sessions/${editing.id}`, { method: 'PATCH', body });
        toast.success('Session updated.');
      } else {
        if (task) body.task_id = task.id;
        else {
          body.task_name = text.trim();
          body.project_id = projectId;
        }
        row = await api<SessionRow>('/api/sessions', { method: 'POST', body });
        toast.success(`Added ${formatDuration(row.duration_seconds ?? duration)} to ${row.task.name}.`);
      }
      emit('sessions-changed');
      emit('tasks-changed');
      if (timer.view?.status !== 'idle') void timer.refresh();
      ui.closeSession();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'OVERLAP') setBanner(err.message);
        else if (err.field === 'task_id' || err.field === 'task_name') setErrors({ task: err.message });
        else if (err.field === 'started_at' || err.field === 'ended_at') setErrors({ [err.field]: err.message });
        else setBanner(err.message);
      } else setBanner('Something went wrong on our side. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={(o) => !o && !busy && ui.closeSession()}>
      {open ? (
        <DialogContent
          wide
          title={editing ? 'Edit session' : 'Add time'}
          footer={
            <>
              {banner ? (
                <div role="alert" className="mb-2 flex w-full items-start gap-2 rounded-sm border border-danger-text bg-surface-raised p-3 text-sm text-text-primary">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger-text" aria-hidden />
                  <span>{banner}</span>
                </div>
              ) : null}
              <DialogClose asChild>
                <Button variant="ghost" disabled={busy}>Cancel</Button>
              </DialogClose>
              <Button variant="primary" loading={busy} onClick={submit}>
                {editing ? 'Save changes' : 'Add time'}
              </Button>
            </>
          }
        >
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex flex-col gap-4"
          >
            <Field label="Task" error={errors.task} id="sd-task">
              {({ id, describedBy, invalid }) => (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <TaskCombobox
                    id={id}
                    className="min-w-0 flex-1"
                    text={text}
                    onTextChange={setText}
                    selected={task}
                    onSelect={setTask}
                    onHighlight={setHighlight}
                    onCommit={(c) => {
                      if ('task' in c) setTask(c.task);
                      else setTask(null);
                    }}
                    projectId={projectId}
                    placeholder="What were you working on?"
                    label="Task"
                    newLabel={(t) => `Create “${t}”`}
                    invalid={invalid}
                    describedBy={describedBy}
                  />
                  <ProjectPicker
                    value={shownTask ? shownTask.project?.id ?? null : projectId}
                    onChange={setProjectId}
                    disabled={Boolean(shownTask)}
                    disabledTip={shownTask ? `This task belongs to ${shownTask.project?.name ?? 'No project'}. Change it in Your data.` : undefined}
                  />
                </div>
              )}
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Date" error={null}>
                {({ id }) => <Input id={id} type="date" value={date} onChange={(e) => {
                  timesTouched.current = true;
                  setDate(e.target.value);
                }} />}
              </Field>
              <Field label="Start time" error={errors.started_at} id="sd-started_at">
                {({ id, describedBy, invalid }) => (
                  <Input id={id} type="time" step={60} value={start} onChange={(e) => {
                    timesTouched.current = true;
                    setStart(e.target.value);
                  }} invalid={invalid} aria-describedby={describedBy} />
                )}
              </Field>
              <Field label="End time" error={errors.ended_at} id="sd-ended_at">
                {({ id, describedBy, invalid }) => (
                  <Input id={id} type="time" step={60} value={end} onChange={(e) => onEndChange(e.target.value)} invalid={invalid} aria-describedby={describedBy} />
                )}
              </Field>
            </div>
            <label className="flex h-10 cursor-pointer items-center gap-3 text-sm text-text-secondary">
              <Checkbox checked={multi} onCheckedChange={(v) => {
                setMulti(v);
                if (v && (!endDate || endDate <= date)) setEndDate(addDays(date, 1));
              }} />
              Ends on a different day
            </label>
            {multi ? (
              <Field label="End date" className="sm:w-1/3">
                {({ id }) => <Input id={id} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
              </Field>
            ) : null}
            <p className="tnum text-sm text-text-secondary" aria-live="polite">
              Duration: {formatDuration(duration)}
            </p>
            <ZoneNote tz={tz} />
            <button type="submit" hidden />
          </form>
        </DialogContent>
      ) : null}
    </DialogRoot>
  );
}
