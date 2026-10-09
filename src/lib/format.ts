/**
 * Shared display formats (blueprint §4 "Shared formats"). Locale en-US, owner's time zone.
 * Used by every screen, the API's error copy and the emails, so they always agree.
 */
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { addDays, localDateStr, parseDateStr, type DateStr } from './time';

const MINUS = '−';
const EN_DASH = '–';

/** Clock: `H:MM:SS`, hours unpadded and unbounded. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** `H:MM` for the icon rail mini-timer. */
export function formatClockShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}

/** Duration: `0m`, `<1m`, `42m`, `1h 05m`. Seconds are summed first, then floored to minutes. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s === 0) return '0m';
  if (s < 60) return '<1m';
  const totalMin = Math.floor(s / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Delta: `+2h 10m`, `−1h 05m`, `No change`, or `—` when the previous total is zero. */
export function formatDelta(current: number, previous: number): string {
  if (previous <= 0) return '—';
  const diff = Math.floor(current) - Math.floor(previous);
  if (Math.floor(Math.abs(diff) / 60) === 0) return 'No change';
  return `${diff > 0 ? '+' : MINUS}${formatDuration(Math.abs(diff))}`;
}

/** Words for screen readers: "1 hour 2 minutes". */
export function durationWords(totalSeconds: number): string {
  const totalMin = Math.floor(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}

function tzd(instant: Date | number | string, tz: string) {
  return new TZDate(new Date(instant).getTime(), tz);
}

/** Time: `9:02 AM`. */
export function formatTime(instant: Date | number | string, tz: string): string {
  return format(tzd(instant, tz), 'h:mm a');
}

/** Range: `9:00–10:12 AM`, `11:40 PM–12:25 AM`, `9:02 AM–now`. */
export function formatTimeRange(start: Date | number | string, end: Date | number | string | null, tz: string): string {
  if (end === null || end === undefined) return `${formatTime(start, tz)}${EN_DASH}now`;
  const a = tzd(start, tz);
  const b = tzd(end, tz);
  const ma = format(a, 'a');
  const mb = format(b, 'a');
  if (ma === mb) return `${format(a, 'h:mm')}${EN_DASH}${format(b, 'h:mm a')}`;
  return `${format(a, 'h:mm a')}${EN_DASH}${format(b, 'h:mm a')}`;
}

/** Date: `Wed, Oct 8` in the current year, `Wed, Oct 8, 2025` otherwise. */
export function formatDate(instant: Date | number | string, tz: string, now: Date | number = Date.now()): string {
  return formatDateStr(localDateStr(instant, tz), tz, now);
}

export function formatDateStr(s: DateStr, tz: string, now: Date | number = Date.now()): string {
  const { y, m, d } = parseDateStr(s);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const sameYear = y === Number(localDateStr(now, tz).slice(0, 4));
  const base = `${WD_SHORT[dt.getUTCDay()]}, ${MON_SHORT[m - 1]} ${d}`;
  return sameYear ? base : `${base}, ${y}`;
}

/** Day header: `Wednesday, October 8` (+`, 2025` in other years). */
export function formatDayLong(s: DateStr, tz: string, now: Date | number = Date.now()): string {
  const { y, m, d } = parseDateStr(s);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const sameYear = y === Number(localDateStr(now, tz).slice(0, 4));
  const base = `${WD_LONG[dt.getUTCDay()]}, ${MON_LONG[m - 1]} ${d}`;
  return sameYear ? base : `${base}, ${y}`;
}

/** Day header with Today/Yesterday: `Today · Wed, Oct 8`, `Yesterday · Tue, Oct 7`, else long form. */
export function formatDayHeader(s: DateStr, tz: string, now: Date | number = Date.now()): string {
  const today = localDateStr(now, tz);
  if (s === today) return `Today · ${formatDateStr(s, tz, now)}`;
  if (s === addDays(today, -1)) return `Yesterday · ${formatDateStr(s, tz, now)}`;
  return formatDayLong(s, tz, now);
}

/** Week range: `Oct 6 – 12, 2026`, `Sep 29 – Oct 5, 2026`, `Dec 29, 2025 – Jan 4, 2026`. */
export function formatWeekRange(monday: DateStr): string {
  const sunday = addDays(monday, 6);
  const a = parseDateStr(monday);
  const b = parseDateStr(sunday);
  if (a.y !== b.y) return `${MON_SHORT[a.m - 1]} ${a.d}, ${a.y} ${EN_DASH} ${MON_SHORT[b.m - 1]} ${b.d}, ${b.y}`;
  if (a.m !== b.m) return `${MON_SHORT[a.m - 1]} ${a.d} ${EN_DASH} ${MON_SHORT[b.m - 1]} ${b.d}, ${b.y}`;
  return `${MON_SHORT[a.m - 1]} ${a.d} ${EN_DASH} ${b.d}, ${b.y}`;
}

/** Month: `October 2026`. */
export function formatMonth(first: DateStr): string {
  const { y, m } = parseDateStr(first);
  return `${MON_LONG[m - 1]} ${y}`;
}

/** Share: whole percent, `<1%` for anything above 0 and under 1%. */
export function formatShare(percent: number): string {
  if (percent > 0 && percent < 1) return '<1%';
  return `${Math.round(percent)}%`;
}

/** `Mon 6` for week chart labels. */
export function formatWeekdayDay(s: DateStr): string {
  const { y, m, d } = parseDateStr(s);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return `${WD_SHORT[dt.getUTCDay()]} ${d}`;
}

/** `Mon, Oct 6, 8:00 AM` for the Sent emails table. */
export function formatDateTime(instant: Date | number | string, tz: string, now: Date | number = Date.now()): string {
  return `${formatDate(instant, tz, now)}, ${formatTime(instant, tz)}`;
}

/** STARTED flank: `9:02 AM`, `Yesterday 11:40 PM`, `Tue, Oct 7 11:40 PM`. */
export function formatStartedFlank(instant: Date | number | string, tz: string, now: Date | number = Date.now()): string {
  const day = localDateStr(instant, tz);
  const today = localDateStr(now, tz);
  const t = formatTime(instant, tz);
  if (day === today) return t;
  if (day === addDays(today, -1)) return `Yesterday ${t}`;
  return `${formatDateStr(day, tz, now)} ${t}`;
}

/** `Oct 8` (no weekday) used in "Last seen Oct 8". */
export function formatMonthDay(instant: Date | number | string, tz: string): string {
  const { m, d } = parseDateStr(localDateStr(instant, tz));
  return `${MON_SHORT[m - 1]} ${d}`;
}

/** Seconds since → "32 seconds ago" / "14 minutes ago". */
export function formatAgo(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} ${s === 1 ? 'second' : 'seconds'} ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  const h = Math.floor(m / 60);
  return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
}

/** Reminder threshold label: `30 minutes`, `1 hour`, `1 hour 30 minutes`, `12 hours`. */
export function formatThreshold(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hs = h ? `${h} ${h === 1 ? 'hour' : 'hours'}` : '';
  const ms = m ? `${m} minutes` : '';
  return [hs, ms].filter(Boolean).join(' ') || '0 minutes';
}

export const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
