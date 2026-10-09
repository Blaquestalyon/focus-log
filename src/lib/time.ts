/**
 * Time-zone aware calendar math (blueprint §6 "Time zone, days, weeks and months").
 * Boundaries are always computed in the owner's saved zone with TZDate — never with the
 * server's or the browser's local time. Dates as strings are `YYYY-MM-DD` local to the zone.
 */
import { TZDate } from '@date-fns/tz';

export type DateStr = string; // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of an instant in `tz`. */
export function localDateStr(instant: Date | number | string, tz: string): DateStr {
  const d = new TZDate(new Date(instant).getTime(), tz);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local wall-clock `HH:MM` (24h) of an instant in `tz`. */
export function localTimeStr(instant: Date | number | string, tz: string): string {
  const d = new TZDate(new Date(instant).getTime(), tz);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateStr(s: DateStr): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function isDateStr(s: unknown): s is DateStr {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseDateStr(s);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Pure calendar arithmetic on a date string. */
export function addDays(s: DateStr, n: number): DateStr {
  const { y, m, d } = parseDateStr(s);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addMonths(s: DateStr, n: number): DateStr {
  const { y, m } = parseDateStr(s);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-01`;
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(s: DateStr): number {
  const { y, m, d } = parseDateStr(s);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function mondayOf(s: DateStr): DateStr {
  return addDays(s, -weekdayIndex(s));
}

export function firstOfMonth(s: DateStr): DateStr {
  return `${s.slice(0, 7)}-01`;
}

export function daysInMonth(s: DateStr): number {
  const { y, m } = parseDateStr(s);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The instant of local midnight at the start of `s` in `tz`. */
export function startOfLocalDay(s: DateStr, tz: string): Date {
  const { y, m, d } = parseDateStr(s);
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, 0, tz).getTime());
}

/** Instant for a local date + `HH:MM` wall time in `tz`. */
export function localDateTimeToInstant(s: DateStr, hhmm: string, tz: string): Date {
  const { y, m, d } = parseDateStr(s);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, tz).getTime());
}

export interface Range { start: Date; end: Date }

export function dayRange(s: DateStr, tz: string): Range {
  return { start: startOfLocalDay(s, tz), end: startOfLocalDay(addDays(s, 1), tz) };
}

export function weekRange(monday: DateStr, tz: string): Range {
  return { start: startOfLocalDay(monday, tz), end: startOfLocalDay(addDays(monday, 7), tz) };
}

export function monthRange(first: DateStr, tz: string): Range {
  return { start: startOfLocalDay(first, tz), end: startOfLocalDay(addMonths(first, 1), tz) };
}

/** Whole seconds from `startMs` to `endMs`, never negative. */
export function elapsedSeconds(startMs: number, endMs: number): number {
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

/** When a session row ends: its `ended_at`, or `nowMs` while it is still running. */
export function rowEndMs(r: { ended_at: string | null }, nowMs: number): number {
  return r.ended_at ? Date.parse(r.ended_at) : nowMs;
}

/** A session row's seconds: its stored duration, or the time since it started while it runs. */
export function rowSeconds(r: { duration_seconds: number | null; started_at: string }, nowMs: number): number {
  return r.duration_seconds ?? elapsedSeconds(Date.parse(r.started_at), nowMs);
}

/** Seconds of [start, end) that fall inside [pStart, pEnd). */
export function clipSeconds(start: Date, end: Date, pStart: Date, pEnd: Date): number {
  return elapsedSeconds(Math.max(start.getTime(), pStart.getTime()), Math.min(end.getTime(), pEnd.getTime()));
}

/** Seconds of a session row (running rows end at `nowMs`) that fall inside [pStart, pEnd). */
export function clipRowSeconds(r: { started_at: string; ended_at: string | null }, pStart: Date, pEnd: Date, nowMs: number): number {
  return clipSeconds(new Date(r.started_at), new Date(rowEndMs(r, nowMs)), pStart, pEnd);
}

export function todayStr(tz: string, now: Date | number = Date.now()): DateStr {
  return localDateStr(now, tz);
}

/** Every IANA zone the runtime knows, plus UTC. */
export function supportedTimeZones(): string[] {
  const list = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return list.includes('UTC') ? list : [...list, 'UTC'];
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  return supportedTimeZones().includes(tz);
}

/** `UTC−04:00` style offset label for a zone at an instant. */
export function utcOffsetLabel(tz: string, at: Date = new Date()): string {
  const d = new TZDate(at.getTime(), tz);
  const offMin = -d.getTimezoneOffset();
  const sign = offMin < 0 ? '−' : '+';
  const a = Math.abs(offMin);
  return `UTC${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
