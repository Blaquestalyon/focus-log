import { z } from 'zod';
import { authed, body, json, uuid } from '@/lib/server/http';
import { timerRpc } from '@/lib/server/timer';
import { resolveTaskByName } from '@/lib/server/tasks';

const Body = z.union([
  z.strictObject({ task_id: uuid }),
  z.strictObject({ task_name: z.string().max(200, 'Keep task names under 80 characters.'), project_id: uuid.nullable() }),
]);

/** F3/F4: start by id, or by name under a project (reusing/unarchiving an existing task). */
export const POST = authed(async ({ req, supabase, user }) => {
  const b = await body(req, Body);
  let taskId: string;
  let unarchived = false;
  if ('task_id' in b) {
    taskId = b.task_id;
  } else {
    const t = await resolveTaskByName(supabase, b.task_name, b.project_id);
    taskId = t.id;
    unarchived = t.unarchived;
  }
  const view = await timerRpc(supabase, 'fl_timer_start', { p_task_id: taskId }, { userId: user.id });
  return json(unarchived ? { ...view, unarchived: true } : view);
});
