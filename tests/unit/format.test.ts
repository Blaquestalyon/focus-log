import { describe, expect, it } from 'vitest';
import {
  durationWords, formatClock, formatDate, formatDayHeader, formatDayLong, formatDelta, formatDuration, formatMonth, formatShare,
  formatStartedFlank, formatThreshold, formatTime, formatTimeRange, formatWeekRange,
} from '@/lib/format';

const NY = 'America/New_York';
const NOW = Date.parse('2026-10-08T16:00:00Z'); // Thu Oct 8 2026, 12:00 PM in New York

describe('formats (§4 Shared formats)', () => {
  it('clock is H:MM:SS with unpadded, unbounded hours', () => {
    expect(formatClock(249)).toBe('0:04:09');
    expect(formatClock(97450)).toBe('27:04:10');
    expect(formatClock(3729)).toBe('1:02:09');
  });
  it('duration', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(59)).toBe('<1m');
    expect(formatDuration(42 * 60 + 59)).toBe('42m');
    expect(formatDuration(3900)).toBe('1h 05m');
    expect(formatDuration(12 * 3600 + 30 * 60)).toBe('12h 30m');
  });
  it('delta uses a true minus and handles zero previous', () => {
    expect(formatDelta(10 * 3600, 7 * 3600 + 50 * 60)).toBe('+2h 10m');
    expect(formatDelta(3600, 3600 + 3900)).toBe('−1h 05m');
    expect(formatDelta(3600, 3600)).toBe('No change');
    expect(formatDelta(3600, 0)).toBe('—');
  });
  it('times and ranges', () => {
    expect(formatTime('2026-10-08T13:02:00Z', NY)).toBe('9:02 AM');
    expect(formatTimeRange('2026-10-08T13:00:00Z', '2026-10-08T14:12:00Z', NY)).toBe('9:00–10:12 AM');
    expect(formatTimeRange('2026-10-08T03:40:00Z', '2026-10-08T04:25:00Z', NY)).toBe('11:40 PM–12:25 AM');
    expect(formatTimeRange('2026-10-08T13:02:00Z', null, NY)).toBe('9:02 AM–now');
  });
  it('dates and day headers', () => {
    expect(formatDate('2026-10-08T16:00:00Z', NY, NOW)).toBe('Thu, Oct 8');
    expect(formatDate('2025-10-08T16:00:00Z', NY, NOW)).toBe('Wed, Oct 8, 2025');
    expect(formatDayLong('2026-10-08', NY, NOW)).toBe('Thursday, October 8');
    expect(formatDayLong('2025-10-08', NY, NOW)).toBe('Wednesday, October 8, 2025');
    expect(formatDayHeader('2026-10-08', NY, NOW)).toBe('Today · Thu, Oct 8');
    expect(formatDayHeader('2026-10-07', NY, NOW)).toBe('Yesterday · Wed, Oct 7');
  });
  it('week ranges and months', () => {
    expect(formatWeekRange('2026-10-05')).toBe('Oct 5 – 11, 2026');
    expect(formatWeekRange('2026-09-28')).toBe('Sep 28 – Oct 4, 2026');
    expect(formatWeekRange('2025-12-29')).toBe('Dec 29, 2025 – Jan 4, 2026');
    expect(formatMonth('2026-10-01')).toBe('October 2026');
  });
  it('share', () => {
    expect(formatShare(34.2)).toBe('34%');
    expect(formatShare(0.4)).toBe('<1%');
    expect(formatShare(0)).toBe('0%');
  });
  it('flank, threshold and words', () => {
    expect(formatStartedFlank('2026-10-08T13:02:00Z', NY, NOW)).toBe('9:02 AM');
    expect(formatStartedFlank('2026-10-08T03:40:00Z', NY, NOW)).toBe('Yesterday 11:40 PM');
    expect(formatStartedFlank('2026-10-07T03:40:00Z', NY, NOW)).toBe('Tue, Oct 6 11:40 PM');
    expect(formatThreshold(30)).toBe('30 minutes');
    expect(formatThreshold(60)).toBe('1 hour');
    expect(formatThreshold(90)).toBe('1 hour 30 minutes');
    expect(formatThreshold(720)).toBe('12 hours');
    expect(durationWords(3720)).toBe('1 hour 2 minutes');
  });
});
