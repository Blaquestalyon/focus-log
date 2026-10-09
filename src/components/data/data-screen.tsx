'use client';
/** Your data — the owner's data screen (§4 "Screen: Your data", F15, F18). */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ChevronDown, Download, Mail, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/app/shell';
import { Button } from '@/components/ui/button';
import { Input, Select, Switch } from '@/components/ui/form';
import { EmptyState, ErrorState, Skeleton, Tag } from '@/components/ui/feedback';
import { MoreMenu, MenuItem, MenuSeparator } from '@/components/ui/menu';
import { ConfirmDialog } from '@/components/ui/dialog';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '@/components/ui/tabs';
import { ProjectDot } from '@/components/ui/brand';
import { cn } from '@/components/ui/cn';
import { useUi } from '@/components/app/ui-context';
import { useSettings } from '@/components/app/settings-context';
import { useTimer } from '@/components/app/timer-context';
import { RemoveExamplesDialog, exampleTotal, useDataSummary } from '@/components/app/notices';
import { api, ApiError, download, messageOf } from '@/lib/client/api';
import { emit } from '@/lib/client/events';
import { useApi } from '@/lib/client/use-api';
import { useEvent } from '@/lib/client/hooks';
import { toast } from '@/lib/client/toast';
import { formatDate, formatDateTime, formatDuration } from '@/lib/format';
import { addDays, localDateStr, todayStr } from '@/lib/time';
import type { EmailLogRow, ProjectItem, TaskItem } from '@/lib/types';

type Tab = 'projects' | 'tasks' | 'emails';

export function lastUsedLabel(iso: string | null, tz: string): string {
  if (!iso) return '—';
  const d = localDateStr(iso, tz);
  const today = todayStr(tz);
  if (d === today) return 'Today';
  if (d === addDays(today, -1)) return 'Yesterday';
  return formatDate(iso, tz);
}

