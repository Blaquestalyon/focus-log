import { z } from 'zod';
import { open, body, json, errorResponse, emailAddress, MSG } from '@/lib/server/http';
import { adminClient } from '@/lib/server/supabase';
import { clientIp, take } from '@/lib/server/ratelimit';
import { env } from '@/lib/server/env';
import { log } from '@/lib/server/log';
import { recentEmailCount, sendLogged } from '@/lib/server/email/send';
import { passwordLinkEmail } from '@/lib/server/email/templates';

const Body = z.strictObject({
  email: emailAddress,
});

async function findUser(email: string) {
  const db = adminClient();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.status}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

/** F1 step 3. Always 202 with the same copy whether or not the address has an account. */
export const POST = open(async (req) => {
  if (!take(`link:${clientIp(req.headers)}`, 3, 60 * 60_000)) return errorResponse(429, 'RATE_LIMITED', MSG.tooManyAttempts);
  const { email } = await body(req, Body);
  const user = await findUser(email);
  if (user?.email) {
    const db = adminClient();
    const [hour, day] = await Promise.all([
      recentEmailCount(user.id, 'password_link', 3600_000),
      recentEmailCount(user.id, 'password_link', 86400_000),
    ]);
    if (hour >= 3 || day >= 10) return errorResponse(429, 'RATE_LIMITED', MSG.tooManyAttempts);
    const { data: st } = await db.from('user_settings').select('time_zone').eq('user_id', user.id).maybeSingle();
    let link = `${env.appUrl}/set-password`;
    if (env.postmarkToken) {
      const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email: user.email });
      if (error || !data.properties?.hashed_token) {
        log.error({ status: error?.status }, 'generateLink failed');
        return json({ ok: true }, 202);
      }
      link = `${env.appUrl}/set-password?token_hash=${data.properties.hashed_token}&type=recovery`;
    }
    await sendLogged({
      userId: user.id,
      kind: 'password_link',
      refKey: `link:${new Date().toISOString()}`,
      to: user.email,
      tz: (st?.time_zone as string) ?? 'America/New_York',
      content: passwordLinkEmail({ appUrl: env.appUrl, link }),
    });
  }
  return json({ ok: true }, 202);
});
