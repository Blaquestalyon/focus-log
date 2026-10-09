/** Node-only boot work, loaded by instrumentation.ts (kept separate so the edge bundle never sees it). */
import { missingEnv } from './lib/server/env';
import { schedulerState, startScheduler } from './lib/server/scheduler';

export function boot() {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const missing = missingEnv();
  if (missing.length) {
    console.error(`Focus Log can't start: missing environment variable(s): ${missing.join(', ')}`);
    process.exit(1);
  }
  schedulerState(); // records the process start time for /api/health either way
  startScheduler();
}
