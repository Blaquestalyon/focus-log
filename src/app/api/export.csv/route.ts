import { NextResponse } from 'next/server';
import { authed, dbFail, HttpError } from '@/lib/server/http';
import { getSettingsRow } from '@/lib/server/settings';
import { fetchAll } from '@/lib/server/rows';
import { applyFilters, filterBounds, parseFilters } from '@/lib/server/history';
import { buildCsv, type CsvSession } from '@/lib/server/csv';
import { todayStr } from '@/lib/time';

export const dynamic = 'force-dynamic';
const MAX_EXPORT_ROWS = 50_000;

/** CSV of the filtered closed sessions (no filters = everything). */
export const GET = authed(async ({ req, supabase, user }) => {
  const sp = req.nextUrl.searchParams;
  const f = parseFilters(sp, 'all');
  const st = await getSettingsRow(supabase, user.id);
  const tz = st.time_zone;
  const now = Date.now();
  const base = () => applyFilters(supabase.from('session_rows').select('id', { count: 'exact', head: true }), f, tz, now).not('ended_at', 'is', null);
  const { count, error } = await base();
  if (error) dbFail(error, 'export.count');
  if ((count ?? 0) > MAX_EXPORT_ROWS) {
    throw new HttpError(413, 'TOO_MANY_ROWS', "That's more than 50,000 sessions. Pick a shorter date range.");
  }
  const rows = await fetchAll<CsvSession>(
    (from, to) =>
      applyFilters(
        supabase.from('session_rows').select('id,started_at,ended_at,duration_seconds,task_name,project_name,source,edited_at'),
        f, tz, now,
      )
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'export.rows',
    MAX_EXPORT_ROWS + 1000,
  );
  const b = filterBounds(f, tz, now);
  const filename = b.fromStr ? `focus-log_${b.fromStr}_to_${b.toStr}.csv` : `focus-log_all_${todayStr(tz, now)}.csv`;
  return new NextResponse(buildCsv(rows, tz), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});
