'use client';
/** Reports (§4 "Screen: Reports", §6 "Reports calculations", F13). */
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell';
import { Button, IconButton } from '@/components/ui/button';
import { Segmented } from '@/components/ui/form';
import { EmptyState, ErrorState, Skeleton, Tag } from '@/components/ui/feedback';
import { ProjectDot, projectVar } from '@/components/ui/brand';
import { cn } from '@/components/ui/cn';
import { useSettings } from '@/components/app/settings-context';
import { useUi } from '@/components/app/ui-context';
import { ExampleNotice } from '@/components/app/notices';
import { api, ApiError, download, messageOf } from '@/lib/client/api';
import { useEvent, useReducedMotion, useMediaQuery } from '@/lib/client/hooks';
import { toast } from '@/lib/client/toast';
import { currentPeriodStart, exactShare, validatePeriodStart, type Period } from '@/lib/report-core';
import { formatDateStr, formatDelta, formatDuration, formatMonth, formatShare, formatWeekdayDay, WD_LONG } from '@/lib/format';
import { addDays, addMonths, parseDateStr } from '@/lib/time';
import type { ReportResponse } from '@/lib/types';

function useReport(period: Period, start: string | null) {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const load = async () => {
    if (!start) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const r = await api<ReportResponse>(`/api/reports?period=${period}&start=${start}`);
      if (my === seq.current) {
        setData(r);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(e as ApiError);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, start]);
  return { data, error, loading, reload: load };
}

function hoursTicks(maxSeconds: number) {
  const maxH = Math.max(1, Math.ceil(maxSeconds / 3600));
  const step = [1, 2, 4, 8, 12].find((s) => Math.ceil(maxH / s) <= 4) ?? 24;
  const top = Math.ceil(maxH / step) * step;
  const ticks: number[] = [];
  for (let h = 0; h <= top; h += step) ticks.push(h * 3600);
  return ticks;
}

