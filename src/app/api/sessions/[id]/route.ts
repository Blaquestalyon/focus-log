import { z } from 'zod';
import { NextResponse } from 'next/server';
import { authed, body, json, uuid, dbFail, HttpError, MSG } from '@/lib/server/http';
import { getSettingsRow } from '@/lib/server/settings';
import { toSessionRow, loadViewRow } from '@/lib/server/rows';
import { overlapError, validateClosedRange } from '@/lib/server/overlap';

const Patch = z.strictObject({
  task_id: uuid.optional(),
  started_at: z.string().datetime({ offset: true }).optional(),
  ended_at: z.string().datetime({ offset: true }).optional(),
});

type P = { id: string };

/** One session (used by History's `?session=<id>` deep link). */
export const GET = authed<P>(async ({ supabase }, { id }) => {
  if (!uuid.safeParse(id).success) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  const row = await loadViewRow(supabase, id);
  if (!row) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  return json(toSessionRow(row, Date.now()));
});

/** F11 Edit a session (or the running session's start time). */
export const PATCH = authed<P>(async ({ req, supabase, user }, { id }) => {
  if (!uuid.safeParse(id).success) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  const b = await body(req, Patch);
  const cur = await loadViewRow(supabase, id);
  if (!cur) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  const now = Date.now();
  const st = await getSettingsRow(supabase, user.id);
  const update: Record<string, unknown> = {};

  if (!cur.ended_at) {
    if (b.task_id && b.task_id !== cur.task_id) throw new HttpError(409, 'RUNNING_EDIT', 'Switch tasks from the Timer instead.', 'task_id');
    if (b.ended_at) throw new HttpError(409, 'RUNNING_EDIT', 'Stop the timer to set an end time.', 'ended_at');
    if (b.started_at) {
      const s = new Date(b.started_at);
      if (s.getTime() > now) throw new HttpError(400, 'VALIDATION', "The start time can't be in the future.", 'started_at');
      if (s.getTime() !== Date.parse(cur.started_at)) update.started_at = s.toISOString();
    }
  } else {
    const s = b.started_at ? new Date(b.started_at) : new Date(cur.started_at);
    const e = b.ended_at ? new Date(b.ended_at) : new Date(cur.ended_at);
    if (b.started_at || b.ended_at) validateClosedRange(s, e, now, { manual: cur.source === 'manual' });
    if (s.getTime() !== Date.parse(cur.started_at)) update.started_at = s.toISOString();
    if (e.getTime() !== Date.parse(cur.ended_at)) update.ended_at = e.toISOString();
    if (b.task_id && b.task_id !== cur.task_id) {
      const { data, error } = await supabase.from('tasks').select('id').eq('id', b.task_id).maybeSingle();
      if (error) dbFail(error, 'tasks.get');
      if (!data) throw new HttpError(404, 'NOT_FOUND', 'That task no longer exists. Pick another or type a new one.', 'task_id');
      update.task_id = b.task_id;
    }
  }
  if (Object.keys(update).length) {
    update.edited_at = new Date().toISOString();
    const { error } = await supabase.from('sessions').update(update).eq('id', id);
    if (error) {
      if (error.code === '23P01') {
        const s = new Date((update.started_at as string) ?? cur.started_at);
        const e = cur.ended_at ? new Date((update.ended_at as string) ?? cur.ended_at) : null;
        throw await overlapError(supabase, s, e, st.time_zone, id);
      }
      if (error.code === '23514') {
        throw new HttpError(400, 'VALIDATION', 'A single session can be at most 24 hours. Split it into two entries.', 'ended_at');
      }
      dbFail(error, 'sessions.update');
    }
  }
  const row = await loadViewRow(supabase, id);
  if (!row) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  return json(toSessionRow(row, Date.now()));
});

/** F12 Delete a closed session. */
export const DELETE = authed<P>(async ({ supabase }, { id }) => {
  if (!uuid.safeParse(id).success) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  const { data, error } = await supabase.from('sessions').select('id, ended_at').eq('id', id).maybeSingle();
  if (error) dbFail(error, 'sessions.get');
  if (!data) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  if (!data.ended_at) throw new HttpError(409, 'RUNNING', 'Stop or discard the timer first.');
  const del = await supabase.from('sessions').delete().eq('id', id);
  if (del.error) dbFail(del.error, 'sessions.delete');
  return new NextResponse(null, { status: 204 });
});
