import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatTime, formatTimeRange } from '@/lib/format';
import { HttpError } from './http';

/**
 * On SQLSTATE 23P01 find the first session that overlaps [start, end) and name it (§6).
 * `end` null means an open-ended range (a running session being edited).
 */
export async function overlapError(
  supabase: SupabaseClient,
  start: Date,
  end: Date | null,
  tz: string,
  excludeId?: string,
): Promise<HttpError> {
  let q = supabase
    .from('session_rows')
    .select('id, task_name, started_at, ended_at')
    .or(`ended_at.is.null,ended_at.gt.${start.toISOString()}`)
    .order('started_at', { ascending: true })
    .limit(5);
  if (end) q = q.lt('started_at', end.toISOString());
  if (excludeId) q = q.neq('id', excludeId);
  const { data } = await q;
  const hit = (data ?? [])[0] as { task_name: string; started_at: string; ended_at: string | null } | undefined;
  if (!hit) {
    return new HttpError(409, 'OVERLAP', "This overlaps another session. Adjust the times so they don't overlap.");
  }
  if (!hit.ended_at) {
    return new HttpError(
      409,
      'OVERLAP',
      `This overlaps your running timer (${hit.task_name}, since ${formatTime(hit.started_at, tz)}). Adjust the times so they don't overlap.`,
    );
  }
  return new HttpError(
    409,
    'OVERLAP',
    `This overlaps another session (${hit.task_name}, ${formatTimeRange(hit.started_at, hit.ended_at, tz)}). Adjust the times so they don't overlap.`,
  );
}

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 3600 * 1000;

/** §6 "Sessions (manual add and edit)" checks on a closed range. */
export function validateClosedRange(start: Date, end: Date, nowMs: number, opts: { manual: boolean }) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new HttpError(400, 'VALIDATION', "That request wasn't valid.");
  }
  if (start.getTime() > nowMs || end.getTime() > nowMs) {
    throw new HttpError(400, 'VALIDATION', "Times can't be in the future.", end.getTime() > nowMs ? 'ended_at' : 'started_at');
  }
  if (end.getTime() <= start.getTime()) {
    throw new HttpError(400, 'VALIDATION', 'The end time has to be after the start time.', 'ended_at');
  }
  if (end.getTime() - start.getTime() > 24 * 3600 * 1000) {
    throw new HttpError(400, 'VALIDATION', 'A single session can be at most 24 hours. Split it into two entries.', 'ended_at');
  }
  if (opts.manual && end.getTime() - start.getTime() < 60 * 1000) {
    throw new HttpError(400, 'VALIDATION', 'Entries need to be at least 1 minute long.', 'ended_at');
  }
  if (start.getTime() < nowMs - FIVE_YEARS_MS) {
    throw new HttpError(400, 'VALIDATION', 'Pick a date within the last 5 years.', 'started_at');
  }
}
