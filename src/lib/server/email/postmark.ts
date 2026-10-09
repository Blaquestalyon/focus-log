import 'server-only';
import { env } from '../env';

export interface EmailContent { subject: string; html: string; text: string; tag: 'nudge' | 'weekly' | 'test' | 'password-link' }

export type SendOutcome =
  | { ok: true; messageId: string }
  | { ok: false; retry: boolean; keyRejected: boolean; code: string; human: string };

export const RETRY_HUMAN = "Postmark couldn't be reached. Focus Log will retry.";
export const RETRY_FINAL_HUMAN = "Postmark couldn't be reached after 3 tries.";

/** POST https://api.postmarkapp.com/email with a 10-second timeout (§8). */
export async function postmarkSend(to: string, c: EmailContent): Promise<SendOutcome> {
  const token = env.postmarkToken;
  if (!token) return { ok: false, retry: false, keyRejected: false, code: 'unset', human: "Email isn't set up yet." };
  let res: Response;
  try {
    res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': token },
      body: JSON.stringify({
        From: env.emailFrom,
        To: to,
        Subject: c.subject,
        HtmlBody: c.html,
        TextBody: c.text,
        MessageStream: 'outbound',
        Tag: c.tag,
        TrackOpens: false,
        TrackLinks: 'None',
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, retry: true, keyRejected: false, code: 'network', human: RETRY_HUMAN };
  }
  let data: { ErrorCode?: number; Message?: string; MessageID?: string } = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  const ec = typeof data.ErrorCode === 'number' ? data.ErrorCode : -1;
  if (res.status === 200 && ec === 0) return { ok: true, messageId: data.MessageID ?? '' };
  const code = `${res.status}/${ec}`;
  if (res.status === 401 || ec === 10) {
    return { ok: false, retry: false, keyRejected: true, code, human: "Postmark didn't accept the email key. Replace POSTMARK_SERVER_TOKEN where Focus Log is hosted." };
  }
  if (res.status === 422 && (ec === 400 || ec === 401)) {
    return { ok: false, retry: false, keyRejected: false, code, human: "The sending address isn't verified in Postmark yet. Finish the domain or sender check in Postmark." };
  }
  if (res.status === 422 && ec === 406) {
    return { ok: false, retry: false, keyRejected: false, code, human: "Postmark has paused sending to this address after a bounce. Reactivate it in Postmark's Suppressions list." };
  }
  if (res.status === 422) {
    const msg = String(data.Message ?? '').slice(0, 200);
    return { ok: false, retry: false, keyRejected: false, code, human: `Postmark refused this email (code ${ec}): ${msg}.` };
  }
  return { ok: false, retry: true, keyRejected: false, code, human: RETRY_HUMAN };
}

/** Stored as "[code] human" (≤300 chars); the screens show only the human part. */
export function storeError(code: string, human: string): string {
  return `[${code}] ${human}`.slice(0, 300);
}

export function humanError(stored: string | null): string | null {
  if (!stored) return null;
  return stored.replace(/^\[[^\]]*\]\s*/, '');
}

export function errorCode(stored: string | null): string | null {
  const m = stored?.match(/^\[([^\]]*)\]/);
  return m ? m[1] : null;
}
