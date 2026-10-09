import { authed, json, dbFail } from '@/lib/server/http';
import { getSettingsRow } from '@/lib/server/settings';
import { VIEW_COLUMNS, toSessionRow, rowEndMs, type ViewRow } from '@/lib/server/rows';
import { clipSeconds, dayRange, todayStr } from '@/lib/time';
import type { TodayResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Every session overlapping today (owner's zone), newest first, with today's clipped portion. */
export const GET = authed(async ({ supabase, user }) => {
  const st = await getSettingsRow(supabase, user.id);
  const now = Date.now();
  const date = todayStr(st.time_zone, now);
  const { start, end } = dayRange(date, st.time_zone);
  const { data, error } = await supabase
    .from('session_rows')
    .select(VIEW_COLUMNS)
    .lt('started_at', end.toISOString())
    .or(`ended_at.is.null,ended_at.gt.${start.toISOString()}`)
    .order('started_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(500);
  if (error) dbFail(error, 'today');
  let total = 0;
  const sessions = ((data ?? []) as ViewRow[]).map((r) => {
    const day = clipSeconds(new Date(r.started_at), new Date(rowEndMs(r, now)), start, end);
    total += day;
    return toSessionRow(r, now, { day_seconds: day });
  });
  const res: TodayResponse = { date, time_zone: st.time_zone, total_seconds: total, server_now: new Date(now).toISOString(), sessions };
  return json(res);
});
