import { authed, json, dbFail } from '@/lib/server/http';
import { fetchAll } from '@/lib/server/rows';
import type { DataSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const GET = authed(async ({ supabase }) => {
  const count = async (table: string) => {
    const { count: n, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('is_example', true);
    if (error) dbFail(error, `${table}.count`);
    return n ?? 0;
  };
  const [projects, tasks, sessions, emails] = await Promise.all([count('projects'), count('tasks'), count('sessions'), count('email_log')]);
  const [kp, kt] = await Promise.all([
    supabase.from('projects').select('id,name').not('claimed_from_example_at', 'is', null).order('name'),
    supabase.from('tasks').select('id,name').not('claimed_from_example_at', 'is', null).order('name'),
  ]);
  const all = await fetchAll<{ duration_seconds: number | null; started_at: string }>(
    (from, to) => supabase.from('sessions').select('duration_seconds,started_at').order('id').range(from, to),
    'data.totals',
  );
  const now = Date.now();
  const seconds = all.reduce((s, r) => s + (r.duration_seconds ?? Math.max(0, Math.floor((now - Date.parse(r.started_at)) / 1000))), 0);
  const res: DataSummary = {
    example_counts: { projects, tasks, sessions, emails },
    kept: { projects: (kp.data ?? []) as { id: string; name: string }[], tasks: (kt.data ?? []) as { id: string; name: string }[] },
    totals: { sessions: all.length, seconds },
  };
  return json(res);
});
