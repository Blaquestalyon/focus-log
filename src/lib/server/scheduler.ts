import 'server-only';
/**
 * The in-process scheduler (§8 "The scheduler"). One loop inside the web service, every
 * SCHEDULER_INTERVAL_SECONDS, using the service role. It writes only email_log and the
 * delivery fields of push_subscriptions — never sessions, projects or tasks.
 */
import { adminClient } from './supabase';
import { env } from './env';
import { log } from './log';
import { formatDuration } from '@/lib/format';
import { addDays, weekRange } from '@/lib/time';
import { buildWeeklySummary, isWeeklyDue, summaryWeekMonday } from '@/lib/weekly-core';
import type { ReportRow } from '@/lib/report-core';
import { claimEmail, deliverClaimed, userEmail } from './email/send';
import { nudgeEmail, passwordLinkEmail, testEmail, weeklyEmail } from './email/templates';
import { storeError } from './email/postmark';
import { nudgePayload, sendAlert, storePushError, PUSH_RETRY_FINAL_HUMAN, type PushTarget } from './push';
import type { SettingsRow } from './settings';

interface SchedulerState {
  processStartedAt: number;
  started: boolean;
  ticking: boolean;
  lastTickStartedAt: number | null;
  lastTickAt: number | null;
  lastTickError: string | null;
  timer: ReturnType<typeof setTimeout> | null;
}

const g = globalThis as unknown as { __flScheduler?: SchedulerState };
export function schedulerState(): SchedulerState {
  return (g.__flScheduler ??= {
    processStartedAt: Date.now(),
    started: false,
    ticking: false,
    lastTickStartedAt: null,
    lastTickAt: null,
    lastTickError: null,
    timer: null,
  });
}

const STALE_MS = 3 * 60_000;

/** 'off' | 'starting' | 'ok' | 'stale' — shared by /api/health and System status. */
export function schedulerHealth(now = Date.now()): 'off' | 'starting' | 'ok' | 'stale' {
  if (!env.schedulerEnabled) return 'off';
  const s = schedulerState();
  if (s.lastTickAt === null) return now - s.processStartedAt > STALE_MS ? 'stale' : 'starting';
  return now - s.lastTickAt > STALE_MS ? 'stale' : 'ok';
}

export function startScheduler() {
  const s = schedulerState();
  if (s.started || !env.schedulerEnabled) return;
  s.started = true;
  log.info({ interval: env.schedulerIntervalSeconds }, 'scheduler started');
  const loop = async () => {
    try {
      await tick();
    } finally {
      s.timer = setTimeout(loop, env.schedulerIntervalSeconds * 1000);
      s.timer.unref?.();
    }
  };
  s.timer = setTimeout(loop, 1000);
  s.timer.unref?.();
}

export async function tick(now = Date.now()) {
  const s = schedulerState();
  if (s.ticking) return;
  s.ticking = true;
  s.lastTickStartedAt = now;
  try {
    const settings = await loadSettings();
    const running = await loadRunning();
    if (env.postmarkToken) await nudgeEmails(settings, running);
    if (env.vapidConfigured) await nudgeAlerts(settings, running);
    if (env.postmarkToken) await weeklyEmails(settings);
    await recoverStale();
    if (env.postmarkToken) await retryEmails(settings);
    if (env.vapidConfigured) await retryAlerts(settings);
    s.lastTickError = null;
  } catch (e) {
    s.lastTickError = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
    log.error({ err: s.lastTickError }, 'scheduler tick failed');
  } finally {
    s.lastTickAt = Date.now();
    s.ticking = false;
  }
}

// ------------------------------------------------------------------ loaders
async function loadSettings(): Promise<Map<string, SettingsRow>> {
  const { data, error } = await adminClient().from('user_settings').select('*');
  if (error) throw new Error(`settings: ${error.code} ${error.message}`);
  return new Map((data as SettingsRow[]).map((r) => [r.user_id, r]));
}

