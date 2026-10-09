/** Boot hook: check required configuration, then start the in-process scheduler (§8). */
export async function register() {
  // The import sits inside the runtime check so the edge bundle drops it at compile time.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { boot } = await import('./instrumentation-node');
    boot();
  }
}
