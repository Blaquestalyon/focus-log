import { z } from 'zod';
import { authed, body, json, dbFail } from '@/lib/server/http';
import { adminClient } from '@/lib/server/supabase';

const Body = z.strictObject({ confirm: z.literal('DELETE', { message: 'Type DELETE to confirm.' }) });

export const POST = authed(async ({ req, user }) => {
  await body(req, Body);
  const { data, error } = await adminClient().rpc('fl_admin_delete_user_data', { p_user_id: user.id, p_examples_only: false });
  if (error) dbFail(error, 'delete-all');
  return json(data);
});
