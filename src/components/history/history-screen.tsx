'use client';
/** History (§4 "Screen: History", §6 "History search and paging", F14). */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, Plus, Search, SearchX, X } from 'lucide-react';
import { PageHeader } from '@/components/app/shell';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox, Field, FieldError, Input, Segmented, Switch } from '@/components/ui/form';
import { EmptyState, ErrorState, Skeleton, Tag } from '@/components/ui/feedback';
import { PopoverAnchor, PopoverContent, PopoverRoot, PopoverTrigger } from '@/components/ui/popover';
import { ProjectDot, projectVar } from '@/components/ui/brand';
import { cn } from '@/components/ui/cn';
import { useSettings } from '@/components/app/settings-context';
import { useUi } from '@/components/app/ui-context';
import { useCatalog } from '@/components/app/catalog-context';
import { useTimer } from '@/components/app/timer-context';
import { SessionMenu } from '@/components/app/session-actions';
import { ExampleNotice, useDataSummary } from '@/components/app/notices';
import { api, ApiError, download, messageOf } from '@/lib/client/api';
import { useAlignedNow, useEvent } from '@/lib/client/hooks';
import { toast } from '@/lib/client/toast';
import { formatDate, formatDayLong, formatDuration, formatTimeRange } from '@/lib/format';
import { elapsedSeconds, localDateStr, todayStr } from '@/lib/time';
import type { SessionRow, SessionsResponse } from '@/lib/types';

type RangeKey = '7d' | '30d' | '90d' | 'all' | 'custom';

interface Filters { q: string; range: RangeKey; from: string; to: string; projects: string[]; sort: 'date' | 'duration' }

function readFilters(sp: URLSearchParams): Filters {
  const r = (sp.get('range') ?? '30d') as RangeKey;
  return {
    q: sp.get('q') ?? '',
    range: ['7d', '30d', '90d', 'all', 'custom'].includes(r) ? r : '30d',
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    projects: (sp.get('projects') ?? '').split(',').filter(Boolean),
    sort: sp.get('sort') === 'duration' ? 'duration' : 'date',
  };
}

function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.range !== '30d') p.set('range', f.range);
  if (f.range === 'custom') {
    p.set('from', f.from);
    p.set('to', f.to);
  }
  if (f.projects.length) p.set('projects', f.projects.join(','));
  if (f.sort !== 'date') p.set('sort', f.sort);
  return p.toString();
}

function isDefault(f: Filters) {
  return !f.q.trim() && f.range === '30d' && !f.projects.length;
}

