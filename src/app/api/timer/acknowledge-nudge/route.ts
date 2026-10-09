import { z } from 'zod';
import { authed, body, json, uuid, HttpError, dbFail } from '@/lib/server/http';
import { timerView } from '@/lib/server/timer';

const Body = z.strictObject({ session_id: uuid });

/** "Keep going": suppress further nudges (banner, alerts, email) for this session. */
export const POST = authed(async ({ req, supabase }) => {
  const { session_id } = await body(req, Body);
  const view = await timerView(supabase);
  if (view.status !== 'running' || view.session?.id !== session_id) {
    throw new HttpError(409, 'NOT_CURRENT_SESSION', 'That timer has already stopped.');
  }
  const { error } = await supabase
    .from('sessions')
    .update({ nudge_acknowledged_at: new Date().toISOString() })
    .eq('id', session_id)
    .is('nudge_acknowledged_at', null);
  if (error) dbFail(error, 'acknowledge');
  return json(await timerView(supabase));
});
