import { authed, json, errorResponse } from '@/lib/server/http';
import { adminClient } from '@/lib/server/supabase';
import { log } from '@/lib/server/log';

/** Remove example data: rows still marked is_example, keeping claimed items (§6). */
export const POST = authed(async ({ user }) => {
  const { data, error } = await adminClient().rpc('fl_admin_delete_user_data', { p_user_id: user.id, p_examples_only: true });
  if (error) {
    log.warn({ code: error.code, msg: error.message?.slice(0, 120) }, 'remove examples failed');
    return errorResponse(409, 'EXAMPLES_IN_USE', 'Some example items are still in use, so nothing was removed. Stop the timer, then try again.');
  }
  return json(data);
});
