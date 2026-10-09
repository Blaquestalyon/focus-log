'use client';
/** Project and task dialogs (§4 Your data), shared with the Timer picker and the palette. */
import { useEffect, useMemo, useState } from 'react';
import * as Rg from '@radix-ui/react-radio-group';
import { TriangleAlert } from 'lucide-react';
import { toast } from '@/lib/client/toast';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent, DialogRoot } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { cn } from '@/components/ui/cn';
import { projectVar } from '@/components/ui/brand';
import { useUi } from './ui-context';
import { useCatalog } from './catalog-context';
import { api, ApiError, messageOf } from '@/lib/client/api';
import { emit } from '@/lib/client/events';
import { formatDuration } from '@/lib/format';
import { PROJECT_COLORS, type ProjectColor, type ProjectItem, type TaskItem } from '@/lib/types';

const COLOR_NAMES: Record<ProjectColor, string> = {
  azure: 'Azure', violet: 'Violet', rose: 'Rose', coral: 'Coral', lime: 'Lime', teal: 'Teal', sand: 'Sand', slate: 'Slate',
};

/** 8-swatch radio group: 28px circles, 40px hit area, arrow keys move the selection. */
function Swatches({ value, onChange, labelledBy }: { value: ProjectColor; onChange: (c: ProjectColor) => void; labelledBy: string }) {
  return (
    <Rg.Root value={value} onValueChange={(v) => onChange(v as ProjectColor)} aria-labelledby={labelledBy} orientation="horizontal" loop className="flex flex-wrap gap-1">
      {PROJECT_COLORS.map((c) => (
        <Rg.Item
          key={c}
          value={c}
          aria-label={COLOR_NAMES[c]}
          className="group inline-flex size-10 items-center justify-center rounded-pill focus-visible:outline-offset-0"
        >
          <span
            aria-hidden
            className={cn(
              'block size-7 rounded-pill transition-fast group-hover:scale-110',
              'group-data-[state=checked]:outline-2 group-data-[state=checked]:outline-offset-2 group-data-[state=checked]:outline-text-primary group-data-[state=checked]:[outline-style:solid]',
            )}
            style={{ backgroundColor: projectVar(c) }}
          />
        </Rg.Item>
      ))}
    </Rg.Root>
  );
}

export function ProjectDialog() {
  const ui = useUi();
  const open = Boolean(ui.project);
  const editing = ui.project?.project;
  const [name, setName] = useState('');
  const [color, setColor] = useState<ProjectColor>('azure');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ui.project) return;
    setName(editing?.name ?? '');
    setColor(editing?.color ?? 'azure');
    setError(null);
  }, [ui.project, editing]);

  const submit = async () => {
    const n = name.trim();
    if (!n) {
      setError('Give the project a name.');
      return;
    }
    if (n.length > 60) {
      setError('Keep project names under 60 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const p = editing
        ? await api<ProjectItem>(`/api/projects/${editing.id}`, { method: 'PATCH', body: { name: n, color } })
        : await api<ProjectItem>('/api/projects', { method: 'POST', body: { name: n, color } });
      emit('projects-changed');
      toast.success(editing ? 'Project updated.' : `Created ${p.name}.`);
      const cb = ui.project?.onCreated;
      ui.closeProject();
      if (!editing) cb?.(p);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={(o) => !o && !busy && ui.closeProject()}>
      {open ? (
        <DialogContent
          title={editing ? 'Edit project' : 'New project'}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost" disabled={busy}>Cancel</Button>
              </DialogClose>
              <Button variant="primary" loading={busy} onClick={submit}>
                {editing ? 'Save changes' : 'Create project'}
              </Button>
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex flex-col gap-4"
          >
            <Field label="Name" error={error}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  autoFocus
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => !name.trim() && setError(null)}
                  invalid={invalid}
                  aria-describedby={describedBy}
                />
              )}
            </Field>
            <div>
              <div id="project-colour-label" className="mb-2 text-sm text-text-secondary">
                Colour
              </div>
              <Swatches value={color} onChange={setColor} labelledBy="project-colour-label" />
            </div>
            <button type="submit" hidden />
          </form>
        </DialogContent>
      ) : null}
    </DialogRoot>
  );
}

export function TaskDialog() {
  const ui = useUi();
  const { projects } = useCatalog();
  const open = Boolean(ui.task);
  const editing = ui.task?.task;
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState<string>('none');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ui.task) return;
    setName(editing?.name ?? '');
    setProjectId(editing?.project?.id ?? 'none');
    setError(null);
  }, [ui.task, editing]);

  const options = useMemo(
    () => [
      { value: 'none', label: 'No project' },
      ...projects
        .filter((p) => !p.archived || p.id === editing?.project?.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ value: p.id, label: p.name })),
      { value: '__new__', label: 'New project…' },
    ],
    [projects, editing],
  );

  const moving = editing && editing.session_count > 0 && (editing.project?.id ?? 'none') !== projectId && projectId !== '__new__';
  const dest = projects.find((p) => p.id === projectId)?.name ?? 'No project';

  const submit = async () => {
    const n = name.trim();
    if (!n) {
      setError('Give the task a name.');
      return;
    }
    if (n.length > 80) {
      setError('Keep task names under 80 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const pid = projectId === 'none' ? null : projectId;
    try {
      const t = editing
        ? await api<TaskItem>(`/api/tasks/${editing.id}`, { method: 'PATCH', body: { name: n, project_id: pid } })
        : await api<TaskItem>('/api/tasks', { method: 'POST', body: { name: n, project_id: pid } });
      emit('tasks-changed');
      if (moving) emit('sessions-changed');
      toast.success(editing ? 'Task updated.' : `Created ${t.name}.`);
      const cb = ui.task?.onCreated;
      ui.closeTask();
      if (!editing) cb?.(t);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={(o) => !o && !busy && ui.closeTask()}>
      {open ? (
        <DialogContent
          title={editing ? 'Edit task' : 'New task'}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost" disabled={busy}>Cancel</Button>
              </DialogClose>
              <Button variant="primary" loading={busy} onClick={submit}>
                {editing ? 'Save changes' : 'Create task'}
              </Button>
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex flex-col gap-4"
          >
            <Field label="Name" error={error}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} invalid={invalid} aria-describedby={describedBy} />
              )}
            </Field>
            <Field label="Project">
              {({ id }) => (
                <Select
                  id={id}
                  value={projectId}
                  options={options}
                  onValueChange={(v) => {
                    if (v === '__new__') {
                      ui.openProject(undefined, (p) => setProjectId(p.id));
                      return;
                    }
                    setProjectId(v);
                  }}
                />
              )}
            </Field>
            {moving && editing ? (
              <p role="status" className="flex items-start gap-2 rounded-sm border border-border bg-surface-raised p-3 text-sm text-text-secondary">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>
                  Moving this task also moves its {editing.session_count} {editing.session_count === 1 ? 'session' : 'sessions'} (
                  {formatDuration(editing.total_seconds)}) to {dest}. Past reports will change to match.
                </span>
              </p>
            ) : null}
            <button type="submit" hidden />
          </form>
        </DialogContent>
      ) : null}
    </DialogRoot>
  );
}
