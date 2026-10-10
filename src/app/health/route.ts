import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Bare liveness check for the hosting platform (§7): the process is up and answering.
 * The full check (database and background checks) is GET /api/health.
 */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
