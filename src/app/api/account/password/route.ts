import { z } from 'zod';
import { NextResponse } from 'next/server';
import { authed, body, errorResponse, newPassword, passwordIsEmail, MSG } from '@/lib/server/http';
import { bareAnonClient } from '@/lib/server/supabase';

const Body = z.strictObject({
  current_password: z.string().min(1, 'Enter your current password.'),
  new_password: newPassword,
});

export const POST = authed(async ({ req, supabase, user }) => {
  const { current_password, new_password } = await body(req, Body);
  if (passwordIsEmail(new_password, user.email)) {
    return errorResponse(400, 'VALIDATION', MSG.passwordIsEmail, 'new_password');
  }
  const check = await bareAnonClient().auth.signInWithPassword({ email: user.email!, password: current_password });
  if (check.error) return errorResponse(400, 'WRONG_PASSWORD', "Your current password isn't right.", 'current_password');
  const { error } = await supabase.auth.updateUser({ password: new_password });
  if (error && !/should be different/i.test(error.message)) {
    return errorResponse(400, 'VALIDATION', MSG.passwordTooShort, 'new_password');
  }
  return new NextResponse(null, { status: 204 });
});
