import 'server-only';
import webpush from 'web-push';
import { env } from './env';
import { log } from './log';
import { storeError } from './email/postmark';

export interface PushTarget { id: string; endpoint: string; p256dh: string; auth_secret: string }

export type PushOutcome =
  | { ok: true }
  | { ok: false; gone: true; status: number }
  | { ok: false; gone: false; retry: boolean; keyRejected: boolean; status: number; human: string };

export const PUSH_RETRY_HUMAN = "The push service couldn't be reached. Focus Log will retry.";
export const PUSH_RETRY_FINAL_HUMAN = "The push service couldn't be reached after 3 tries.";
export const PUSH_NOT_CONFIGURED_HUMAN = "Pop-up alerts aren't set up yet.";
export const PUSH_KEYS_HUMAN = "The push service rejected Focus Log's alert keys. The VAPID keys must stay the ones browsers signed up with.";

export interface AlertPayload {
  v: 1;
  type: 'nudge' | 'test';
  title: string;
  body: string;
  tag: string;
  url: string;
  requireInteraction: boolean;
}

function host(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'unknown';
  }
}

/** Send one encrypted, VAPID-signed alert (§8 "Sending an alert"). */
export async function sendAlert(sub: PushTarget, payload: AlertPayload, ttl: number): Promise<PushOutcome> {
  if (!env.vapidConfigured) {
    return { ok: false, gone: false, retry: false, keyRejected: false, status: 0, human: PUSH_NOT_CONFIGURED_HUMAN };
  }
  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } },
      JSON.stringify(payload),
      {
        vapidDetails: { subject: env.vapidSubject, publicKey: env.vapidPublicKey!, privateKey: env.vapidPrivateKey! },
        TTL: ttl,
        urgency: 'high',
        contentEncoding: 'aes128gcm',
        timeout: 10_000,
      },
    );
    log.info({ host: host(sub.endpoint), status: res.statusCode, row: sub.id }, 'push');
    return { ok: true };
  } catch (e) {
    const status = typeof (e as { statusCode?: unknown }).statusCode === 'number' ? (e as { statusCode: number }).statusCode : 0;
    log.warn({ host: host(sub.endpoint), status, row: sub.id }, 'push failed');
    if (status === 404 || status === 410) return { ok: false, gone: true, status };
    if (status === 401 || status === 403) return { ok: false, gone: false, retry: false, keyRejected: true, status, human: PUSH_KEYS_HUMAN };
    if (status === 413) return { ok: false, gone: false, retry: false, keyRejected: false, status, human: 'The alert was too large for the push service.' };
    if (status >= 400 && status < 500 && status !== 429) {
      return { ok: false, gone: false, retry: false, keyRejected: false, status, human: `The push service refused this alert (code ${status}).` };
    }
    return { ok: false, gone: false, retry: true, keyRejected: false, status, human: PUSH_RETRY_HUMAN };
  }
}

export function storePushError(status: number, human: string): string {
  return storeError(String(status || 'network'), human);
}

export function nudgePayload(sessionId: string, taskName: string, duration: string): AlertPayload {
  return {
    v: 1,
    type: 'nudge',
    title: 'Focus Log: timer still running',
    body: `${taskName} has been running for ${duration}.`,
    tag: `fl-nudge-${sessionId}`,
    url: `/?nudge=${sessionId}`,
    requireInteraction: true,
  };
}

export const TEST_PAYLOAD: AlertPayload = {
  v: 1,
  type: 'test',
  title: 'Focus Log test alert',
  body: 'Pop-up alerts are working on this computer.',
  tag: 'fl-test',
  url: '/settings',
  requireInteraction: false,
};
