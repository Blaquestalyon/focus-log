import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError, dbFail, MSG } from './http';
import { ilikeExact } from './rows';

export const TASK_NAME_MAX = 80;
export const PROJECT_NAME_MAX = 60;

export function cleanTaskName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new HttpError(400, 'VALIDATION', 'Type a task name.', 'task_name');
  if (name.length > TASK_NAME_MAX) throw new HttpError(400, 'VALIDATION', 'Keep task names under 80 characters.', 'task_name');
  return name;
}

async function findTaskByName(supabase: SupabaseClient, name: string, projectId: string | null) {
  let q = supabase.from('tasks').select('id,name,archived_at,project_id').ilike('name', ilikeExact(name));
  q = projectId ? q.eq('project_id', projectId) : q.is('project_id', null);
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) dbFail(error, 'tasks.find');
  return data as { id: string; name: string; archived_at: string | null; project_id: string | null } | null;
}

/**
 * Starting or adding time "by name" reuses an existing task under that project (unarchiving it
 * if needed) instead of creating a duplicate; a race on the unique index re-selects (§6).
 */
export async function resolveTaskByName(
  supabase: SupabaseClient,
  rawName: string,
  projectId: string | null,
): Promise<{ id: string; name: string; unarchived: boolean; created: boolean }> {
  const name = cleanTaskName(rawName);
  if (projectId) {
    const { data, error } = await supabase.from('projects').select('id').eq('id', projectId).maybeSingle();
    if (error) dbFail(error, 'projects.check');
    if (!data) throw new HttpError(404, 'NOT_FOUND', MSG.notFound, 'project_id');
  }
  let found = await findTaskByName(supabase, name, projectId);
  if (!found) {
    const ins = await supabase.from('tasks').insert({ name, project_id: projectId }).select('id,name').single();
    if (!ins.error) return { id: ins.data.id, name: ins.data.name, unarchived: false, created: true };
    if (ins.error.code !== '23505') dbFail(ins.error, 'tasks.insert');
    found = await findTaskByName(supabase, name, projectId);
    if (!found) dbFail(ins.error, 'tasks.reselect');
  }
  if (found.archived_at) {
    const { error } = await supabase.from('tasks').update({ archived_at: null }).eq('id', found.id);
    if (error) dbFail(error, 'tasks.unarchive');
    return { id: found.id, name: found.name, unarchived: true, created: false };
  }
  return { id: found.id, name: found.name, unarchived: false, created: false };
}

/** The task currently on the clock (running or paused), with its project. */
export async function taskOnClock(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('timer_state')
    .select('status, task_id, tasks:task_id(id, name, project_id)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) dbFail(error, 'timer_state');
  if (!data || data.status === 'idle' || !data.task_id) return null;
  const t = (Array.isArray(data.tasks) ? data.tasks[0] : data.tasks) as { id: string; name: string; project_id: string | null } | null;
  return t;
}
