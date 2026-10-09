import { z } from 'zod';
import { open, body, json, errorResponse, emailAddress, MSG } from '@/lib/server/http';
import { userClient } from '@/lib/server/supabase';
import { clientIp, take } from '@/lib/server/ratelimit';

const Body = z.strictObject({
  email: emailAddress,
  password: z.string().min(1, 'Enter your password.'),
});

export const POST = open(async (req) => {
  if (!take(`signin:${clientIp(req.headers)}`, 10, 15 * 60_000)) {
    return errorResponse(429, 'RATE_LIMITED', MSG.tooManyAttempts);
  }
  const { email, password } = await body(req, Body);
  const supabase = await userClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) return errorResponse(429, 'RATE_LIMITED', MSG.tooManyAttempts);
    return errorResponse(401, 'INVALID_CREDENTIALS', "That email and password don't match. Try again, or set a new password below.");
  }
  return json({ ok: true });
});
