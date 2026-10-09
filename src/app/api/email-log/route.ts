import { authed, json, dbFail, HttpError } from '@/lib/server/http';
import { humanError } from '@/lib/server/email/postmark';
import { decodeCursor, encodeCursor } from '@/lib/server/history';
import type { EmailLogRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Sent emails, newest first, 50 per page. */
export const GET = authed(async ({ req, supabase }) => {
  const cursor = decodeCursor(req.nextUrl.searchParams.get('cursor'));
  let q = supabase
    .from('email_log')
    .select('id,kind,status,subject,error,attempts,created_at,sent_at,is_example')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(51);
  if (cursor) {
    const [v, id] = cursor;
    if (typeof v !== 'string') throw new HttpError(400, 'VALIDATION', "That request wasn't valid.", 'cursor');
    q = q.or(`created_at.lt."${v}",and(created_at.eq."${v}",id.lt.${id})`);
  }
  const { data, error } = await q;
  if (error) dbFail(error, 'email_log');
  const rows = (data ?? []) as (Omit<EmailLogRow, 'error_human'> & { error: string | null })[];
  const page = rows.slice(0, 50);
  const last = page[page.length - 1];
  return json({
    rows: page.map(({ error: e, ...r }) => ({ ...r, error_human: r.status === 'failed' ? humanError(e) : null })),
    next_cursor: rows.length > 50 && last ? encodeCursor(last.created_at, last.id) : null,
  });
});
