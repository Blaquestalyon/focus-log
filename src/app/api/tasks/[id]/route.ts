import { z } from 'zod';
import { NextResponse } from 'next/server';
import { authed, assertId, body, json, dbFail, HttpError, MSG, uuid } from '@/lib/server/http';
import { taskOnClock, taskName } from '@/lib/server/tasks';
import { listTasks, duplicateTaskError, projectGone } from '../helpers';

type P = { id: string };

const Patch = z.strictObject({
  name: taskName.optional(),
  project_id: uuid.nullable().optional(),
  archived: z.boolean().optional(),
});

export const PATCH = authed<P>(async ({ req, supabase, user }, { id }) => {
  assertId(id);
  const b = await body(req, Patch);
  const { data: cur, error } = await supabase.from('tasks').select('id,name,project_id,archived_at').eq('id', id).maybeSingle();
  if (error) dbFail(error, 'tasks.get');
  if (!cur) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  const update: Record<string, unknown> = {};
  if (b.name !== undefined) update.name = b.name;
  if (b.project_id !== undefined) update.project_id = b.project_id;
  if (b.archived === true && !cur.archived_at) {
    const onClock = await taskOnClock(supabase, user.id);
    if (onClock && onClock.id === id) throw new HttpError(409, 'ON_CLOCK', `Stop the timer first — ${cur.name} is on the clock.`);
    update.archived_at = new Date().toISOString();
  } else if (b.archived === false && cur.archived_at) {
    update.archived_at = null;
  }
  if (Object.keys(update).length) {
    const r = await supabase.from('tasks').update(update).eq('id', id);
    if (r.error) {
      if (r.error.code === '23505') {
        throw await duplicateTaskError(supabase, (b.name ?? cur.name) as string, (b.project_id !== undefined ? b.project_id : cur.project_id) as string | null);
      }
      if (r.error.code === '42501') throw projectGone();
      dbFail(r.error, 'tasks.update');
    }
  }
  const [item] = await listTasks(supabase, { onlyId: id, includeArchived: true });
  return json(item);
});

const HAS_SESSIONS = "This task has logged time, so it can't be deleted. Archive it instead to hide it.";

export const DELETE = authed<P>(async ({ supabase, user }, { id }) => {
  assertId(id);
  const { data: cur, error } = await supabase.from('tasks').select('id,name').eq('id', id).maybeSingle();
  if (error) dbFail(error, 'tasks.get');
  if (!cur) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  const onClock = await taskOnClock(supabase, user.id);
  if (onClock && onClock.id === id) throw new HttpError(409, 'ON_CLOCK', `Stop the timer first — ${cur.name} is on the clock.`);
  const { count } = await supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('task_id', id);
  if ((count ?? 0) > 0) {
    throw new HttpError(409, 'HAS_SESSIONS', HAS_SESSIONS);
  }
  const del = await supabase.from('tasks').delete().eq('id', id);
  if (del.error) {
    if (del.error.code === '23503') throw new HttpError(409, 'HAS_SESSIONS', HAS_SESSIONS);
    dbFail(del.error, 'tasks.delete');
  }
  return new NextResponse(null, { status: 204 });
});
