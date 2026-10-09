import { z } from 'zod';
import { authed, body, json, dbFail, errorResponse } from '@/lib/server/http';
import { env } from '@/lib/server/env';
import { browserLabel } from '@/lib/push-label';
import type { PushBrowser } from '@/lib/types';

export const dynamic = 'force-dynamic';

function human(stored: string | null): string | null {
  return stored ? stored.replace(/^\[[^\]]*\]\s*/, '') : null;
}

/** Allowed browsers. Never returns endpoint or keys; flags the row matching X-Push-Endpoint. */
export const GET = authed(async ({ req, supabase }) => {
  const mine = req.headers.get('x-push-endpoint');
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id,endpoint,label,last_seen_at,last_success_at,last_failure_at,last_error')
    .order('last_seen_at', { ascending: false });
  if (error) dbFail(error, 'push.list');
  const browsers: PushBrowser[] = (data ?? []).map((r) => {
    const failedLatest = Boolean(r.last_failure_at && (!r.last_success_at || r.last_failure_at > r.last_success_at));
    return {
      id: r.id,
      label: r.label,
      is_this_browser: Boolean(mine && r.endpoint === mine),
      last_seen_at: r.last_seen_at,
      last_success_at: r.last_success_at,
      last_failure_at: r.last_failure_at,
      error_human: failedLatest ? human(r.last_error) : null,
    };
  });
  return json({ configured: env.vapidConfigured, public_key: env.vapidPublicKey, browsers });
});

const INVALID = "That alert sign-up isn't valid.";
const Sub = z.object({
  endpoint: z.string({ message: INVALID }).max(2048, INVALID).refine((s) => s.startsWith('https://'), INVALID),
  expirationTime: z.number().nullable().optional(),
  keys: z.strictObject({ p256dh: z.string({ message: INVALID }).min(1, INVALID).max(512, INVALID), auth: z.string({ message: INVALID }).min(1, INVALID).max(256, INVALID) }, { message: INVALID }),
}).strict();

/** Save (or re-save) this browser's push sign-up. */
export const PUT = authed(async ({ req, supabase, user }) => {
  if (!env.vapidConfigured) return errorResponse(503, 'PUSH_NOT_CONFIGURED', "Pop-up alerts aren't set up yet.");
  let b: z.infer<typeof Sub>;
  try {
    b = await body(req, Sub);
  } catch {
    return errorResponse(400, 'VALIDATION', INVALID);
  }
  const label = browserLabel(req.headers.get('user-agent'));
  const now = new Date().toISOString();
  const upd = await supabase
    .from('push_subscriptions')
    .update({ p256dh: b.keys.p256dh, auth_secret: b.keys.auth, label, last_seen_at: now })
    .eq('endpoint', b.endpoint)
    .select('id,label');
  if (upd.error) dbFail(upd.error, 'push.update');
  if (upd.data?.length) return json(upd.data[0]);
  const ins = await supabase
    .from('push_subscriptions')
    .insert({ user_id: user.id, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth_secret: b.keys.auth, label, last_seen_at: now })
    .select('id,label')
    .single();
  if (ins.error) {
    // 23505: this endpoint belongs to another account, which is never overwritten.
    if (ins.error.code === '23505') return errorResponse(400, 'VALIDATION', INVALID);
    dbFail(ins.error, 'push.insert');
  }
  return json(ins.data);
});
