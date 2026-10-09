import { authed, json, errorResponse } from '@/lib/server/http';
import { adminClient } from '@/lib/server/supabase';
import { env } from '@/lib/server/env';
import { getSettingsRow } from '@/lib/server/settings';
import { sendLogged } from '@/lib/server/email/send';
import { testEmail } from '@/lib/server/email/templates';

export const POST = authed(async ({ supabase, user }) => {
  if (!env.postmarkToken) {
    return errorResponse(503, 'EMAIL_NOT_CONFIGURED', "Email isn't set up yet. Add the Postmark key where Focus Log is hosted.");
  }
  const { count } = await adminClient()
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('kind', 'test')
    .eq('is_example', false)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 3) return errorResponse(429, 'RATE_LIMITED', "You've sent 3 test emails this hour. Try again later.");
  const st = await getSettingsRow(supabase, user.id);
  const { outcome } = await sendLogged({
    userId: user.id,
    kind: 'test',
    refKey: `test:${new Date().toISOString()}`,
    to: user.email!,
    tz: st.time_zone,
    content: testEmail({ appUrl: env.appUrl }),
  });
  if (outcome && !outcome.ok) {
    return errorResponse(502, 'EMAIL_FAILED', `The test email couldn't be sent: ${outcome.human}`);
  }
  return json({ ok: true }, 202);
});
