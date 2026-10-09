/** CSV export (§6 "CSV export"): UTF-8 with BOM, RFC 4180 quoting, CRLF, formula guard. */
import { localDateStr, localTimeStr } from '@/lib/time';

export const CSV_HEADER = ['date', 'start', 'end', 'duration_minutes', 'duration_hours', 'task', 'project', 'source', 'edited', 'session_id'];

export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface CsvSession {
  id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  task_name: string;
  project_name: string | null;
  source: string;
  edited_at: string | null;
}

export function csvLine(r: CsvSession, tz: string): string {
  const startDate = localDateStr(r.started_at, tz);
  const endDate = localDateStr(r.ended_at, tz);
  const end = endDate === startDate ? localTimeStr(r.ended_at, tz) : `${endDate} ${localTimeStr(r.ended_at, tz)}`;
  const minutes = Math.floor(r.duration_seconds / 60);
  const hours = (r.duration_seconds / 3600).toFixed(2);
  return [
    startDate,
    localTimeStr(r.started_at, tz),
    end,
    minutes,
    hours,
    r.task_name,
    r.project_name ?? '',
    r.source,
    r.edited_at ? 'yes' : 'no',
    r.id,
  ]
    .map(csvCell)
    .join(',');
}

export function buildCsv(rows: CsvSession[], tz: string): string {
  return '﻿' + [CSV_HEADER.join(','), ...rows.map((r) => csvLine(r, tz))].join('\r\n') + '\r\n';
}
