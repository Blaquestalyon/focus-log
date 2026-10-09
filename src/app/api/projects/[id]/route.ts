import { z } from 'zod';
import { NextResponse } from 'next/server';
import { authed, assertId, body, json, dbFail, HttpError, MSG } from '@/lib/server/http';
import { PROJECT_COLORS } from '@/lib/types';
import { projectName, taskOnClock } from '@/lib/server/tasks';
import { duplicateProjectError, listProjects } from '../helpers';

type P = { id: string };

const Patch = z.strictObject({
  name: projectName.optional(),
  color: z.enum(PROJECT_COLORS).optional(),
  archived: z.boolean().optional(),
});

export const PATCH = authed<P>(async ({ req, supabase, user }, { id }) => {
  assertId(id);
  const b = await body(req, Patch);
  const { data: cur, error } = await supabase.from('projects').select('id,name,archived_at').eq('id', id).maybeSingle();
  if (error) dbFail(error, 'projects.get');
  if (!cur) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);

  const update: Record<string, unknown> = {};
  if (b.name !== undefined) update.name = b.name;
  if (b.color !== undefined) update.color = b.color;
  if (Object.keys(update).length) {
    const r = await supabase.from('projects').update(update).eq('id', id);
    if (r.error) {
      if (r.error.code === '23505') throw duplicateProjectError(b.name!);
      dbFail(r.error, 'projects.update');
    }
  }
  if (b.archived === true && !cur.archived_at) {
    const onClock = await taskOnClock(supabase, user.id);
    if (onClock && onClock.project_id === id) {
      throw new HttpError(409, 'ON_CLOCK', `Stop the timer first — ${onClock.name} is on the clock.`);
    }
    const ts = new Date().toISOString();
    const r1 = await supabase.from('projects').update({ archived_at: ts }).eq('id', id);
    if (r1.error) dbFail(r1.error, 'projects.archive');
    const r2 = await supabase.from('tasks').update({ archived_at: ts }).eq('project_id', id).is('archived_at', null);
    if (r2.error) dbFail(r2.error, 'tasks.archive');
    await supabase.from('user_settings').update({ last_project_id: null }).eq('user_id', user.id).eq('last_project_id', id);
  } else if (b.archived === false && cur.archived_at) {
    const r1 = await supabase.from('projects').update({ archived_at: null }).eq('id', id);
    if (r1.error) dbFail(r1.error, 'projects.unarchive');
    const r2 = await supabase.from('tasks').update({ archived_at: null }).eq('project_id', id).eq('archived_at', cur.archived_at);
    if (r2.error) dbFail(r2.error, 'tasks.unarchive');
  }
  const [item] = await listProjects(supabase, true, id);
  return json(item);
});

const HAS_SESSIONS = "This project has logged time, so it can't be deleted. Archive it instead to hide it.";

export const DELETE = authed<P>(async ({ supabase, user }, { id }) => {
  assertId(id);
  const { data: cur, error } = await supabase.from('projects').select('id').eq('id', id).maybeSingle();
  if (error) dbFail(error, 'projects.get');
  if (!cur) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  const onClock = await taskOnClock(supabase, user.id);
  if (onClock && onClock.project_id === id) {
    throw new HttpError(409, 'ON_CLOCK', `Stop the timer first — ${onClock.name} in this project is on the clock.`);
  }
  const { count, error: cErr } = await supabase.from('session_rows').select('id', { count: 'exact', head: true }).eq('project_id', id);
  if (cErr) dbFail(cErr, 'projects.sessions');
  if ((count ?? 0) > 0) {
    throw new HttpError(409, 'HAS_SESSIONS', HAS_SESSIONS);
  }
  const del = await supabase.from('projects').delete().eq('id', id);
  if (del.error) {
    if (del.error.code === '23503') {
      throw new HttpError(409, 'HAS_SESSIONS', HAS_SESSIONS);
    }
    dbFail(del.error, 'projects.delete');
  }
  return new NextResponse(null, { status: 204 });
});