interface RunningRow {
  id: string; user_id: string; started_at: string; task_name: string; project_name: string | null; nudge_acknowledged_at: string | null;
}
async function loadRunning(): Promise<RunningRow[]> {
  const { data, error } = await adminClient()
    .from('session_rows')
    .select('id,user_id,started_at,task_name,project_name,nudge_acknowledged_at')
    .is('ended_at', null);
  if (error) throw new Error(`running: ${error.code} ${error.message}`);
  return (data ?? []) as RunningRow[];
}

function pastThreshold(r: RunningRow, st: SettingsRow, now = Date.now()) {
  return now - Date.parse(r.started_at) >= st.nudge_after_minutes * 60_000;
}

// ------------------------------------------------------------ nudge emails
async function nudgeEmails(settings: Map<string, SettingsRow>, running: RunningRow[]) {
  for (const r of running) {
    const st = settings.get(r.user_id);
    if (!st || !st.nudge_email_enabled || !pastThreshold(r, st)) continue;
    const to = await userEmail(r.user_id);
    if (!to) continue;
    const elapsed = Math.floor((Date.now() - Date.parse(r.started_at)) / 1000);
    const content = nudgeEmail({
      appUrl: env.appUrl, sessionId: r.id, taskName: r.task_name, projectName: r.project_name,
      startedAt: r.started_at, elapsedSeconds: elapsed, tz: st.time_zone,
    });
    const acknowledged = Boolean(r.nudge_acknowledged_at);
    const id = await claimEmail(r.user_id, 'nudge', `session:${r.id}`, acknowledged ? 'skipped_acknowledged' : 'sending', to, content.subject);
    if (!id || acknowledged) continue;
    await deliverClaimed(id, { userId: r.user_id, kind: 'nudge', refKey: `session:${r.id}`, to, tz: st.time_zone, content, attemptsBefore: 0 });
  }
}

// ------------------------------------------------------------ nudge alerts
async function nudgeAlerts(settings: Map<string, SettingsRow>, running: RunningRow[]) {
  const db = adminClient();
  for (const r of running) {
    const st = settings.get(r.user_id);
    if (!st || !st.nudge_browser_enabled || r.nudge_acknowledged_at || !pastThreshold(r, st)) continue;
    const { data: subs, error } = await db
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth_secret,nudge_session_id')
      .eq('user_id', r.user_id);
    if (error) throw new Error(`subs: ${error.code}`);
    for (const sub of (subs ?? []) as (PushTarget & { nudge_session_id: string | null })[]) {
      if (sub.nudge_session_id === r.id) continue;
      // Claim: once per browser per session.
      const { data: claimed } = await db
        .from('push_subscriptions')
        .update({
          nudge_session_id: r.id, nudge_status: 'sending', nudge_attempts: 1,
          nudge_next_attempt_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        })
        .eq('id', sub.id)
        .or(`nudge_session_id.is.null,nudge_session_id.neq.${r.id}`)
        .select('id');
      if (!claimed?.length) continue;
      await deliverAlert(sub, r, 1);
    }
  }
}

async function deliverAlert(sub: PushTarget, r: RunningRow, attempt: number) {
  const db = adminClient();
  const elapsed = Math.floor((Date.now() - Date.parse(r.started_at)) / 1000);
  const out = await sendAlert(sub, nudgePayload(r.id, r.task_name, formatDuration(elapsed)), 3600);
  const nowIso = new Date().toISOString();
  if (out.ok) {
    await db.from('push_subscriptions').update({
      nudge_status: 'sent', last_success_at: nowIso, last_error: null, nudge_next_attempt_at: null,
    }).eq('id', sub.id);
    return;
  }
  if (out.gone) {
    await db.from('push_subscriptions').delete().eq('id', sub.id);
    return;
  }
  const retryable = out.retry && attempt < 3;
  const human = out.retry && !retryable ? PUSH_RETRY_FINAL_HUMAN : out.human;
  await db.from('push_subscriptions').update({
    nudge_status: 'failed', last_failure_at: nowIso, last_error: storePushError(out.status, human),
    nudge_next_attempt_at: retryable ? new Date(Date.now() + (attempt === 1 ? 5 : 30) * 60_000).toISOString() : null,
  }).eq('id', sub.id);
}

