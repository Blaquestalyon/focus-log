import { authed, json, errorResponse, dbFail } from '@/lib/server/http';
import { env } from '@/lib/server/env';
import { take } from '@/lib/server/ratelimit';
import { sendAlert, storePushError, TEST_PAYLOAD } from '@/lib/server/push';

/** Send a test alert to this browser (does not touch the nudge_* fields). */
export const POST = authed(async ({ req, supabase, user }) => {
  if (!env.vapidConfigured) return errorResponse(503, 'PUSH_NOT_CONFIGURED', "Pop-up alerts aren't set up yet.");
  const endpoint = req.headers.get('x-push-endpoint');
  const { data: sub, error } = endpoint
    ? await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth_secret').eq('endpoint', endpoint).maybeSingle()
    : { data: null, error: null };
  if (error) dbFail(error, 'push.get');
  if (!sub) return errorResponse(404, 'NOT_SUBSCRIBED', "This browser isn't set up for pop-ups yet. Click Allow alerts first.");
  if (!take(`pushtest:${user.id}`, 5, 3600_000)) {
    return errorResponse(429, 'RATE_LIMITED', "You've sent 5 test alerts this hour. Try again later.");
  }
  const out = await sendAlert(sub, TEST_PAYLOAD, 60);
  const now = new Date().toISOString();
  if (out.ok) {
    await supabase.from('push_subscriptions').update({ last_success_at: now, last_error: null }).eq('id', sub.id);
    return json({ ok: true }, 202);
  }
  if (out.gone) {
    await supabase.from('push_subscriptions').delete().eq('id', sub.id);
    return errorResponse(410, 'SUBSCRIPTION_GONE', "This browser's alert sign-up has expired. Click Turn alerts back on.");
  }
  await supabase.from('push_subscriptions').update({ last_failure_at: now, last_error: storePushError(out.status, out.human) }).eq('id', sub.id);
  return errorResponse(502, 'PUSH_FAILED', `The test alert couldn't be sent: ${out.human}`);
});
