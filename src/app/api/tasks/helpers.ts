import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dbFail, HttpError } from '@/lib/server/http';
import { fetchAll, ilikeContains } from '@/lib/server/rows';
import { rowSeconds } from '@/lib/time';
import type { ProjectColor, TaskItem } from '@/lib/types';

interface Filters { q?: string; projectId?: string | null | 'none'; includeArchived?: boolean; recent?: boolean; onlyId?: string }

type TaskDb = {
  id: string; name: string; archived_at: string | null; last_used_at: string | null; is_example: boolean; project_id: string | null;
  project: { id: string; name: string; color: string; archived_at: string | null } | { id: string; name: string; color: string; archived_at: string | null }[] | null;
};

export async function listTasks(supabase: SupabaseClient, f: Filters): Promise<TaskItem[]> {
  let q = supabase
    .from('tasks')
    .select('id,name,archived_at,last_used_at,is_example,project_id,project:projects(id,name,color,archived_at)');
  if (f.onlyId) q = q.eq('id', f.onlyId);
  if (!f.includeArchived) q = q.is('archived_at', null);
  if (f.projectId === 'none') q = q.is('project_id', null);
  else if (f.projectId) q = q.eq('project_id', f.projectId);
  if (f.q) q = q.or(`name.ilike.${ilikeContains(f.q)}`);
  if (f.recent) q = q.not('last_used_at', 'is', null).order('last_used_at', { ascending: false }).limit(6);
  else q = q.order('last_used_at', { ascending: false, nullsFirst: false }).order('name', { ascending: true }).limit(2000);
  const { data, error } = await q;
  if (error) dbFail(error, 'tasks.list');
  const rows = (data ?? []) as TaskDb[];
  const stats = new Map<string, { n: number; s: number }>();
  if (rows.length) {
    const sessions = await fetchAll<{ task_id: string; duration_seconds: number | null; started_at: string }>(
      (from, to) => supabase.from('sessions').select('task_id,duration_seconds,started_at').order('id').range(from, to),
      'tasks.sessions',
    );
    const now = Date.now();
    for (const s of sessions) {
      const cur = stats.get(s.task_id) ?? { n: 0, s: 0 };
      cur.n += 1;
      cur.s += rowSeconds(s, now);
      stats.set(s.task_id, cur);
    }
  }
  return rows.map((t) => {
    const p = Array.isArray(t.project) ? t.project[0] : t.project;
    return {
      id: t.id,
      name: t.name,
      project: p ? { id: p.id, name: p.name, color: p.color as ProjectColor, archived: Boolean(p.archived_at) } : null,
      archived: Boolean(t.archived_at),
      session_count: stats.get(t.id)?.n ?? 0,
      total_seconds: stats.get(t.id)?.s ?? 0,
      last_used_at: t.last_used_at,
      is_example: t.is_example,
    };
  });
}

export async function duplicateTaskError(supabase: SupabaseClient, name: string, projectId: string | null): Promise<HttpError> {
  if (!projectId) return new HttpError(409, 'DUPLICATE_NAME', `You already have a task called "${name}" with no project.`, 'name');
  const { data } = await supabase.from('projects').select('name').eq('id', projectId).maybeSingle();
  return new HttpError(409, 'DUPLICATE_NAME', `You already have a task called "${name}" in ${data?.name ?? 'that project'}.`, 'name');
}

/** The chosen project was deleted (or isn't the owner's). */
export function projectGone(): HttpError {
  return new HttpError(404, 'NOT_FOUND', 'That project no longer exists.', 'project_id');
}
