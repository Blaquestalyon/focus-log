import { NextResponse } from 'next/server';
import { authed, assertId, dbFail, HttpError, MSG } from '@/lib/server/http';

export const DELETE = authed<{ id: string }>(async ({ supabase }, { id }) => {
  assertId(id);
  const { data, error } = await supabase.from('push_subscriptions').delete().eq('id', id).select('id');
  if (error) dbFail(error, 'push.delete');
  if (!data?.length) throw new HttpError(404, 'NOT_FOUND', MSG.notFound);
  return new NextResponse(null, { status: 204 });
});
