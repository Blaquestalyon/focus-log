import 'server-only';
import { adminClient } from '../supabase';
import { env } from '../env';
import { log } from '../log';
import { firstOfMonth, startOfLocalDay, todayStr } from '@/lib/time';
import { postmarkSend, storeError, RETRY_FINAL_HUMAN, UNSET_HUMAN, type EmailContent, type SendOutcome } from './postmark';

export type EmailKind = 'nudge' | 'weekly_summary' | 'test' | 'password_link';

const RETRY_DELAYS_MIN = [5, 30]; // after the 1st and 2nd failed attempt

/** Non-example `sent` emails in the current local calendar month, all kinds (§6 cap). */
export async function sentThisMonth(userId: string, tz: string): Promise<number> {
  const start = startOfLocalDay(firstOfMonth(todayStr(tz)), tz);
  const { count, error } = await adminClient()
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_example', false)
    .eq('status', 'sent')
    .gte('sent_at', start.toISOString());
  if (error) throw new Error(`email cap count failed: ${error.code}`);
  return count ?? 0;
}

/** Non-example emails of `kind` logged in the last `ms` (per-account send limits, §6). */
export async function recentEmailCount(userId: string, kind: EmailKind, ms: number): Promise<number> {
  const { count } = await adminClient()
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('is_example', false)
    .gte('created_at', new Date(Date.now() - ms).toISOString());
  return count ?? 0;
}

export function capMessage(cap: number) {
  return `Monthly email cap reached (${cap}). Raise EMAIL_MONTHLY_CAP to send more.`;
}

/** Insert the log row first; only the caller whose insert succeeded may send. */
export async function claimEmail(
  userId: string, kind: EmailKind, refKey: string, status: 'sending' | 'skipped_empty' | 'skipped_acknowledged', to: string, subject: string,
): Promise<string | null> {
  const { data, error } = await adminClient().rpc('fl_email_log_claim', {
    p_user_id: userId, p_kind: kind, p_ref_key: refKey, p_status: status, p_to: to, p_subject: subject,
  });
  if (error) throw new Error(`email claim failed: ${error.code}`);
  return (data as string | null) ?? null;
}

/**
 * Send a claimed row (status 'sending') and record the outcome. `attemptsBefore` is the
 * row's attempts count before this try. Handles the monthly cap (password links exempt).
 */
export async function deliverClaimed(
  rowId: string,
  p: { userId: string; kind: EmailKind; refKey: string; to: string; tz: string; content: EmailContent; attemptsBefore: number; canRetry?: boolean },
): Promise<SendOutcome> {
  const db = adminClient();
  const attempt = p.attemptsBefore + 1;
  if (p.kind !== 'password_link') {
    const cap = env.emailMonthlyCap;
    const used = await sentThisMonth(p.userId, p.tz);
    if (used >= cap) {
      const human = capMessage(cap);
      await db.from('email_log').update({
        status: 'failed', error: storeError('cap', human), attempts: attempt, next_attempt_at: null, subject: p.content.subject,
      }).eq('id', rowId);
      log.warn({ kind: p.kind, ref: p.refKey, status: 'failed', code: 'cap' }, 'email');
      return { ok: false, retry: false, keyRejected: false, code: 'cap', human };
    }
  }
  const out = await postmarkSend(p.to, p.content);
  if (out.ok) {
    await db.from('email_log').update({
      status: 'sent', provider_message_id: out.messageId, sent_at: new Date().toISOString(), attempts: attempt,
      next_attempt_at: null, error: null, subject: p.content.subject,
    }).eq('id', rowId);
    log.info({ kind: p.kind, ref: p.refKey, status: 'sent' }, 'email');
    return out;
  }
  const retryable = out.retry && p.canRetry !== false && attempt < 3;
  const human = out.retry && !retryable ? RETRY_FINAL_HUMAN : out.human;
  const next = retryable ? new Date(Date.now() + RETRY_DELAYS_MIN[attempt - 1] * 60_000).toISOString() : null;
  await db.from('email_log').update({
    status: 'failed', error: storeError(`postmark ${out.code}`, human), attempts: attempt, next_attempt_at: next, subject: p.content.subject,
  }).eq('id', rowId);
  log.warn({ kind: p.kind, ref: p.refKey, status: 'failed', code: out.code }, 'email');
  return { ...out, human };
}

/** Claim-then-send for one-off emails (test, password link). */
export async function sendLogged(p: {
  userId: string; kind: EmailKind; refKey: string; to: string; tz: string; content: EmailContent;
}): Promise<{ rowId: string | null; outcome: SendOutcome | null }> {
  if (!env.postmarkToken) {
    // Password links are still logged (as failed) so the owner can see why nothing arrived.
    if (p.kind === 'password_link') {
      const id = await claimEmail(p.userId, p.kind, p.refKey, 'sending', p.to, p.content.subject);
      if (id) {
        await adminClient().from('email_log').update({
          status: 'failed', error: storeError('unset', UNSET_HUMAN), attempts: 1, next_attempt_at: null,
        }).eq('id', id);
      }
      log.warn({ kind: p.kind, code: 'EMAIL_NOT_CONFIGURED' }, 'email');
      return { rowId: id, outcome: { ok: false, retry: false, keyRejected: false, code: 'unset', human: UNSET_HUMAN } };
    }
    return { rowId: null, outcome: null };
  }
  const id = await claimEmail(p.userId, p.kind, p.refKey, 'sending', p.to, p.content.subject);
  if (!id) return { rowId: null, outcome: null };
  const outcome = await deliverClaimed(id, { ...p, attemptsBefore: 0 });
  return { rowId: id, outcome };
}

const emailCache = new Map<string, string>();
/** The owner's sign-in address (the only recipient Focus Log ever emails). */
export async function userEmail(userId: string): Promise<string | null> {
  const hit = emailCache.get(userId);
  if (hit) return hit;
  const { data, error } = await adminClient().auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  emailCache.set(userId, data.user.email);
  return data.user.email;
}
