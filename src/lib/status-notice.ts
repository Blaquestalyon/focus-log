/** When a dismissed System status notice comes back (§4 Timer "Notices", item 5). Pure; unit tested. */
import type { StatusResponse } from './types';

export interface StoredDismissal { keys: string[]; at: number; failed: number }
const DAY = 24 * 3600_000;

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function statusNoticeVisible(
  status: Pick<StatusResponse, 'problems' | 'email'>,
  stored: StoredDismissal | null,
  now = Date.now(),
): boolean {
  const keys = status.problems.map((p) => p.key);
  if (!keys.length) return false;
  if (!stored) return true;
  const nonEmail = keys.filter((k) => k !== 'emails_failed');
  const storedNonEmail = stored.keys.filter((k) => k !== 'emails_failed');
  // Problems other than emails_failed changed (one appeared or cleared) and one still remains.
  if (nonEmail.length && !sameSet(nonEmail, storedNonEmail)) return true;
  // A real outage keeps coming back every 24 hours until it is fixed.
  if (nonEmail.length && now - stored.at >= DAY) return true;
  // emails_failed comes back only when it is new or another email failed.
  if (keys.includes('emails_failed') && (!stored.keys.includes('emails_failed') || status.email.failed_7d > stored.failed)) return true;
  return false;
}