export function HistoryScreen() {
  const sp = useSearchParams();
  const router = useRouter();
  const ui = useUi();
  const timer = useTimer();
  const { tz } = useSettings();
  const { projects } = useCatalog();
  const { summary } = useDataSummary();
  const filters = useMemo(() => readFilters(new URLSearchParams(sp.toString())), [sp]);
  const query = toQuery(filters);

  const [qText, setQText] = useState(filters.q);
  useEffect(() => setQText(filters.q), [filters.q]);
  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...filters, ...patch };
      const qs = toQuery(next);
      router.replace(qs ? `/history?${qs}` : '/history', { scroll: false });
    },
    [filters, router],
  );
  // Debounced search (250ms).
  useEffect(() => {
    if (qText === filters.q) return;
    const t = setTimeout(() => setFilters({ q: qText.slice(0, 80) }), 250);
    return () => clearTimeout(t);
  }, [qText, filters.q, setFilters]);

  // ---- data
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [meta, setMeta] = useState<{ total_count: number; total_seconds: number; next: string | null } | null>(null);
  const [dayTotals, setDayTotals] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [freshFrom, setFreshFrom] = useState(Infinity);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const r = await api<SessionsResponse>(`/api/sessions?${query}${query ? '&' : ''}limit=50`);
      if (my !== seq.current) return;
      setRows(r.rows);
      setMeta({ total_count: r.total_count, total_seconds: r.total_seconds, next: r.next_cursor });
      setDayTotals(new Map(r.day_totals.map((d) => [d.date, d.seconds])));
      setFreshFrom(Infinity);
      setError(null);
    } catch (e) {
      if (my === seq.current) setError(e as ApiError);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    void load();
  }, [load, tz]);
  useEvent(['sessions-changed', 'data-changed', 'tasks-changed', 'projects-changed'], () => void load());

  const loadMore = async () => {
    if (!meta?.next) return;
    setMore(true);
    try {
      const r = await api<SessionsResponse>(`/api/sessions?${query}${query ? '&' : ''}limit=50&cursor=${encodeURIComponent(meta.next)}`);
      setFreshFrom(rows.length);
      setRows((cur) => [...cur, ...r.rows.filter((x) => !cur.some((c) => c.id === x.id))]);
      setMeta({ total_count: r.total_count, total_seconds: r.total_seconds, next: r.next_cursor });
      setDayTotals((cur) => {
        const n = new Map(cur);
        for (const d of r.day_totals) n.set(d.date, d.seconds);
        return n;
      });
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setMore(false);
    }
  };

  // ---- deep links: ?add=1&date=… opens Add time; ?session=<id> opens Edit (T-H8)
  const handled = useRef('');
  useEffect(() => {
    const add = sp.get('add');
    const sid = sp.get('session');
    const key = `${add}|${sp.get('date')}|${sid}`;
    if (handled.current === key || (!add && !sid)) return;
    handled.current = key;
    const clean = () => {
      const p = new URLSearchParams(sp.toString());
      p.delete('add');
      p.delete('date');
      p.delete('session');
      const qs = p.toString();
      router.replace(qs ? `/history?${qs}` : '/history', { scroll: false });
    };
    if (add === '1') {
      const d = sp.get('date');
      ui.openAddTime({ date: d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayStr(tz) });
      clean();
    } else if (sid) {
      void (async () => {
        try {
          const s = await api<SessionRow>(`/api/sessions/${encodeURIComponent(sid)}`);
          if (s.ended_at) ui.openEditSession(s);
          else ui.openEditStart(s.id, s.started_at);
        } catch (e) {
          toast.error(messageOf(e));
        }
        clean();
      })();
    }
  }, [sp, ui, tz, router]);

  const exportCsv = async () => {
    try {
      const p = new URLSearchParams(query);
      if (!p.has('range')) p.set('range', '30d');
      p.delete('sort');
      await download(`/api/export.csv?${p.toString()}`);
    } catch (e) {
      toast.error(messageOf(e));
    }
  };

  const running = timer.view?.status === 'running';
  const now = useAlignedNow(timer.serverNow, 60_000, running);

  // ---- grouping
  const groups = useMemo(() => {
    if (filters.sort !== 'date') return null;
    const out: { date: string; rows: { r: SessionRow; i: number }[] }[] = [];
    rows.forEach((r, i) => {
      const d = localDateStr(r.started_at, tz);
      const last = out[out.length - 1];
      if (last && last.date === d) last.rows.push({ r, i });
      else out.push({ date: d, rows: [{ r, i }] });
    });
    return out;
  }, [rows, filters.sort, tz]);

  const everEmpty = summary !== null && summary.totals.sessions === 0;

  const renderRow = (r: SessionRow, i: number) => (
    <HistoryRow key={r.id} r={r} tz={tz} now={now} fresh={i >= freshFrom} />
  );

  return (
    <>
      <PageHeader
        title="History"
        actions={
          <>
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => ui.openAddTime({ date: todayStr(tz) })}>
              Add time
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={exportCsv}>
              Export CSV
            </Button>
          </>
        }
      />
      <div className="mb-6 flex flex-col gap-3 empty:hidden">
        <ExampleNotice />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full md:w-[var(--size-search)]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <Input
            aria-label="Search tasks and projects"
            placeholder="Search tasks and projects"
            value={qText}
            maxLength={80}
            onChange={(e) => setQText(e.target.value)}
            className="pl-9 pr-10"
          />
          {qText ? (
            <div className="absolute inset-y-0 right-0 flex items-center">
              <IconButton label="Clear search" onClick={() => setQText('')}>
                <X className="size-4" aria-hidden />
              </IconButton>
            </div>
          ) : null}
        </div>
        <RangeControl filters={filters} onChange={setFilters} />
        <ProjectFilter selected={filters.projects} onChange={(ids) => setFilters({ projects: ids })} projectsAll={projects} />
        {!isDefault(filters) ? (
          <Button
            variant="ghost"
            onClick={() => {
              setQText('');
              router.replace(filters.sort === 'duration' ? '/history?sort=duration' : '/history', { scroll: false });
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {meta ? (
          <p className="tnum text-meta text-text-secondary">
            {meta.total_count} {meta.total_count === 1 ? 'session' : 'sessions'} · {formatDuration(meta.total_seconds)}
          </p>
        ) : null}
        {filters.sort === 'date' ? <p className="text-meta text-text-muted">Sessions are listed under the day they started.</p> : null}
      </div>

      <div className="mt-4">
        {error && !meta ? (
          <div className="rounded-md border border-border bg-surface">
            <ErrorState title="Couldn't load your history." onRetry={() => void load()} />
          </div>
        ) : loading && !meta ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-border bg-surface">
            {everEmpty ? (
              <EmptyState
                title="Your history starts with your first timer."
                body="Every session you log will be listed here, newest first."
                actions={
                  <Link href="/" className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-semibold text-on-accent transition-fast hover:bg-accent-hover active:bg-accent-pressed">
                    Go to Timer
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={<SearchX className="size-10" strokeWidth={1.5} aria-hidden />}
                title={filters.q.trim() ? `No sessions match “${filters.q.trim()}”.` : 'No sessions in this date range.'}
                body="Try a different word, or widen the date range."
                actions={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQText('');
                      router.replace('/history', { scroll: false });
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          <div className={cn('rounded-md border border-border bg-surface', loading && 'opacity-70 transition-base')}>
            <div role="table" aria-label="Sessions" aria-rowcount={meta?.total_count}>
              <div role="rowgroup" className="sticky top-[calc(var(--size-ribbon)+var(--size-topbar))] z-[var(--z-sticky)] hidden rounded-t-md border-b border-border bg-bg-1 md:top-[var(--size-ribbon)] md:block">
                <div role="row" className="flex h-10 items-center gap-3 pl-4 pr-1">
                  <SortHeader label="Date" active={filters.sort === 'date'} onClick={() => setFilters({ sort: 'date' })} className="w-28" />
                  <span role="columnheader" className="micro-label w-36">Time</span>
                  <span role="columnheader" className="micro-label min-w-0 flex-1">Task</span>
                  <span role="columnheader" className="micro-label w-44">Project</span>
                  <SortHeader label="Duration" active={filters.sort === 'duration'} onClick={() => setFilters({ sort: 'duration' })} className="w-20 justify-end" />
                  <span role="columnheader" className="w-10">
                    <span className="sr-only">Actions</span>
                  </span>
                </div>
              </div>
              <div role="rowgroup">
                {groups
                  ? groups.map((g) => (
                      <Fragment key={g.date}>
                        <div role="row" className="flex h-9 items-center justify-between border-b border-border bg-bg-1 px-4">
                          <span role="cell" className="text-meta font-semibold text-text-secondary">{formatDayLong(g.date, tz)}</span>
                          <span role="cell" className="tnum text-meta text-text-secondary">{formatDuration(dayTotals.get(g.date) ?? 0)}</span>
                        </div>
                        {g.rows.map(({ r, i }) => renderRow(r, i))}
                      </Fragment>
                    ))
                  : rows.map((r, i) => renderRow(r, i))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
              <span className="tnum text-meta text-text-secondary">
                Showing {rows.length} of {meta?.total_count ?? rows.length}
              </span>
              {meta?.next ? (
                <Button variant="secondary" loading={more} onClick={loadMore}>
                  Show 50 more
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SortHeader({ label, active, onClick, className }: { label: string; active: boolean; onClick: () => void; className?: string }) {
  return (
    <span role="columnheader" aria-sort={active ? 'descending' : 'none'} className={cn('flex', className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn('micro-label inline-flex h-8 items-center gap-1 rounded-sm px-1 -mx-1 transition-fast hover:text-text-secondary', active && 'text-text-secondary')}
      >
        {label}
        <ChevronDown className={cn('size-3', active ? 'opacity-100' : 'opacity-0')} aria-hidden />
      </button>
    </span>
  );
}

function HistoryRow({ r, tz, now, fresh }: { r: SessionRow; tz: string; now: number; fresh: boolean }) {
  const ui = useUi();
  const running = !r.ended_at;
  const overnight = r.ended_at ? localDateStr(r.started_at, tz) !== localDateStr(r.ended_at, tz) : false;
  const secs = running ? elapsedSeconds(Date.parse(r.started_at), now) : r.duration_seconds ?? 0;
  const open = () => !running && ui.openEditSession(r);
  const tags = (
    <>
      {r.source === 'manual' ? <Tag>Manual</Tag> : null}
      {r.edited ? <Tag>Edited</Tag> : null}
      {overnight ? <Tag>Overnight</Tag> : null}
      {running ? (
        <Tag>
          <span className="onair" style={{ width: 6, height: 6 }} aria-hidden />
          Running
        </Tag>
      ) : null}
    </>
  );
  return (
    <div
      role="row"
      tabIndex={running ? undefined : 0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) open();
      }}
      aria-label={running ? undefined : `Edit ${r.task.name}, ${formatDate(r.started_at, tz)}, ${formatTimeRange(r.started_at, r.ended_at, tz)}`}
      className={cn(
        'relative border-b border-border transition-fast last:border-b-0 hover:bg-surface-raised focus-visible:outline-offset-[calc(var(--size-focus)*-1)]',
        !running && 'cursor-pointer',
        fresh && 'anim-fade-in',
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[var(--size-edge)]" style={{ backgroundColor: projectVar(r.project?.color) }} />
      {/* table row (≥768px) */}
      <div className="hidden h-10 items-center gap-3 pl-4 pr-1 md:flex">
        <span role="cell" className="tnum w-28 text-sm text-text-secondary">{formatDate(r.started_at, tz)}</span>
        <span role="cell" className="tnum w-36 text-sm text-text-secondary">{formatTimeRange(r.started_at, r.ended_at, tz)}</span>
        <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm text-text-primary">{r.task.name}</span>
          <span className="hidden gap-1 lg:flex">{tags}</span>
        </span>
        <span role="cell" className="flex w-44 min-w-0 items-center gap-2">
          <ProjectDot color={r.project?.color ?? null} />
          <span className="truncate text-sm text-text-secondary">{r.project?.name ?? 'No project'}</span>
        </span>
        <span role="cell" className="tnum w-20 text-right text-sm text-text-primary">{formatDuration(secs)}</span>
        <span role="cell" className="w-10" onClick={(e) => e.stopPropagation()}>
          <SessionMenu session={r} context="history" />
        </span>
      </div>
      {/* card (<768px) */}
      <div className="flex gap-2 py-3 pl-4 pr-1 md:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-text-primary">{r.task.name}</span>
            <span className="tnum shrink-0 text-sm text-text-primary">{formatDuration(secs)}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-meta text-text-secondary">
            <ProjectDot color={r.project?.color ?? null} />
            <span className="truncate">
              {r.project?.name ?? 'No project'} · {formatTimeRange(r.started_at, r.ended_at, tz)} · {formatDate(r.started_at, tz)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1 empty:hidden">{tags}</div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <SessionMenu session={r} context="history" />
        </div>
      </div>
    </div>
  );
}

function RangeControl({ filters, onChange }: { filters: Filters; onChange: (p: Partial<Filters>) => void }) {
  const { tz } = useSettings();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(filters.from || todayStr(tz));
  const [to, setTo] = useState(filters.to || todayStr(tz));
  const [err, setErr] = useState<string | null>(null);
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
      <div className="inline-flex">
        <Segmented
          label="Date range"
          value={filters.range}
          onChange={(v) => {
            if (v === 'custom') {
              setOpen(true);
              return;
            }
            onChange({ range: v, from: '', to: '' });
          }}
          options={[
            { value: '7d', label: '7D' },
            { value: '30d', label: '30D' },
            { value: '90d', label: '90D' },
            { value: 'all', label: 'All' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
      </div>
      </PopoverAnchor>
      <PopoverContent className="w-72 p-4" align="end">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!from || !to) return;
            if (to < from) {
              setErr('The end date has to be on or after the start date.');
              return;
            }
            setErr(null);
            onChange({ range: 'custom', from, to });
            setOpen(false);
          }}
        >
          <Field label="From">{({ id }) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label="To">{({ id }) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} invalid={Boolean(err)} />}</Field>
          {err ? <FieldError>{err}</FieldError> : null}
          <Button type="submit" variant="primary">
            Apply
          </Button>
        </form>
      </PopoverContent>
    </PopoverRoot>
  );
}

function ProjectFilter({
  selected,
  onChange,
  projectsAll,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  projectsAll: { id: string; name: string; color: import('@/lib/types').ProjectColor; archived: boolean }[];
}) {
  const [withArchived, setWithArchived] = useState(false);
  const [archived, setArchived] = useState<typeof projectsAll>([]);
  useEffect(() => {
    if (!withArchived) return;
    void api<typeof projectsAll>('/api/projects?include_archived=1').then(
      (all) => setArchived(all.filter((p) => p.archived)),
      () => setArchived([]),
    );
  }, [withArchived]);
  const list = [...projectsAll.filter((p) => !p.archived), ...(withArchived ? archived : [])].sort((a, b) => a.name.localeCompare(b.name));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const label = selected.length === 0 ? 'All projects' : selected.length === 1 ? '1 project' : `${selected.length} projects`;
  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        <Button variant="secondary" iconRight={<ChevronDown className="size-4 text-text-muted" aria-hidden />}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="max-h-72 overflow-y-auto">
          <label className="flex h-9 cursor-pointer items-center gap-3 rounded-sm px-2 text-sm hover:bg-surface-overlay">
            <Checkbox checked={selected.includes('none')} onCheckedChange={() => toggle('none')} />
            <span className="flex-1 text-text-primary">No project</span>
          </label>
          {list.map((p) => (
            <label key={p.id} className="flex h-9 cursor-pointer items-center gap-3 rounded-sm px-2 text-sm hover:bg-surface-overlay">
              <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
              <ProjectDot color={p.color} />
              <span className="min-w-0 flex-1 truncate text-text-primary">{p.name}</span>
              {p.archived ? <Tag>Archived</Tag> : null}
            </label>
          ))}
        </div>
        <label className="mt-1 flex h-10 cursor-pointer items-center justify-between gap-3 border-t border-border px-2 pt-1 text-sm text-text-secondary">
          Include archived projects
          <Switch checked={withArchived} onCheckedChange={setWithArchived} />
        </label>
      </PopoverContent>
    </PopoverRoot>
  );
}

function TableSkeleton() {
  return (
    <div aria-busy className="rounded-md border border-border bg-surface">
      <div className="hidden h-10 items-center gap-3 border-b border-border bg-bg-1 px-4 md:flex">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 flex-1" />
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex h-10 items-center gap-3 border-b border-border px-4 last:border-b-0">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
