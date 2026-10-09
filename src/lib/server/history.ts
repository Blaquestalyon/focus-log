import 'server-only';
import { HttpError, MSG } from './http';
import { addDays, isDateStr, startOfLocalDay, todayStr, type DateStr } from '@/lib/time';
import { ilikeContains } from './rows';

export type RangeKey = '7d' | '30d' | '90d' | 'all' | 'custom';

export interface SessionFilters {
  q: string;
  range: RangeKey;
  from: DateStr | null;
  to: DateStr | null;
  projects: string[]; // project ids, or 'none' for No project
  sort: 'date' | 'duration';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read the History filters from a query string (§4 History, §6 search and paging). */
export function parseFilters(sp: URLSearchParams, defaultRange: RangeKey = '30d'): SessionFilters {
  const q = (sp.get('q') ?? '').trim().slice(0, 80);
  const rawRange = (sp.get('range') ?? defaultRange).toLowerCase();
  const range: RangeKey = (['7d', '30d', '90d', 'all', 'custom'] as const).includes(rawRange as RangeKey)
    ? (rawRange as RangeKey)
    : (() => { throw new HttpError(400, 'VALIDATION', MSG.badRequest, 'range'); })();
  let from: DateStr | null = null;
  let to: DateStr | null = null;
  if (range === 'custom') {
    from = sp.get('from');
    to = sp.get('to');
    if (!isDateStr(from) || !isDateStr(to)) throw new HttpError(400, 'VALIDATION', 'Pick a start and an end date.', 'from');
    if (to < from) throw new HttpError(400, 'VALIDATION', 'The end date has to be on or after the start date.', 'to');
  }
  const projects = (sp.get('projects') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of projects) {
    if (p !== 'none' && !UUID_RE.test(p)) throw new HttpError(400, 'VALIDATION', MSG.badRequest, 'projects');
  }
  const sort = sp.get('sort') === 'duration' ? 'duration' : 'date';
  if (sp.get('sort') && !['date', 'duration'].includes(sp.get('sort')!)) {
    throw new HttpError(400, 'VALIDATION', MSG.badRequest, 'sort');
  }
  return { q, range, from, to, projects, sort };
}

/** The [start, end) instants a filter covers (sessions are listed under the day they started). */
export function filterBounds(f: SessionFilters, tz: string, now = Date.now()): { start: Date | null; end: Date | null; fromStr: DateStr | null; toStr: DateStr } {
  const today = todayStr(tz, now);
  if (f.range === 'all') return { start: null, end: null, fromStr: null, toStr: today };
  if (f.range === 'custom') {
    return { start: startOfLocalDay(f.from!, tz), end: startOfLocalDay(addDays(f.to!, 1), tz), fromStr: f.from, toStr: f.to! };
  }
  const days = f.range === '7d' ? 7 : f.range === '30d' ? 30 : 90;
  const fromStr = addDays(today, -(days - 1));
  return { start: startOfLocalDay(fromStr, tz), end: null, fromStr, toStr: today };
}

/** Apply search, date and project filters to a session_rows query. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters<Q extends { or: any; gte: any; lt: any; in: any; is: any }>(query: Q, f: SessionFilters, tz: string, now = Date.now()): Q {
  let q = query;
  if (f.q) {
    const v = ilikeContains(f.q);
    q = q.or(`task_name.ilike.${v},project_name.ilike.${v}`);
  }
  const b = filterBounds(f, tz, now);
  if (b.start) q = q.gte('started_at', b.start.toISOString());
  if (b.end) q = q.lt('started_at', b.end.toISOString());
  if (f.projects.length) {
    const ids = f.projects.filter((p) => p !== 'none');
    const none = f.projects.includes('none');
    if (ids.length && none) q = q.or(`project_id.in.(${ids.join(',')}),project_id.is.null`);
    else if (ids.length) q = q.in('project_id', ids);
    else q = q.is('project_id', null);
  }
  return q;
}

export function encodeCursor(value: string | number, id: string): string {
  return Buffer.from(JSON.stringify([value, id])).toString('base64url');
}

export function decodeCursor(c: string | null): [string | number, string] | null {
  if (!c) return null;
  try {
    const v = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
    if (Array.isArray(v) && v.length === 2 && UUID_RE.test(String(v[1]))) return [v[0], String(v[1])];
  } catch {
    /* fall through */
  }
  throw new HttpError(400, 'VALIDATION', MSG.badRequest, 'cursor');
}