// ------------------------------------------------------------------ weekly
async function weeklyRows(userId: string, monday: string, tz: string): Promise<ReportRow[]> {
  const wk = weekRange(monday, tz);
  const prev = weekRange(addDays(monday, -7), tz);
  const { data, error } = await adminClient()
    .from('session_rows')
    .select('id,task_id,task_name,project_id,project_name,project_color,project_archived_at,started_at,ended_at,is_example')
    .eq('user_id', userId)
    .eq('is_example', false)
    .lt('started_at', wk.end.toISOString())
    .or(`ended_at.is.null,ended_at.gt.${prev.start.toISOString()}`)
    .limit(10000);
  if (error) throw new Error(`weekly rows: ${error.code}`);
  return (data ?? []) as ReportRow[];
}

async function weeklyEmails(settings: Map<string, SettingsRow>) {
  const now = Date.now();
  for (const st of settings.values()) {
    if (!st.weekly_email_enabled || !isWeeklyDue(now, st.time_zone)) continue;
    const monday = summaryWeekMonday(now, st.time_zone);
    const to = await userEmail(st.user_id);
    if (!to) continue;
    const id = await claimEmail(st.user_id, 'weekly_summary', `week:${monday}`, 'sending', to, 'Your week');
    if (!id) continue;
    const summary = buildWeeklySummary(await weeklyRows(st.user_id, monday, st.time_zone), monday, st.time_zone, now);
    if (summary.total_seconds === 0) {
      await adminClient().from('email_log').update({ status: 'skipped_empty', next_attempt_at: null, subject: summary.subject }).eq('id', id);
      continue;
    }
    await deliverClaimed(id, {
      userId: st.user_id, kind: 'weekly_summary', refKey: `week:${monday}`, to, tz: st.time_zone,
      content: weeklyEmail({ appUrl: env.appUrl, summary }), attemptsBefore: 0,
    });
  }
}

// ------------------------------------------------------- stale recovery
async function recoverStale() {
  const db = adminClient();
  const nowIso = new Date().toISOString();
  const { data: rows } = await db
    .from('email_log')
    .select('id,attempts')
    .eq('status', 'sending')
    .eq('is_example', false)
    .lt('next_attempt_at', nowIso);
  for (const r of (rows ?? []) as { id: string; attempts: number }[]) {
    const attempts = Math.min(3, r.attempts + 1);
    await db.from('email_log').update({
      status: 'failed', error: storeError('interrupted', 'Interrupted before sending.'), attempts,
      next_attempt_at: attempts < 3 ? nowIso : null,
    }).eq('id', r.id).eq('status', 'sending');
  }
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id,nudge_attempts')
    .eq('nudge_status', 'sending')
    .lt('nudge_next_attempt_at', nowIso);
  for (const s of (subs ?? []) as { id: string; nudge_attempts: number }[]) {
    await db.from('push_subscriptions').update({
      nudge_status: 'failed', last_failure_at: nowIso, last_error: storePushError(0, 'Interrupted before sending.'),
      nudge_next_attempt_at: s.nudge_attempts < 3 ? nowIso : null,
    }).eq('id', s.id).eq('nudge_status', 'sending');
  }
}

// ---------------------------------------------------------------- retries
interface EmailRow { id: string; user_id: string; kind: string; ref_key: string; to_email: string; attempts: number }

