import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/server/supabase';
import { schedulerHealth } from '@/lib/server/scheduler';

export const dynamic = 'force-dynamic';

/** Public health check (§7). Never exposes keys, emails or counts. */
export async function GET() {
  let db: 'ok' | 'error' = 'ok';
  try {
    const { error } = await adminClient()
      .from('user_settings')
      .select('user_id', { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    if (error) db = 'error';
  } catch {
    db = 'error';
  }
  const scheduler = schedulerHealth();
  const healthy = db === 'ok' && scheduler !== 'stale';
  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', db, scheduler, time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
