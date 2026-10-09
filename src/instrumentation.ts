/** Boot hook: check required configuration, then start the in-process scheduler (§8). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { missingEnv } = await import('./lib/server/env');
  const missing = missingEnv();
  if (missing.length) {
    console.error(`Focus Log can't start: missing environment variable(s): ${missing.join(', ')}`);
    process.exit(1);
  }
  const { schedulerState, startScheduler } = await import('./lib/server/scheduler');
  schedulerState(); // records the process start time for /api/health either way
  startScheduler();
}
