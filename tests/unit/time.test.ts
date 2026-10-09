import { describe, expect, it } from 'vitest';
import { addDays, clipSeconds, dayRange, localDateStr, localDateTimeToInstant, mondayOf, monthRange, weekRange } from '@/lib/time';

const NY = 'America/New_York';

describe('time-zone boundaries (§6, T-R4)', () => {
  it('days start at local midnight', () => {
    expect(dayRange('2026-10-08', NY).start.toISOString()).toBe('2026-10-08T04:00:00.000Z');
  });
  it('DST spring-forward day is 23 real hours', () => {
    const r = dayRange('2026-03-08', NY);
    expect((r.end.getTime() - r.start.getTime()) / 3600_000).toBe(23);
  });
  it('DST fall-back day is 25 real hours', () => {
    const r = dayRange('2026-11-01', NY);
    expect((r.end.getTime() - r.start.getTime()) / 3600_000).toBe(25);
  });
  it('weeks run Monday to Monday; months 1st to 1st', () => {
    expect(mondayOf('2026-10-08')).toBe('2026-10-05');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    const w = weekRange('2026-10-05', NY);
    expect(w.end.getTime() - w.start.getTime()).toBe(7 * 86400_000);
    const m = monthRange('2026-10-01', NY);
    expect(localDateStr(m.end, NY)).toBe('2026-11-01');
  });
  it('clips a session that crosses midnight', () => {
    const start = localDateTimeToInstant('2026-10-07', '23:40', NY);
    const end = localDateTimeToInstant('2026-10-08', '00:25', NY);
    const d1 = dayRange('2026-10-07', NY);
    const d2 = dayRange('2026-10-08', NY);
    expect(clipSeconds(start, end, d1.start, d1.end)).toBe(20 * 60);
    expect(clipSeconds(start, end, d2.start, d2.end)).toBe(25 * 60);
  });
  it('entered times are read in the saved zone (T-H10)', () => {
    expect(localDateTimeToInstant('2026-10-08', '09:00', NY).toISOString()).toBe('2026-10-08T13:00:00.000Z');
  });
  it('calendar arithmetic', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