async function retryEmails(settings: Map<string, SettingsRow>) {
  const db = adminClient();
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from('email_log')
    .select('id,user_id,kind,ref_key,to_email,attempts')
    .eq('status', 'failed')
    .eq('is_example', false)
    .lt('attempts', 3)
    .lte('next_attempt_at', nowIso);
  for (const row of (data ?? []) as EmailRow[]) {
    const st = settings.get(row.user_id);
    if (!st) continue;
    // Nudges retry only while their session is still running.
    let runningRow: RunningRow | null = null;
    if (row.kind === 'nudge') {
      const sessionId = row.ref_key.replace(/^session:/, '');
      const { data: r } = await db
        .from('session_rows')
        .select('id,user_id,started_at,task_name,project_name,nudge_acknowledged_at')
        .eq('id', sessionId)
        .is('ended_at', null)
        .maybeSingle();
      if (!r) {
        await db.from('email_log').update({ next_attempt_at: null }).eq('id', row.id).eq('status', 'failed');
        continue;
      }
      runningRow = r as RunningRow;
    }
    // Claim the retry so overlapping passes never send it twice.
    const { data: claimed } = await db
      .from('email_log')
      .update({ status: 'sending', next_attempt_at: new Date(Date.now() + 10 * 60_000).toISOString() })
      .eq('id', row.id)
      .eq('status', 'failed')
      .lt('attempts', 3)
      .lte('next_attempt_at', nowIso)
      .select('id');
    if (!claimed?.length) continue;
    const content = await rebuildContent(row, st, runningRow);
    if (!content) {
      await db.from('email_log').update({ status: 'failed', next_attempt_at: null }).eq('id', row.id);
      continue;
    }
    await deliverClaimed(row.id, {
      userId: row.user_id, kind: row.kind as 'nudge', refKey: row.ref_key, to: row.to_email, tz: st.time_zone, content, attemptsBefore: row.attempts,
    });
  }
}

async function rebuildContent(row: EmailRow, st: SettingsRow, running: RunningRow | null) {
  if (row.kind === 'nudge' && running) {
    return nudgeEmail({
      appUrl: env.appUrl, sessionId: running.id, taskName: running.task_name, projectName: running.project_name,
      startedAt: running.started_at, elapsedSeconds: Math.floor((Date.now() - Date.parse(running.started_at)) / 1000), tz: st.time_zone,
    });
  }
  if (row.kind === 'weekly_summary') {
    const monday = row.ref_key.replace(/^week:/, '');
    const summary = buildWeeklySummary(await weeklyRows(row.user_id, monday, st.time_zone), monday, st.time_zone, Date.now());
    return weeklyEmail({ appUrl: env.appUrl, summary });
  }
  if (row.kind === 'test') return testEmail({ appUrl: env.appUrl });
  if (row.kind === 'password_link') {
    const { data, error } = await adminClient().auth.admin.generateLink({ type: 'recovery', email: row.to_email });
    if (error || !data.properties?.hashed_token) return null;
    return passwordLinkEmail({ appUrl: env.appUrl, link: `${env.appUrl}/set-password?token_hash=${data.properties.hashed_token}&type=recovery` });
  }
  return null;
}

async function retryAlerts(settings: Map<string, SettingsRow>) {
  const db = adminClient();
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth_secret,nudge_session_id,nudge_attempts')
    .eq('nudge_status', 'failed')
    .lt('nudge_attempts', 3)
    .lte('nudge_next_attempt_at', nowIso);
  for (const sub of (data ?? []) as (PushTarget & { user_id: string; nudge_session_id: string | null; nudge_attempts: number })[]) {
    const st = settings.get(sub.user_id);
    let running: RunningRow | null = null;
    if (sub.nudge_session_id && st?.nudge_browser_enabled) {
      const { data: r } = await db
        .from('session_rows')
        .select('id,user_id,started_at,task_name,project_name,nudge_acknowledged_at')
        .eq('id', sub.nudge_session_id)
        .is('ended_at', null)
        .is('nudge_acknowledged_at', null)
        .maybeSingle();
      running = (r as RunningRow | null) ?? null;
    }
    if (!running) {
      await db.from('push_subscriptions').update({ nudge_next_attempt_at: null }).eq('id', sub.id).eq('nudge_status', 'failed');
      continue;
    }
    const { data: claimed } = await db
      .from('push_subscriptions')
      .update({
        nudge_status: 'sending', nudge_attempts: sub.nudge_attempts + 1,
        nudge_next_attempt_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      })
      .eq('id', sub.id)
      .eq('nudge_session_id', running.id)
      .eq('nudge_status', 'failed')
      .lt('nudge_attempts', 3)
      .lte('nudge_next_attempt_at', nowIso)
      .select('id');
    if (!claimed?.length) continue;
    await deliverAlert(sub, running, sub.nudge_attempts + 1);
  }
}
