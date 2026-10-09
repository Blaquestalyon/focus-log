/**
 * Pure report math (§6 "Reports calculations", "Weekly summary"). No I/O, unit tested.
 * Every period total counts only the part of each session inside the period; a running
 * session ends at `nowMs`.
 */
import type { ProjectColor, ReportResponse } from './types';
import {
  addDays, addMonths, clipSeconds, daysInMonth, firstOfMonth, mondayOf, monthRange, rowEndMs, todayStr, weekRange,
  startOfLocalDay, type DateStr,
} from './time';
import { formatMonth, formatWeekRange } from './format';

export interface ReportRow {
  id: string;
  task_id: string;
  task_name: string;
  project_id: string | null;
  project_name: string | null;
  project_color: ProjectColor | null;
  project_archived_at: string | null;
  started_at: string;
  ended_at: string | null;
  is_example?: boolean;
}

export type Period = 'week' | 'month';

export function periodBounds(period: Period, start: DateStr, tz: string) {
  const r = period === 'week' ? weekRange(start, tz) : monthRange(start, tz);
  const prevStart = period === 'week' ? addDays(start, -7) : addMonths(start, -1);
  const prev = period === 'week' ? weekRange(prevStart, tz) : monthRange(prevStart, tz);
  const days = period === 'week' ? 7 : daysInMonth(start);
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  return { range: r, prev, prevStart, dates };
}

export function currentPeriodStart(period: Period, tz: string, now: number = Date.now()): DateStr {
  const today = todayStr(tz, now);
  return period === 'week' ? mondayOf(today) : firstOfMonth(today);
}

/** null when valid, otherwise the reason it is invalid. */
export function validatePeriodStart(period: Period, start: string | null, tz: string, now: number = Date.now()): string | null {
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return 'invalid';
  if (period === 'week' && mondayOf(start) !== start) return 'not-monday';
  if (period === 'month' && firstOfMonth(start) !== start) return 'not-first';
  if (start > currentPeriodStart(period, tz, now)) return 'future';
  return null;
}

function sumClipped(rows: ReportRow[], s: Date, e: Date, nowMs: number): number {
  let t = 0;
  for (const r of rows) {
    t += clipSeconds(new Date(r.started_at), new Date(rowEndMs(r, nowMs)), s, e);
  }
  return t;
}

export function computeReport(
  rows: ReportRow[],
  period: Period,
  start: DateStr,
  tz: string,
  nowMs: number,
): ReportResponse {
  const { range, prev, dates } = periodBounds(period, start, tz);
  const total = sumClipped(rows, range.start, range.end, nowMs);
  const previous = sumClipped(rows, prev.start, prev.end, nowMs);
  const includesRunning = rows.some(
    (r) => !r.ended_at && Date.parse(r.started_at) < range.end.getTime() && nowMs > range.start.getTime(),
  );

  const dayBounds = dates.map((d) => ({ date: d, s: startOfLocalDay(d, tz), e: startOfLocalDay(addDays(d, 1), tz) }));
  const days = dayBounds.map(({ date, s, e }) => {
    const byProject = new Map<string | null, number>();
    let dayTotal = 0;
    for (const r of rows) {
      const sec = clipSeconds(new Date(r.started_at), new Date(rowEndMs(r, nowMs)), s, e);
      if (!sec) continue;
      dayTotal += sec;
      byProject.set(r.project_id, (byProject.get(r.project_id) ?? 0) + sec);
    }
    return {
      date,
      total_seconds: dayTotal,
      by_project: [...byProject.entries()].map(([project_id, seconds]) => ({ project_id, seconds })),
    };
  });

  const projects = new Map<string, ReportResponse['projects'][number] & { taskMap: Map<string, { id: string; name: string; seconds: number }> }>();
  for (const r of rows) {
    const sec = clipSeconds(new Date(r.started_at), new Date(rowEndMs(r, nowMs)), range.start, range.end);
    if (!sec) continue;
    const key = r.project_id ?? '__none__';
    let p = projects.get(key);
    if (!p) {
      p = {
        id: r.project_id,
        name: r.project_id ? (r.project_name ?? '') : 'No project',
        color: r.project_id ? r.project_color : null,
        archived: Boolean(r.project_archived_at),
        seconds: 0,
        share: 0,
        tasks: [],
        taskMap: new Map(),
      };
      projects.set(key, p);
    }
    p.seconds += sec;
    const t = p.taskMap.get(r.task_id) ?? { id: r.task_id, name: r.task_name, seconds: 0 };
    t.seconds += sec;
    p.taskMap.set(r.task_id, t);
  }
  const list = [...projects.values()]
    .map(({ taskMap, ...p }) => ({
      ...p,
      share: total ? Math.round((p.seconds / total) * 100) : 0,
      tasks: [...taskMap.values()].sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      if (a.id === null) return 1;
      if (b.id === null) return -1;
      return b.seconds - a.seconds || a.name.localeCompare(b.name);
    });

  return {
    range: {
      start,
      end: addDays(dates[dates.length - 1], 0),
      label: period === 'week' ? formatWeekRange(start) : formatMonth(start),
    },
    total_seconds: total,
    previous_total_seconds: previous,
    includes_running: includesRunning,
    days,
    projects: list,
  };
}

/** Exact share as a float (for `<1%` display decisions). */
export function exactShare(seconds: number, total: number): number {
  return total ? (seconds / total) * 100 : 0;
}
