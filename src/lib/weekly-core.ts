/** Pure Monday-summary logic (§6 "Weekly summary"). Unit tested with fixed clocks. */
import { TZDate } from '@date-fns/tz';
import type { ProjectColor } from './types';
import { addDays, clipSeconds, localDateStr, mondayOf, startOfLocalDay, weekRange, type DateStr } from './time';
import { formatDuration } from './format';
import type { ReportRow } from './report-core';

/** Due when it is Monday between 08:00 and 23:59 in `tz`. */
export function isWeeklyDue(now: Date | number, tz: string): boolean {
  const d = new TZDate(new Date(now).getTime(), tz);
  return d.getDay() === 1 && d.getHours() >= 8;
}

/** The Monday of the week being summarised (the previous Monday–Sunday). */
export function summaryWeekMonday(now: Date | number, tz: string): DateStr {
  return addDays(mondayOf(localDateStr(now, tz)), -7);
}

export interface WeeklySummary {
  monday: DateStr;
  total_seconds: number;
  previous_total_seconds: number;
  projects: { id: string | null; name: string; color: ProjectColor | null; seconds: number; share: number }[];
  top_tasks: { id: string; name: string; project_name: string | null; seconds: number }[];
  days: { date: DateStr; seconds: number }[];
  running_at_end: boolean;
  subject: string;
}

export function weeklySubject(total: number, projectCount: number): string {
  if (projectCount === 0) return `Your week: ${formatDuration(total)} logged`;
  return `Your week: ${formatDuration(total)} across ${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`;
}

/** Only real (non-example) sessions count; example rows are filtered out here as well. */
export function buildWeeklySummary(allRows: ReportRow[], monday: DateStr, tz: string, nowMs: number): WeeklySummary {
  const rows = allRows.filter((r) => !r.is_example);
  const { start, end } = weekRange(monday, tz);
  const prev = weekRange(addDays(monday, -7), tz);
  const endOf = (r: ReportRow) => (r.ended_at ? new Date(r.ended_at) : new Date(nowMs));

  let total = 0;
  let previous = 0;
  const projects = new Map<string, WeeklySummary['projects'][number]>();
  const tasks = new Map<string, WeeklySummary['top_tasks'][number]>();
  let runningAtEnd = false;
  for (const r of rows) {
    const s = new Date(r.started_at);
    const e = endOf(r);
    previous += clipSeconds(s, e, prev.start, prev.end);
    const sec = clipSeconds(s, e, start, end);
    if (!sec) continue;
    total += sec;
    if (s < end && e > end) runningAtEnd = true;
    const key = r.project_id ?? '__none__';
    const p = projects.get(key) ?? {
      id: r.project_id,
      name: r.project_id ? (r.project_name ?? '') : 'No project',
      color: r.project_id ? r.project_color : null,
      seconds: 0,
      share: 0,
    };
    p.seconds += sec;
    projects.set(key, p);
    const t = tasks.get(r.task_id) ?? { id: r.task_id, name: r.task_name, project_name: r.project_name, seconds: 0 };
    t.seconds += sec;
    tasks.set(r.task_id, t);
  }
  const projectList = [...projects.values()]
    .map((p) => ({ ...p, share: total ? Math.round((p.seconds / total) * 100) : 0 }))
    .sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.seconds - a.seconds));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const ds = startOfLocalDay(date, tz);
    const de = startOfLocalDay(addDays(date, 1), tz);
    let seconds = 0;
    for (const r of rows) seconds += clipSeconds(new Date(r.started_at), endOf(r), ds, de);
    return { date, seconds };
  });
  const realProjects = projectList.filter((p) => p.id !== null).length;
  return {
    monday,
    total_seconds: total,
    previous_total_seconds: previous,
    projects: projectList,
    top_tasks: [...tasks.values()].sort((a, b) => b.seconds - a.seconds).slice(0, 5),
    days,
    running_at_end: runningAtEnd,
    subject: weeklySubject(total, realProjects),
  };
}
