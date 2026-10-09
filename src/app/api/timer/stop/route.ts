import { z } from 'zod';
import { authed, body, json, MSG } from '@/lib/server/http';
import { timerRpc } from '@/lib/server/timer';

const Body = z.strictObject({ stop_at: z.string().datetime({ offset: true, message: MSG.badRequest }).optional() });

export const POST = authed(async ({ req, supabase, user }) => {
  const { stop_at } = await body(req, Body);
  return json(await timerRpc(supabase, 'fl_timer_stop', { p_stop_at: stop_at ?? null }, { userId: user.id }));
});
