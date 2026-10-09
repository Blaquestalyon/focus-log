/**
 * All configuration comes from environment variables (blueprint §10).
 * Required variables are checked once at boot (instrumentation) and the process exits naming
 * every missing one. Optional ones (Postmark, alert keys) are reported on System status instead.
 */
export const REQUIRED_ENV = ['APP_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => !process.env[k] || !String(process.env[k]).trim());
}

function req(name: (typeof REQUIRED_ENV)[number]): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v.trim();
}

export const env = {
  get appUrl() { return req('APP_URL').replace(/\/+$/, ''); },
  get appOrigin() { try { return new URL(req('APP_URL')).origin; } catch { return req('APP_URL'); } },
  get supabaseUrl() { return req('SUPABASE_URL'); },
  get supabaseAnonKey() { return req('SUPABASE_ANON_KEY'); },
  get supabaseServiceKey() { return req('SUPABASE_SERVICE_ROLE_KEY'); },
  get postmarkToken() { return process.env.POSTMARK_SERVER_TOKEN?.trim() || null; },
  get emailFrom() { return process.env.EMAIL_FROM?.trim() || 'Focus Log <jdavis@power-in-numbers.net>'; },
  get ownerEmail() { return process.env.OWNER_EMAIL?.trim() || 'jdavis@power-in-numbers.net'; },
  get emailMonthlyCap() {
    const n = Number(process.env.EMAIL_MONTHLY_CAP ?? 90);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 90;
  },
  get schedulerEnabled() { return (process.env.SCHEDULER_ENABLED ?? 'true').trim().toLowerCase() !== 'false'; },
  get schedulerIntervalSeconds() {
    const n = Number(process.env.SCHEDULER_INTERVAL_SECONDS ?? 60);
    return Number.isFinite(n) && n >= 1 ? n : 60;
  },
  get vapidPublicKey() { return process.env.VAPID_PUBLIC_KEY?.trim() || null; },
  get vapidPrivateKey() { return process.env.VAPID_PRIVATE_KEY?.trim() || null; },
  get vapidSubject() { return process.env.VAPID_SUBJECT?.trim() || 'mailto:jdavis@power-in-numbers.net'; },
  get vapidConfigured() { return Boolean(this.vapidPublicKey && this.vapidPrivateKey); },
  get version() { return (process.env.RAILWAY_GIT_COMMIT_SHA || 'dev').slice(0, 7); },
};
