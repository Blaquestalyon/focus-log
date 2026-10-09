import { z } from 'zod';
import { authed, body, json, uuid, dbFail } from '@/lib/server/http';
import { getSettingsRow } from '@/lib/server/settings';
import { VIEW_COLUMNS, toSessionRow, fetchAll, loadViewRow, type ViewRow } from '@/lib/server/rows';
import { applyFilters, decodeCursor, encodeCursor, parseFilters } from '@/lib/server/history';
import { assertTaskExists, resolveTaskByName } from '@/lib/server/tasks';
import { overlapError, sessionTooLong, validateClosedRange } from '@/lib/server/overlap';
import { elapsedSeconds, localDateStr, rowEndMs } from '@/lib/time';
import type { SessionsResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** History list: filters, keyset paging, totals and per-day totals over the whole filtered set. */
export const GET = authed(async ({ req, supabase, user }) => {
  const sp = req.nextUrl.searchParams;
  const f = parseFilters(sp);
  const limit = Math.min(50, Math.max(1, Number(sp.get('limit') ?? 50) || 50));
  const cursor = decodeCursor(sp.get('cursor'));
  const st = await getSettingsRow(supabase, user.id);
  const tz = st.time_zone;
  const now = Date.now();

  let rows: ViewRow[] = [];
  if (f.sort === 'date') {
    let q = applyFilters(supabase.from('session_rows').select(VIEW_COLUMNS), f, tz, now);
    if (cursor) {
      const [v, id] = cursor;
      q = q.or(`started_at.lt."${v}",and(started_at.eq."${v}",id.lt.${id})`);
    }
    const { data, error } = await q.order('started_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
    if (error) dbFail(error, 'sessions.list');
    rows = data as ViewRow[];
  } else {
    let pinned: ViewRow[] = [];
    if (!cursor) {
      const { data, error } = await applyFilters(supabase.from('session_rows').select(VIEW_COLUMNS), f, tz, now).is('ended_at', null);
      if (error) dbFail(error, 'sessions.running');
      pinned = data as ViewRow[];
    }
    let q = applyFilters(supabase.from('session_rows').select(VIEW_COLUMNS), f, tz, now).not('ended_at', 'is', null);
    if (cursor) {
      const [v, id] = cursor;
      q = q.or(`duration_seconds.lt.${Number(v)},and(duration_seconds.eq.${Number(v)},id.lt.${id})`);
    }
    const { data, error } = await q.order('duration_seconds', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
    if (error) dbFail(error, 'sessions.list');
    rows = [...pinned, ...(data as ViewRow[])];
    if (pinned.length) {
      // the pinned running row does not take a paging slot
      const page = data as ViewRow[];
      const hasMore = page.length > limit;
      const slice = page.slice(0, limit);
      rows = [...pinned, ...slice];
      const last = slice[slice.length - 1];
      return json(await finish(rows, hasMore && last ? encodeCursor(last.duration_seconds ?? 0, last.id) : null));
    }
  }
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const next = hasMore && last ? (f.sort === 'date' ? encodeCursor(last.started_at, last.id) : encodeCursor(last.duration_seconds ?? 0, last.id)) : null;
  return json(await finish(page, next));

  async function finish(page: ViewRow[], next_cursor: string | null): Promise<SessionsResponse> {
    const all = await fetchAll<{ started_at: string; ended_at: string | null; duration_seconds: number | null }>(
      (from, to) =>
        applyFilters(supabase.from('session_rows').select('started_at,ended_at,duration_seconds'), f, tz, now)
          .order('started_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
      'sessions.totals',
    );
    let total = 0;
    const byDay = new Map<string, number>();
    for (const r of all) {
      const sec = r.duration_seconds ?? elapsedSeconds(Date.parse(r.started_at), rowEndMs(r, now));
      total += sec;
      const d = localDateStr(r.started_at, tz);
      byDay.set(d, (byDay.get(d) ?? 0) + sec);
    }
    const pageDays = new Set(page.map((r) => localDateStr(r.started_at, tz)));
    return {
      rows: page.map((r) => toSessionRow(r, now)),
      next_cursor,
      total_count: all.length,
      total_seconds: total,
      day_totals: [...pageDays].map((date) => ({ date, seconds: byDay.get(date) ?? 0 })),
    };
  }
});

const Create = z.union([
  z.strictObject({ task_id: uuid, started_at: z.string().datetime({ offset: true }), ended_at: z.string().datetime({ offset: true }) }),
  z.strictObject({
    task_name: z.string().max(200),
    project_id: uuid.nullable(),
    started_at: z.string().datetime({ offset: true }),
    ended_at: z.string().datetime({ offset: true }),
  }),
]);

/** F10 Add time: a manual session. */
export const POST = authed(async ({ req, supabase, user }) => {
  const b = await body(req, Create);
  const start = new Date(b.started_at);
  const end = new Date(b.ended_at);
  validateClosedRange(start, end, Date.now(), { manual: true });
  let taskId: string;
  if ('task_id' in b) {
    await assertTaskExists(supabase, b.task_id);
    taskId = b.task_id;
  } else {
    taskId = (await resolveTaskByName(supabase, b.task_name, b.project_id)).id;
  }
  const { data, error } = await supabase
    .from('sessions')
    .insert({ task_id: taskId, started_at: start.toISOString(), ended_at: end.toISOString(), source: 'manual' })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23P01') {
      const st = await getSettingsRow(supabase, user.id);
      throw await overlapError(supabase, start, end, st.time_zone);
    }
    if (error.code === '23514') throw sessionTooLong();
    dbFail(error, 'sessions.insert');
  }
  const row = await loadViewRow(supabase, data.id);
  return json(toSessionRow(row!, Date.now()), 201);
});