export function ReportsScreen() {
  const sp = useSearchParams();
  const router = useRouter();
  const ui = useUi();
  const { tz, settings } = useSettings();
  const reduced = useReducedMotion();
  const narrow = useMediaQuery('(max-width: 47.99rem)');
  const period: Period = sp.get('period') === 'month' ? 'month' : 'week';
  const rawStart = sp.get('start');
  const current = currentPeriodStart(period, tz);
  const valid = settings ? !validatePeriodStart(period, rawStart, tz) : false;
  const start = settings ? (valid ? rawStart! : current) : null;

  // Replace an invalid, future or misaligned start before calling the API (T-R6).
  useEffect(() => {
    if (!settings) return;
    if (!rawStart || validatePeriodStart(period, rawStart, tz) || sp.get('period') !== period) {
      const url = `/reports?period=${period}&start=${current}`;
      window.history.replaceState(null, '', url);
    }
  }, [settings, rawStart, period, tz, current, sp]);

  const { data, error, loading, reload } = useReport(period, start);
  useEvent(['sessions-changed', 'data-changed', 'projects-changed', 'tasks-changed'], () => void reload());
  useEffect(() => {
    if (!data?.includes_running) return;
    const iv = setInterval(() => void reload(), 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.includes_running, start, period]);

  const go = (p: Period, s: string) => router.push(`/reports?period=${p}&start=${s}`);
  const isCurrent = start === current;
  const prevStart = start ? (period === 'week' ? addDays(start, -7) : addMonths(start, -1)) : null;
  const nextStart = start ? (period === 'week' ? addDays(start, 7) : addMonths(start, 1)) : null;
  const unit = period === 'week' ? 'week' : 'month';
  const [firstRender, setFirstRender] = useState(true);
  useEffect(() => {
    if (data && firstRender) {
      const t = setTimeout(() => setFirstRender(false), 1200);
      return () => clearTimeout(t);
    }
  }, [data, firstRender]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const exportCsv = async () => {
    if (!data) return;
    try {
      await download(`/api/export.csv?range=custom&from=${data.range.start}&to=${data.range.end}`);
    } catch (e) {
      toast.error(messageOf(e));
    }
  };

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.days.map((d) => {
      const row: Record<string, number | string> = {
        date: d.date,
        label: period === 'week' ? formatWeekdayDay(d.date) : String(parseDateStr(d.date).d),
        total: d.total_seconds,
      };
      for (const p of d.by_project) row[p.project_id ?? 'none'] = p.seconds;
      return row;
    });
  }, [data, period]);

  const projectKeys = useMemo(() => (data ? data.projects.map((p) => ({ key: p.id ?? 'none', color: p.color, name: p.name })) : []), [data]);
  const maxDay = data ? Math.max(0, ...data.days.map((d) => d.total_seconds)) : 0;
  const ticks = hoursTicks(maxDay);

  const summaryLabel = data
    ? `Daily totals: ${data.days
        .map((d) => {
          const { y, m, d: dd } = parseDateStr(d.date);
          return `${WD_LONG[new Date(Date.UTC(y, m - 1, dd, 12)).getUTCDay()]} ${formatDuration(d.total_seconds)}`;
        })
        .join(', ')}`
    : '';

  return (
    <>
      <PageHeader
        title="Reports"
        actions={
          <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={exportCsv} disabled={!data}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-6 flex flex-col gap-3 empty:hidden">
        <ExampleNotice />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmented
          label="Period"
          value={period}
          onChange={(p) => go(p, currentPeriodStart(p, tz))}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <IconButton label={`Previous ${unit}`} onClick={() => prevStart && go(period, prevStart)}>
          <ChevronLeft className="size-4" aria-hidden />
        </IconButton>
        <IconButton
          label={`Next ${unit}`}
          tip={isCurrent ? `You're on the current ${unit}` : `Next ${unit}`}
          disabled={isCurrent}
          onClick={() => nextStart && !isCurrent && go(period, nextStart)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </IconButton>
        <Button variant="ghost" disabled={isCurrent} onClick={() => go(period, current)}>
          {period === 'week' ? 'This week' : 'This month'}
        </Button>
      </div>

      {error && !data ? (
        <div className="rounded-md border border-border bg-surface">
          <ErrorState title="Couldn't load this report." onRetry={() => void reload()} />
        </div>
      ) : !data || (loading && data.range.start !== start) ? (
        <ReportSkeleton />
      ) : data.total_seconds === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState
            title={`No time logged this ${unit}.`}
            body="Start a timer and it'll show up here, or add time you forgot to track."
            actions={
              <>
                <Link
                  href="/"
                  className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-semibold text-on-accent transition-fast hover:bg-accent-hover active:bg-accent-pressed"
                >
                  Go to Timer
                </Link>
                <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => ui.openAddTime({ date: data.range.start })}>
                  Add time
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <div key={`${period}-${start}`} className="anim-crossfade flex flex-col gap-6">
          {/* Total card */}
          <section aria-label="Total" className="rounded-md border border-border bg-surface p-8">
            <div className="eyebrow">{period === 'week' ? data.range.label.toUpperCase() : formatMonth(data.range.start).toUpperCase()}</div>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:gap-8">
              <div className="order-2 flex flex-col gap-1 md:order-1 md:w-40">
                <span className="micro-label">{period === 'week' ? 'Week of' : 'Month of'}</span>
                <span className="tnum text-sm text-text-secondary">
                  {period === 'week' ? formatDateStr(data.range.start, tz) : formatMonth(data.range.start)}
                </span>
              </div>
              <div className="order-1 md:order-2">
                <span className="display-number text-gold">{formatDuration(data.total_seconds)}</span>
              </div>
              <div className="order-3 flex flex-col gap-1 md:ml-auto md:items-end">
                <span className="micro-label">{period === 'week' ? 'Vs last week' : 'Vs last month'}</span>
                <span className="tnum inline-flex items-center gap-1 text-sm text-text-secondary">
                  {data.total_seconds > data.previous_total_seconds && data.previous_total_seconds > 0 ? <ArrowUp className="size-3.5" aria-hidden /> : null}
                  {data.total_seconds < data.previous_total_seconds && data.previous_total_seconds > 0 ? <ArrowDown className="size-3.5" aria-hidden /> : null}
                  {formatDelta(data.total_seconds, data.previous_total_seconds)}
                </span>
              </div>
            </div>
            {data.includes_running ? <p className="mt-4 text-meta text-text-secondary">Includes your running timer up to now.</p> : null}
          </section>

          {/* Daily chart */}
          <section aria-label="Daily totals" className="rounded-md border border-border bg-surface p-4 md:p-6">
            <h2 className="card-heading mb-4 text-text-primary">By day</h2>
            <div role="img" aria-label={summaryLabel} className="h-[var(--size-chart)] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                    tickFormatter={(v: string, i: number) => (period === 'month' && narrow && i % 5 !== 0 ? '' : v)}
                  />
                  <YAxis
                    ticks={ticks}
                    domain={[0, ticks[ticks.length - 1]]}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                    tickFormatter={(v: number) => `${Math.round(v / 3600)}h`}
                  />
                  <RTooltip
                    cursor={{ fill: 'var(--color-surface-raised)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as Record<string, number | string>;
                      return (
                        <div className="tnum min-w-44 rounded-md border border-border bg-surface-overlay p-3 shadow-overlay">
                          <div className="flex items-center justify-between gap-4 text-sm text-text-primary">
                            <span>{formatDateStr(String(row.date), tz)}</span>
                            <span className="font-semibold">{formatDuration(Number(row.total))}</span>
                          </div>
                          <div className="mt-2 flex flex-col gap-1">
                            {projectKeys
                              .filter((p) => Number(row[p.key] ?? 0) > 0)
                              .map((p) => (
                                <div key={p.key} className="flex items-center gap-2 text-meta text-text-secondary">
                                  <ProjectDot color={p.color} />
                                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                                  <span>{formatDuration(Number(row[p.key]))}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {projectKeys.map((p, i) => (
                    <Bar
                      key={p.key}
                      dataKey={p.key}
                      stackId="day"
                      fill={projectVar(p.color)}
                      radius={i === projectKeys.length - 1 ? [2, 2, 0, 0] : 0}
                      isAnimationActive={firstRender && !reduced}
                      animationDuration={400}
                      animationBegin={i * 20}
                      animationEasing="ease-out"
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>Daily totals</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d.date}>
                    <td>{formatDateStr(d.date, tz)}</td>
                    <td>{formatDuration(d.total_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* By project */}
          <section aria-label="By project" className="rounded-md border border-border bg-surface">
            <div className="flex h-10 items-center border-b border-border px-4">
              <span className="micro-label flex-1">Project</span>
              <span className="micro-label w-20 text-right">Time</span>
              <span className="micro-label w-16 text-right">Share</span>
            </div>
            <ul>
              {data.projects.map((p) => {
                const key = p.id ?? 'none';
                const open = expanded.has(key);
                const share = exactShare(p.seconds, data.total_seconds);
                return (
                  <li key={key} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() =>
                        setExpanded((s) => {
                          const n = new Set(s);
                          if (n.has(key)) n.delete(key);
                          else n.add(key);
                          return n;
                        })
                      }
                      className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left transition-fast hover:bg-surface-raised focus-visible:outline-offset-[calc(var(--size-focus)*-1)]"
                    >
                      <ChevronRight className={cn('size-4 shrink-0 text-text-muted transition-fast', open && 'rotate-90')} aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <ProjectDot color={p.color} />
                          <span className="truncate text-sm text-text-primary">{p.name}</span>
                          {p.archived ? <Tag>Archived</Tag> : null}
                        </span>
                        <span aria-hidden className="block h-[var(--size-sharebar)] rounded-pill bg-surface-raised">
                          <span className="block h-full rounded-pill" style={{ width: `${Math.max(share, 0.5)}%`, backgroundColor: projectVar(p.color) }} />
                        </span>
                      </span>
                      <span className="tnum w-20 text-right text-sm text-text-primary">{formatDuration(p.seconds)}</span>
                      <span className="tnum w-16 text-right text-sm text-text-secondary">{formatShare(share)}</span>
                    </button>
                    {open ? (
                      <ul className="anim-fade-in pb-2">
                        {p.tasks.map((t) => (
                          <li key={t.id} className="flex h-9 items-center gap-2 pl-[calc(var(--space-4)+var(--size-indent)+var(--space-4))] pr-4">
                            <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">{t.name}</span>
                            <span className="tnum w-20 text-right text-sm text-text-secondary">{formatDuration(t.seconds)}</span>
                            <span className="w-16" />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}

function ReportSkeleton() {
  const heights = [40, 70, 55, 85, 30, 60, 45];
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="rounded-md border border-border bg-surface p-8">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-4 h-12 w-56" />
      </div>
      <div className="flex h-[var(--size-chart)] items-end gap-3 rounded-md border border-border bg-surface p-6">
        {heights.map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="rounded-md border border-border bg-surface">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex h-11 items-center gap-3 border-b border-border px-4 last:border-b-0">
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
