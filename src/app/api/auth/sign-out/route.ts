import { z } from 'zod';
import { NextResponse } from 'next/server';
import { authed, body } from '@/lib/server/http';

const Body = z.strictObject({ scope: z.enum(['local', 'global']).default('local') });

export const POST = authed(async ({ req, supabase }) => {
  const { scope } = await body(req, Body);
  await supabase.auth.signOut({ scope });
  return new NextResponse(null, { status: 204 });
}, { rateLimit: false });
