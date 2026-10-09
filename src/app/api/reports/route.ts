import { authed, json, HttpError } from '@/lib/server/http';
import { getSettingsRow } from '@/lib/server/settings';
import { fetchAll } from '@/lib/server/rows';
import { computeReport, periodBounds, validatePeriodStart, type Period, type ReportRow } from '@/lib/report-core';

export const dynamic = 'force-dynamic';

export const GET = authed(async ({ req, supabase, user }) => {
  const sp = req.nextUrl.searchParams;
  const period = sp.get('period');
  if (period !== 'week' && period !== 'month') throw new HttpError(400, 'VALIDATION', "That request wasn't valid.", 'period');
  const st = await getSettingsRow(supabase, user.id);
  const tz = st.time_zone;
  const now = Date.now();
  const start = sp.get('start');
  if (validatePeriodStart(period as Period, start, tz, now)) {
    throw new HttpError(400, 'VALIDATION', "That request wasn't valid.", 'start');
  }
  const { range, prev } = periodBounds(period as Period, start!, tz);
  const rows = await fetchAll<ReportRow>(
    (from, to) =>
      supabase
        .from('session_rows')
        .select('id,task_id,task_name,project_id,project_name,project_color,project_archived_at,started_at,ended_at')
        .lt('started_at', range.end.toISOString())
        .or(`ended_at.is.null,ended_at.gt."${prev.start.toISOString()}"`)
        .order('started_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'reports',
  );
  return json(computeReport(rows, period as Period, start!, tz, now));
});