export function DataScreen() {
  const sp = useSearchParams();
  const router = useRouter();
  const ui = useUi();
  const raw = sp.get('tab');
  const tab: Tab = raw === 'tasks' || raw === 'emails' ? raw : 'projects';

  const exportAll = async () => {
    try {
      await download('/api/export.csv');
    } catch (e) {
      toast.error(messageOf(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Your data"
        subtitle="Everything Focus Log keeps for you. Sessions live in History."
        actions={
          <>
            {tab === 'projects' ? (
              <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => ui.openProject()}>
                New project
              </Button>
            ) : tab === 'tasks' ? (
              <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => ui.openTask()}>
                New task
              </Button>
            ) : null}
            <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={exportAll}>
              Export everything
            </Button>
          </>
        }
      />
      <ExampleCard />
      <TabsRoot value={tab} onValueChange={(v) => router.replace(`/data?tab=${v}`, { scroll: false })}>
        <TabsList label="Your data">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="emails">Sent emails</TabsTrigger>
        </TabsList>
        <TabsContent value="projects" className="mt-4 outline-none">
          {tab === 'projects' ? <ProjectsTab /> : null}
        </TabsContent>
        <TabsContent value="tasks" className="mt-4 outline-none">
          {tab === 'tasks' ? <TasksTab /> : null}
        </TabsContent>
        <TabsContent value="emails" className="mt-4 outline-none">
          {tab === 'emails' ? <EmailsTab /> : null}
        </TabsContent>
      </TabsRoot>
    </>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function ExampleCard() {
  const { summary } = useDataSummary();
  const [confirm, setConfirm] = useState(false);
  if (!summary || exampleTotal(summary) === 0) return null;
  const c = summary.example_counts;
  const kept = [...summary.kept.projects, ...summary.kept.tasks].map((x) => x.name);
  const keptLine =
    kept.length === 0
      ? null
      : `${kept.length > 1 ? `${kept.slice(0, -1).join(', ')} and ${kept[kept.length - 1]}` : kept[0]} ${kept.length === 1 ? 'has' : 'have'} your own time logged, so ${kept.length === 1 ? "it'll" : "they'll"} be kept.`;
  return (
    <section aria-label="Example data" className="mb-6 flex flex-col gap-4 rounded-md border border-border bg-surface p-6 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <h2 className="card-heading text-text-primary">Example data is loaded.</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {plural(c.projects, 'project', 'projects')}, {plural(c.tasks, 'task', 'tasks')}, {plural(c.sessions, 'session', 'sessions')} and{' '}
          {plural(c.emails, 'email record', 'email records')} are marked as examples. Removing them leaves your own data untouched.
        </p>
        {keptLine ? <p className="mt-1 text-sm text-text-secondary">{keptLine}</p> : null}
      </div>
      <Button variant="danger" onClick={() => setConfirm(true)}>
        Remove example data
      </Button>
      <RemoveExamplesDialog open={confirm} onOpenChange={setConfirm} summary={summary} />
    </section>
  );
}

function TableSkeleton() {
  return (
    <div aria-busy className="rounded-md border border-border bg-surface">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-10 items-center gap-3 border-b border-border px-4 last:border-b-0">
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-md border border-border bg-surface">
      <ErrorState title="Couldn't load your data." onRetry={onRetry} />
    </div>
  );
}

function HeaderCell({ children, className, sort, onSort }: { children: React.ReactNode; className?: string; sort?: 'asc' | 'desc' | 'none'; onSort?: () => void }) {
  if (!onSort) return <span role="columnheader" className={cn('micro-label whitespace-nowrap', className)}>{children}</span>;
  return (
    <span role="columnheader" aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'} className={cn('flex', className)}>
      <button type="button" onClick={onSort} className={cn('micro-label -mx-1 inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-sm px-1 hover:text-text-secondary', sort !== 'none' && 'text-text-secondary')}>
        {children}
        <ChevronDown className={cn('size-3 transition-fast', sort === 'none' ? 'opacity-0' : 'opacity-100', sort === 'asc' && 'rotate-180')} aria-hidden />
      </button>
    </span>
  );
}

// ------------------------------------------------------------------ projects
function ProjectsTab() {
  const ui = useUi();
  const { tz } = useSettings();
  const [archived, setArchived] = useState(false);
  const { data, error, loading, reload } = useApi<ProjectItem[]>(`/api/projects?include_archived=${archived ? 1 : 0}`);
  useEvent(['projects-changed', 'tasks-changed', 'sessions-changed', 'data-changed'], () => void reload());
  const [sort, setSort] = useState<{ key: 'name' | 'total' | 'last'; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [del, setDel] = useState<ProjectItem | null>(null);

  const rows = useMemo(() => {
    const list = [...(data ?? [])];
    const m = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * m;
      if (sort.key === 'total') return (a.total_seconds - b.total_seconds) * m;
      return ((a.last_used_at ?? '') < (b.last_used_at ?? '') ? -1 : (a.last_used_at ?? '') > (b.last_used_at ?? '') ? 1 : 0) * m;
    });
    return list;
  }, [data, sort]);

  const toggleSort = (key: 'name' | 'total' | 'last') =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  const setArchivedState = async (p: ProjectItem, value: boolean) => {
    try {
      await api(`/api/projects/${p.id}`, { method: 'PATCH', body: { archived: value } });
      emit('projects-changed');
      emit('tasks-changed');
      if (value) {
        toast.success(`Archived ${p.name}.`, { action: { label: 'Undo', onClick: () => void setArchivedState(p, false) } });
      } else toast.success(`Unarchived ${p.name}.`);
    } catch (e) {
      toast.error(messageOf(e));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex h-10 w-fit cursor-pointer items-center gap-3 text-sm text-text-secondary">
        <Switch checked={archived} onCheckedChange={setArchived} />
        Show archived
      </label>
      {error && !data ? (
        <LoadError onRetry={() => void reload()} />
      ) : !data || (loading && !data.length) ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState
            title="No projects yet."
            body="Projects and clients keep your hours sorted. Add your first one."
            actions={
              <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => ui.openProject()}>
                New project
              </Button>
            }
          />
        </div>
      ) : (
        <div role="table" aria-label="Projects" className="rounded-md border border-border bg-surface">
          <div role="row" className="sticky top-[var(--size-ribbon)] z-[var(--z-sticky)] hidden h-10 items-center gap-3 rounded-t-md border-b border-border bg-bg-1 px-4 md:flex">
            <HeaderCell className="min-w-0 flex-1" sort={sort.key === 'name' ? sort.dir : 'none'} onSort={() => toggleSort('name')}>Project</HeaderCell>
            <HeaderCell className="w-16 justify-end text-right">Tasks</HeaderCell>
            <HeaderCell className="w-24 justify-end" sort={sort.key === 'total' ? sort.dir : 'none'} onSort={() => toggleSort('total')}>Total time</HeaderCell>
            <HeaderCell className="w-28" sort={sort.key === 'last' ? sort.dir : 'none'} onSort={() => toggleSort('last')}>Last used</HeaderCell>
            <span role="columnheader" className="w-10"><span className="sr-only">Actions</span></span>
          </div>
          {rows.map((p) => {
            const menu = (
              <MoreMenu>
                <MenuItem icon={<Pencil className="size-4" />} onSelect={() => ui.openProject(p)}>Edit…</MenuItem>
                {p.archived ? (
                  <MenuItem icon={<ArchiveRestore className="size-4" />} onSelect={() => void setArchivedState(p, false)}>Unarchive</MenuItem>
                ) : (
                  <MenuItem icon={<Archive className="size-4" />} onSelect={() => void setArchivedState(p, true)}>Archive</MenuItem>
                )}
                <MenuSeparator />
                <MenuItem
                  danger
                  icon={<Trash2 className="size-4" />}
                  disabled={p.total_seconds > 0}
                  tip={p.total_seconds > 0 ? 'Has logged time — archive it instead' : undefined}
                  onSelect={() => setDel(p)}
                >
                  Delete…
                </MenuItem>
              </MoreMenu>
            );
            return (
              <div key={p.id} role="row" className="border-b border-border transition-fast last:border-b-0 hover:bg-surface-raised">
                <div className="hidden h-10 items-center gap-3 pl-4 pr-1 md:flex">
                  <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
                    <ProjectDot color={p.color} />
                    <span className="truncate text-sm text-text-primary">{p.name}</span>
                    {p.archived ? <Tag>Archived</Tag> : null}
                  </span>
                  <span role="cell" className="tnum w-16 text-right text-sm text-text-secondary">{p.task_count}</span>
                  <span role="cell" className="tnum w-24 text-right text-sm text-text-primary">{formatDuration(p.total_seconds)}</span>
                  <span role="cell" className="tnum w-28 text-sm text-text-secondary">{lastUsedLabel(p.last_used_at, tz)}</span>
                  <span role="cell" className="w-10">{menu}</span>
                </div>
                <div className="flex items-start gap-2 py-3 pl-4 pr-1 md:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ProjectDot color={p.color} />
                      <span className="truncate text-sm text-text-primary">{p.name}</span>
                      {p.archived ? <Tag>Archived</Tag> : null}
                    </div>
                    <div className="tnum mt-1 text-meta text-text-secondary">
                      {plural(p.task_count, 'task', 'tasks')} · {formatDuration(p.total_seconds)} · {lastUsedLabel(p.last_used_at, tz)}
                    </div>
                  </div>
                  {menu}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(del)}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete ${del?.name ?? ''}?`}
        description={
          del
            ? del.task_count
              ? `Its ${plural(del.task_count, 'saved task', 'saved tasks')} will be deleted too. It has no logged time.`
              : 'It has no logged time, so nothing else changes.'
            : ''
        }
        confirmLabel="Delete project"
        onConfirm={async () => {
          if (!del) return;
          try {
            await api(`/api/projects/${del.id}`, { method: 'DELETE' });
            toast.success(`Deleted ${del.name}.`);
            emit('projects-changed');
            emit('tasks-changed');
          } catch (e) {
            toast.error(messageOf(e));
          }
        }}
      />
    </div>
  );
}

// --------------------------------------------------------------------- tasks
function TasksTab() {
  const ui = useUi();
  const timer = useTimer();
  const { tz } = useSettings();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pf, setPf] = useState('all');
  const [archived, setArchived] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const projectsApi = useApi<ProjectItem[]>('/api/projects?include_archived=1');
  const params = new URLSearchParams();
  if (debounced) params.set('q', debounced);
  if (pf !== 'all') params.set('project_id', pf);
  if (archived) params.set('include_archived', '1');
  const { data, error, loading, reload } = useApi<TaskItem[]>(`/api/tasks?${params.toString()}`);
  useEvent(['projects-changed', 'tasks-changed', 'sessions-changed', 'data-changed'], () => {
    void reload();
    void projectsApi.reload();
  });
  const [del, setDel] = useState<TaskItem | null>(null);
  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const filtered = Boolean(debounced) || pf !== 'all';

  const setArchivedState = async (t: TaskItem, value: boolean) => {
    try {
      await api(`/api/tasks/${t.id}`, { method: 'PATCH', body: { archived: value } });
      emit('tasks-changed');
      if (value) toast.success(`Archived ${t.name}.`, { action: { label: 'Undo', onClick: () => void setArchivedState(t, false) } });
      else toast.success(`Unarchived ${t.name}.`);
    } catch (e) {
      toast.error(messageOf(e));
    }
  };

  const projectOptions = [
    { value: 'all', label: 'All projects' },
    { value: 'none', label: 'No project' },
    ...(projectsApi.data ?? []).sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <Input aria-label="Search tasks" placeholder="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select label="Project" value={pf} onValueChange={setPf} options={projectOptions} className="w-full sm:w-56" />
        <label className="flex h-10 cursor-pointer items-center gap-3 text-sm text-text-secondary">
          <Switch checked={archived} onCheckedChange={setArchived} />
          Show archived
        </label>
      </div>
      {error && !data ? (
        <LoadError onRetry={() => void reload()} />
      ) : !data ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          {filtered ? (
            <EmptyState title="No tasks match." body="Try a different word or project." />
          ) : (
            <EmptyState
              title="No saved tasks yet."
              body="Tasks are saved the first time you start a timer on them."
              actions={
                <Link href="/" className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-semibold text-on-accent transition-fast hover:bg-accent-hover active:bg-accent-pressed">
                  Go to Timer
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <div role="table" aria-label="Tasks" className={cn('rounded-md border border-border bg-surface', loading && 'opacity-70')}>
          <div role="row" className="sticky top-[var(--size-ribbon)] z-[var(--z-sticky)] hidden h-10 items-center gap-3 rounded-t-md border-b border-border bg-bg-1 px-4 md:flex">
            <HeaderCell className="min-w-0 flex-1">Task</HeaderCell>
            <HeaderCell className="w-44">Project</HeaderCell>
            <HeaderCell className="w-20 text-right">Sessions</HeaderCell>
            <HeaderCell className="w-24 text-right">Total time</HeaderCell>
            <HeaderCell className="w-28">Last used</HeaderCell>
            <span role="columnheader" className="w-10"><span className="sr-only">Actions</span></span>
          </div>
          {rows.map((t) => {
            const menu = (
              <MoreMenu>
                <MenuItem icon={<Pencil className="size-4" />} onSelect={() => ui.openTask(t)}>Edit…</MenuItem>
                {!t.archived ? (
                  <MenuItem icon={<Play className="size-4" />} onSelect={() => void timer.start({ task_id: t.id, label: t.name })}>Start timer</MenuItem>
                ) : null}
                {t.archived ? (
                  <MenuItem icon={<ArchiveRestore className="size-4" />} onSelect={() => void setArchivedState(t, false)}>Unarchive</MenuItem>
                ) : (
                  <MenuItem icon={<Archive className="size-4" />} onSelect={() => void setArchivedState(t, true)}>Archive</MenuItem>
                )}
                <MenuSeparator />
                <MenuItem
                  danger
                  icon={<Trash2 className="size-4" />}
                  disabled={t.session_count > 0}
                  tip={t.session_count > 0 ? 'Has logged time — archive it instead' : undefined}
                  onSelect={() => setDel(t)}
                >
                  Delete…
                </MenuItem>
              </MoreMenu>
            );
            return (
              <div key={t.id} role="row" className="border-b border-border transition-fast last:border-b-0 hover:bg-surface-raised">
                <div className="hidden h-10 items-center gap-3 pl-4 pr-1 md:flex">
                  <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm text-text-primary">{t.name}</span>
                    {t.archived ? <Tag>Archived</Tag> : null}
                  </span>
                  <span role="cell" className="flex w-44 min-w-0 items-center gap-2">
                    <ProjectDot color={t.project?.color ?? null} />
                    <span className="truncate text-sm text-text-secondary">{t.project?.name ?? 'No project'}</span>
                  </span>
                  <span role="cell" className="tnum w-20 text-right text-sm text-text-secondary">{t.session_count}</span>
                  <span role="cell" className="tnum w-24 text-right text-sm text-text-primary">{formatDuration(t.total_seconds)}</span>
                  <span role="cell" className="tnum w-28 text-sm text-text-secondary">{lastUsedLabel(t.last_used_at, tz)}</span>
                  <span role="cell" className="w-10">{menu}</span>
                </div>
                <div className="flex items-start gap-2 py-3 pl-4 pr-1 md:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-text-primary">{t.name}</span>
                      {t.archived ? <Tag>Archived</Tag> : null}
                    </div>
                    <div className="tnum mt-1 flex min-w-0 items-center gap-2 text-meta text-text-secondary">
                      <ProjectDot color={t.project?.color ?? null} />
                      <span className="truncate">
                        {t.project?.name ?? 'No project'} · {plural(t.session_count, 'session', 'sessions')} · {formatDuration(t.total_seconds)}
                      </span>
                    </div>
                  </div>
                  {menu}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(del)}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete ${del?.name ?? ''}?`}
        description="It has no logged time, so nothing else changes."
        confirmLabel="Delete task"
        onConfirm={async () => {
          if (!del) return;
          try {
            await api(`/api/tasks/${del.id}`, { method: 'DELETE' });
            toast.success(`Deleted ${del.name}.`);
            emit('tasks-changed');
          } catch (e) {
            toast.error(messageOf(e));
          }
        }}
      />
    </div>
  );
}

// -------------------------------------------------------------------- emails
const KIND: Record<EmailLogRow['kind'], string> = {
  nudge: 'Reminder',
  weekly_summary: 'Weekly summary',
  test: 'Test',
  password_link: 'Password link',
};

function StatusPill({ status }: { status: EmailLogRow['status'] }) {
  const map: Record<EmailLogRow['status'], { label: string; cls: string }> = {
    sent: { label: 'Sent', cls: 'text-success' },
    sending: { label: 'Sending', cls: 'text-info' },
    failed: { label: 'Failed', cls: 'text-danger-text' },
    skipped_empty: { label: 'Skipped — nothing logged', cls: 'text-text-muted' },
    skipped_acknowledged: { label: 'Skipped — you pressed Keep going', cls: 'text-text-muted' },
  };
  const m = map[status];
  return <span className={cn('inline-flex h-6 items-center whitespace-nowrap rounded-pill bg-surface-raised px-2 text-micro', m.cls)}>{m.label}</span>;
}

export async function sendTestEmail() {
  try {
    await api('/api/settings/test-email', { method: 'POST', body: {} });
    const s = await api<{ email: string }>('/api/settings');
    toast.success(`Test email sent to ${s.email}.`);
    emit('data-changed');
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : messageOf(e));
  }
}

function EmailsTab() {
  const { tz } = useSettings();
  const [rows, setRows] = useState<EmailLogRow[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [more, setMore] = useState(false);
  const [sending, setSending] = useState(false);
  const load = async () => {
    try {
      const r = await api<{ rows: EmailLogRow[]; next_cursor: string | null }>('/api/email-log');
      setRows(r.rows);
      setNext(r.next_cursor);
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEvent(['data-changed'], () => void load());

  if (error && !rows) return <LoadError onRetry={() => void load()} />;
  if (!rows) return <TableSkeleton />;
  if (!rows.length) {
    return (
      <div className="rounded-md border border-border bg-surface">
        <EmptyState
          icon={<Mail className="size-10" strokeWidth={1.5} aria-hidden />}
          title="No emails yet."
          body="Reminders and Monday summaries will be listed here once they're sent."
          actions={
            <Button
              variant="secondary"
              loading={sending}
              onClick={async () => {
                setSending(true);
                await sendTestEmail();
                setSending(false);
              }}
            >
              Send a test email
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div role="table" aria-label="Sent emails" className="rounded-md border border-border bg-surface">
      <div role="row" className="sticky top-[var(--size-ribbon)] z-[var(--z-sticky)] hidden h-10 items-center gap-3 rounded-t-md border-b border-border bg-bg-1 px-4 md:flex">
        <HeaderCell className="w-44">Date</HeaderCell>
        <HeaderCell className="w-32">Type</HeaderCell>
        <HeaderCell className="min-w-0 flex-1">Subject</HeaderCell>
        <HeaderCell className="w-56">Status</HeaderCell>
        <HeaderCell className="w-64">Detail</HeaderCell>
      </div>
      {rows.map((r) => (
        <div key={r.id} role="row" className="border-b border-border transition-fast last:border-b-0 hover:bg-surface-raised">
          <div className="hidden min-h-10 items-center gap-3 px-4 py-2 md:flex">
            <span role="cell" className="tnum w-44 text-sm text-text-secondary">{formatDateTime(r.created_at, tz)}</span>
            <span role="cell" className="w-32 text-sm text-text-secondary">{KIND[r.kind]}</span>
            <span role="cell" className="min-w-0 flex-1 truncate text-sm text-text-primary">{r.subject}</span>
            <span role="cell" className="w-56"><StatusPill status={r.status} /></span>
            <span role="cell" className="w-64 text-meta text-text-secondary">{r.error_human ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-1 px-4 py-3 md:hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-text-primary">{r.subject}</span>
              <StatusPill status={r.status} />
            </div>
            <div className="tnum text-meta text-text-secondary">
              {KIND[r.kind]} · {formatDateTime(r.created_at, tz)}
            </div>
            {r.error_human ? <div className="text-meta text-danger-text">{r.error_human}</div> : null}
          </div>
        </div>
      ))}
      {next ? (
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button
            variant="secondary"
            loading={more}
            onClick={async () => {
              setMore(true);
              try {
                const r = await api<{ rows: EmailLogRow[]; next_cursor: string | null }>(`/api/email-log?cursor=${encodeURIComponent(next)}`);
                setRows((cur) => [...(cur ?? []), ...r.rows]);
                setNext(r.next_cursor);
              } catch (e) {
                toast.error(messageOf(e));
              } finally {
                setMore(false);
              }
            }}
          >
            Show 50 more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
