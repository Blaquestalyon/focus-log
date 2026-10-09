import { z } from 'zod';
import { open, body, json, errorResponse } from '@/lib/server/http';
import { userClient } from '@/lib/server/supabase';
import { clientIp, take } from '@/lib/server/ratelimit';

const Body = z.strictObject({
  token_hash: z.string().min(1),
  type: z.literal('recovery'),
  password: z.string().min(10, 'Use at least 10 characters.').max(72, 'Use 72 characters or fewer.'),
});

/** F1 step 7. The token is verified only here (never on page load), then the password is set. */
export const POST = open(async (req) => {
  if (!take(`setpw:${clientIp(req.headers)}`, 10, 15 * 60_000)) {
    return errorResponse(429, 'RATE_LIMITED', 'Too many attempts. Wait 15 minutes and try again.');
  }
  const { token_hash, password } = await body(req, Body);
  const supabase = await userClient();
  // A retry after a rejected password reuses the session the first attempt opened.
  let { data: current } = await supabase.auth.getUser();
  if (!current.user) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' });
    if (error || !data.user) {
      return errorResponse(400, 'LINK_INVALID', 'This link has expired or was already used.');
    }
    current = { user: data.user };
  }
  if (current.user?.email && password.trim().toLowerCase() === current.user.email.toLowerCase()) {
    return errorResponse(400, 'VALIDATION', 'Pick something other than your email address.', 'password');
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/should be different/i.test(error.message)) return json({ ok: true });
    if (/weak|length|characters/i.test(error.message)) {
      return errorResponse(400, 'VALIDATION', 'Use at least 10 characters.', 'password');
    }
    return errorResponse(400, 'LINK_INVALID', 'This link has expired or was already used.');
  }
  return json({ ok: true });
});
