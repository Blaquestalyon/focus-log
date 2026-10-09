import { z } from 'zod';
import { authed, body, json, dbFail, uuid, HttpError, MSG } from '@/lib/server/http';
import { taskName } from '@/lib/server/tasks';
import { listTasks, duplicateTaskError, projectGone } from './helpers';

export const dynamic = 'force-dynamic';

export const GET = authed(async ({ req, supabase }) => {
  const sp = req.nextUrl.searchParams;
  const pid = sp.get('project_id');
  if (pid && pid !== 'none' && !uuid.safeParse(pid).success) throw new HttpError(400, 'VALIDATION', MSG.badRequest, 'project_id');
  return json(
    await listTasks(supabase, {
      q: (sp.get('q') ?? '').trim().slice(0, 80) || undefined,
      projectId: (pid as string | null) ?? undefined,
      includeArchived: sp.get('include_archived') === '1',
      recent: sp.get('recent') === '1',
    }),
  );
});

const Create = z.strictObject({
  name: taskName,
  project_id: uuid.nullable(),
});

export const POST = authed(async ({ req, supabase }) => {
  const b = await body(req, Create);
  const { data, error } = await supabase.from('tasks').insert({ name: b.name, project_id: b.project_id }).select('id').single();
  if (error) {
    if (error.code === '23505') throw await duplicateTaskError(supabase, b.name, b.project_id);
    if (error.code === '42501' || error.code === '23503') throw projectGone();
    dbFail(error, 'tasks.insert');
  }
  const [item] = await listTasks(supabase, { onlyId: data.id, includeArchived: true });
  return json(item, 201);
});
