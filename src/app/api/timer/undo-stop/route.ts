import { z } from 'zod';
import { authed, body, json, uuid } from '@/lib/server/http';
import { timerRpc } from '@/lib/server/timer';

const Body = z.strictObject({ session_id: uuid, restore: z.enum(['running', 'paused']) });

export const POST = authed(async ({ req, supabase, user }) => {
  const { session_id, restore } = await body(req, Body);
  return json(await timerRpc(supabase, 'fl_timer_undo_stop', { p_session_id: session_id, p_restore: restore }, { userId: user.id }));
});
