import { describe, expect, it } from 'vitest';
import { statusNoticeVisible } from '@/lib/status-notice';

const status = (keys: string[], failed = 0) => ({
  problems: keys.map((key) => ({ key, level: 'warning' as const, message: key })),
  email: { configured: true, key_rejected: false, last_sent_at: null, failed_7d: failed, sent_this_month: 0, monthly_cap: 90 },
});
const DAY = 24 * 3600_000;

describe('System status notice (T-L4)', () => {
  it('shows when there are problems and nothing was dismissed', () => {
    expect(statusNoticeVisible(status(['email_not_configured']), null)).toBe(true);
    expect(statusNoticeVisible(status([]), null)).toBe(false);
  });
  it('a real outage comes back after 24 hours, or when problems change', () => {
    const stored = { keys: ['email_not_configured'], at: 0, failed: 0 };
    expect(statusNoticeVisible(status(['email_not_configured']), stored, DAY - 1)).toBe(false);
    expect(statusNoticeVisible(status(['email_not_configured']), stored, DAY)).toBe(true);
    expect(statusNoticeVisible(status(['email_not_configured', 'scheduler_stopped']), stored, 1)).toBe(true);
  });
  it('emails_failed alone stays hidden until another email fails', () => {
    const stored = { keys: ['emails_failed'], at: 0, failed: 1 };
    expect(statusNoticeVisible(status(['emails_failed'], 1), stored, 7 * DAY)).toBe(false);
    expect(statusNoticeVisible(status(['emails_failed'], 2), stored, 7 * DAY)).toBe(true);
  });
});
