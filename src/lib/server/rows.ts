import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProjectColor, SessionRow } from '@/lib/types';
import { dbFail } from './http';
import { elapsedSeconds } from '@/lib/time';

/** A row of the public.session_rows view. */
export interface ViewRow {
  id: string;
  user_id: string;
  task_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  source: 'timer' | 'manual';
  run_id: string | null;
  end_reason: 'pause' | 'stop' | 'switch' | null;
  edited_at: string | null;
  nudge_acknowledged_at: string | null;
  is_example: boolean;
  task_name: string;
  task_archived_at: string | null;
  project_id: string | null;
  project_name: string | null;
  project_color: ProjectColor | null;
  project_archived_at: string | null;
}

export const VIEW_COLUMNS =
  'id,user_id,task_id,started_at,ended_at,duration_seconds,source,run_id,end_reason,edited_at,nudge_acknowledged_at,is_example,task_name,task_archived_at,project_id,project_name,project_color,project_archived_at';

export function toSessionRow(r: ViewRow, nowMs: number, extra: Partial<SessionRow> = {}): SessionRow {
  const live = r.ended_at ? null : elapsedSeconds(Date.parse(r.started_at), nowMs);
  return {
    id: r.id,
    task: { id: r.task_id, name: r.task_name, archived: Boolean(r.task_archived_at) },
    project: r.project_id
      ? { id: r.project_id, name: r.project_name ?? '', color: (r.project_color ?? 'azure') as ProjectColor, archived: Boolean(r.project_archived_at) }
      : null,
    started_at: new Date(r.started_at).toISOString(),
    ended_at: r.ended_at ? new Date(r.ended_at).toISOString() : null,
    duration_seconds: r.duration_seconds,
    live_seconds: live,
    source: r.source,
    end_reason: r.end_reason,
    edited: Boolean(r.edited_at),
    is_example: r.is_example,
    ...extra,
  };
}

/** Page through a query 1000 rows at a time (PostgREST caps a response). */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>,
  context: string,
  max = 60000,
): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; from < max; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) dbFail(error, context);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

/**
 * Escape text for a PostgREST ilike value inside double quotes (`%` and `_` literal). Two layers:
 * `ilikeExact` escapes for ILIKE (`\%`), then PostgREST's quoted string consumes one backslash, so
 * every backslash and quote is escaped again for it (`\\%` reaches ILIKE as `\%`).
 */
export function ilikeContains(q: string): string {
  return `"*${ilikeExact(q).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}*"`;
}

/** Exact, case-insensitive match value for `.ilike()` (no wildcards). */
export function ilikeExact(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function loadViewRow(supabase: SupabaseClient, id: string): Promise<ViewRow | null> {
  const { data, error } = await supabase.from('session_rows').select(VIEW_COLUMNS).eq('id', id).maybeSingle();
  if (error) dbFail(error, 'session_rows');
  return (data as ViewRow | null) ?? null;
}
