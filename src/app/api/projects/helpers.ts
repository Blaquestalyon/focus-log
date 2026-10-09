import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dbFail, HttpError } from '@/lib/server/http';
import { fetchAll } from '@/lib/server/rows';
import { rowSeconds } from '@/lib/time';
import type { ProjectColor, ProjectItem } from '@/lib/types';

export async function listProjects(supabase: SupabaseClient, includeArchived: boolean, onlyId?: string): Promise<ProjectItem[]> {
  let q = supabase.from('projects').select('id,name,color,archived_at,is_example').order('name', { ascending: true });
  if (!includeArchived) q = q.is('archived_at', null);
  if (onlyId) q = q.eq('id', onlyId);
  const { data: projects, error } = await q;
  if (error) dbFail(error, 'projects.list');
  const tasks = await fetchAll<{ project_id: string | null; last_used_at: string | null }>(
    (from, to) => supabase.from('tasks').select('project_id,last_used_at').not('project_id', 'is', null).order('id').range(from, to),
    'projects.tasks',
  );
  const sessions = await fetchAll<{ project_id: string | null; duration_seconds: number | null; started_at: string }>(
    (from, to) =>
      supabase.from('session_rows').select('project_id,duration_seconds,started_at').not('project_id', 'is', null).order('id').range(from, to),
    'projects.sessions',
  );
  const now = Date.now();
  const taskCount = new Map<string, number>();
  const lastUsed = new Map<string, string>();
  for (const t of tasks) {
    if (!t.project_id) continue;
    taskCount.set(t.project_id, (taskCount.get(t.project_id) ?? 0) + 1);
    if (t.last_used_at && (!lastUsed.get(t.project_id) || t.last_used_at > lastUsed.get(t.project_id)!)) lastUsed.set(t.project_id, t.last_used_at);
  }
  const totals = new Map<string, number>();
  for (const s of sessions) {
    if (!s.project_id) continue;
    totals.set(s.project_id, (totals.get(s.project_id) ?? 0) + rowSeconds(s, now));
  }
  return (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color as ProjectColor,
    archived: Boolean(p.archived_at),
    task_count: taskCount.get(p.id) ?? 0,
    total_seconds: totals.get(p.id) ?? 0,
    last_used_at: lastUsed.get(p.id) ?? null,
    is_example: p.is_example,
  }));
}

export function duplicateProjectError(name: string): HttpError {
  return new HttpError(409, 'DUPLICATE_NAME', `You already have a project called "${name}".`, 'name');
}
