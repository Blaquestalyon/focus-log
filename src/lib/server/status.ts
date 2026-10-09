import 'server-only';
/** System status and the Timer notice (§6 "System status and the Timer notice", §7 GET /api/status). */
import { adminClient } from './supabase';
import { env } from './env';
import { schedulerHealth, schedulerState } from './scheduler';
import { sentThisMonth } from './email/send';
import { errorCode } from './email/postmark';
import type { StatusProblem, StatusResponse } from '@/lib/types';
import type { SettingsRow } from './settings';

export async function computeStatus(userId: string, settings: SettingsRow): Promise<StatusResponse> {
  const db = adminClient();
  const tz = settings.time_zone;
  const now = Date.now();

  // ---- email (real rows only, never examples)
  const [lastSent, latestReal, failed, sentMonth] = await Promise.all([
    db.from('email_log').select('sent_at').eq('user_id', userId).eq('is_example', false).eq('status', 'sent')
      .order('sent_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('email_log').select('status,error').eq('user_id', userId).eq('is_example', false)
      .in('status', ['sent', 'failed']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('email_log').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_example', false)
      .eq('status', 'failed').gte('created_at', new Date(now - 7 * 86400_000).toISOString()),
    sentThisMonth(userId, tz),
  ]);
  const configured = Boolean(env.postmarkToken);
  const latest = latestReal.data as { status: string; error: string | null } | null;
  const code = latest?.status === 'failed' ? errorCode(latest.error) : null;
  const keyRejected = configured && Boolean(code && /^postmark (401\/|\d+\/10$)/.test(code));
  const failed7d = failed.count ?? 0;
  const cap = env.emailMonthlyCap;

  // ---- scheduler
  const sh = schedulerHealth(now);
  const s = schedulerState();

  // ---- push
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('label,last_success_at,last_failure_at,last_error')
    .eq('user_id', userId);
  const browsers = (subs ?? []) as { label: string; last_success_at: string | null; last_failure_at: string | null; last_error: string | null }[];
  const lastSuccessAny = browsers.reduce<number>((m, b) => Math.max(m, b.last_success_at ? Date.parse(b.last_success_at) : 0), 0);
  const failing = browsers.filter((b) => b.last_failure_at && (!b.last_success_at || Date.parse(b.last_failure_at) > Date.parse(b.last_success_at)));
  const pushKeyRejected = failing.some(
    (b) => /^\[(401|403)\]/.test(b.last_error ?? '') && Date.parse(b.last_failure_at!) > lastSuccessAny,
  );
  const pushConfigured = env.vapidConfigured;
  const pushEnabled = settings.nudge_browser_enabled;

  const problems: StatusProblem[] = [];
  if (!configured) problems.push({ key: 'email_not_configured', level: 'problem', message: "Reminder emails aren't going out — email isn't set up yet." });
  if (sh === 'stale') problems.push({ key: 'scheduler_stopped', level: 'problem', message: "Background checks have stopped, so reminders and Monday emails won't go out." });
  if (!pushConfigured) problems.push({ key: 'push_not_configured', level: 'problem', message: "Pop-up alerts aren't set up yet." });
  else if (pushEnabled && browsers.length && pushKeyRejected) {
    problems.push({ key: 'push_key_rejected', level: 'problem', message: "Pop-up alerts aren't going out — the alert keys were rejected." });
  }
  if (keyRejected) problems.push({ key: 'email_key_rejected', level: 'warning', message: "Reminder emails aren't going out — Postmark rejected the key." });
  if (pushConfigured && pushEnabled && browsers.length && !pushKeyRejected && failing.length) {
    problems.push({ key: 'push_browser_failing', level: 'warning', message: `Pop-up alerts are failing on ${failing[0].label}.` });
  }
  if (failed7d > 0) {
    problems.push({ key: 'emails_failed', level: 'warning', message: `${failed7d} ${failed7d === 1 ? 'email' : 'emails'} failed in the last 7 days.` });
  }
  if (cap > 0 && sentMonth >= cap * 0.8) {
    problems.push({ key: 'email_cap_near', level: 'warning', message: `You've used ${sentMonth} of this month's ${cap} emails.` });
  }

  return {
    email: {
      configured,
      key_rejected: keyRejected,
      last_sent_at: (lastSent.data as { sent_at: string } | null)?.sent_at ?? null,
      failed_7d: failed7d,
      sent_this_month: sentMonth,
      monthly_cap: cap,
    },
    scheduler: {
      enabled: env.schedulerEnabled,
      last_tick_at: s.lastTickAt ? new Date(s.lastTickAt).toISOString() : null,
      healthy: sh === 'ok' || sh === 'starting',
      last_error: s.lastTickError,
    },
    push: {
      configured: pushConfigured,
      enabled: pushEnabled,
      key_rejected: pushKeyRejected,
      browsers: browsers.length,
      failing_browsers: failing.map((b) => b.label),
      last_sent_at: lastSuccessAny ? new Date(lastSuccessAny).toISOString() : null,
    },
    problems,
    version: env.version,
  };
}
