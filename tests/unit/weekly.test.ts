import { describe, expect, it } from 'vitest';
import { buildWeeklySummary, isWeeklyDue, summaryWeekMonday, weeklySubject } from '@/lib/weekly-core';
import { localDateTimeToInstant } from '@/lib/time';
import type { ReportRow } from '@/lib/report-core';

const NY = 'America/New_York';
const at = (d: string, t: string) => localDateTimeToInstant(d, t, NY);
const row = (p: Partial<ReportRow> & { started_at: string; ended_at: string | null }): ReportRow => ({
  id: Math.random().toString(36), task_id: p.task_id ?? 't1', task_name: p.task_name ?? 'Invoice prep',
  project_id: p.project_id === undefined ? 'p1' : p.project_id, project_name: p.project_name ?? 'Admin', project_color: 'azure',
  project_archived_at: null, ...p,
});

describe('weekly summary (§6, T-E7)', () => {
  it('is due Monday 08:00–23:59 local only', () => {
    expect(isWeeklyDue(at('2026-10-12', '07:59'), NY)).toBe(false);
    expect(isWeeklyDue(at('2026-10-12', '08:00'), NY)).toBe(true);
    expect(isWeeklyDue(at('2026-10-12', '23:59'), NY)).toBe(true);
    expect(isWeeklyDue(at('2026-10-11', '12:00'), NY)).toBe(false);
    expect(isWeeklyDue(at('2026-10-13', '12:00'), NY)).toBe(false);
    expect(summaryWeekMonday(at('2026-10-12', '08:00'), NY)).toBe('2026-10-05');
  });
  it('clips, computes the delta, ignores examples and builds the subject', () => {
    const now = at('2026-10-12', '08:00').getTime();
    const rows = [
      row({ started_at: at('2026-10-06', '09:00').toISOString(), ended_at: at('2026-10-06', '11:00').toISOString() }),
      row({ started_at: at('2026-10-11', '23:00').toISOString(), ended_at: null, task_id: 't2', task_name: 'Late', project_id: 'p2', project_name: 'Acme' }),
      row({ started_at: at('2026-09-29', '09:00').toISOString(), ended_at: at('2026-09-29', '10:00').toISOString() }),
      row({ started_at: at('2026-10-07', '09:00').toISOString(), ended_at: at('2026-10-07', '10:00').toISOString(), is_example: true }),
    ];
    const s = buildWeeklySummary(rows, '2026-10-05', NY, now);
    expect(s.total_seconds).toBe(2 * 3600 + 3600);
    expect(s.previous_total_seconds).toBe(3600);
    expect(s.running_at_end).toBe(true);
    expect(s.subject).toBe('Your week: 3h 00m across 2 projects');
    expect(s.days).toHaveLength(7);
  });
  it('subject singular, no-project and zero', () => {
    expect(weeklySubject(3600, 1)).toBe('Your week: 1h 00m across 1 project');
    expect(weeklySubject(3 * 3600 + 600, 0)).toBe('Your week: 3h 10m logged');
    const s = buildWeeklySummary([], '2026-10-05', NY, Date.now());
    expect(s.total_seconds).toBe(0);
  });
  it('example-only weeks count as nothing logged', () => {
    const s = buildWeeklySummary(
      [row({ started_at: at('2026-10-06', '09:00').toISOString(), ended_at: at('2026-10-06', '10:00').toISOString(), is_example: true })],
      '2026-10-05', NY, at('2026-10-12', '09:00').getTime(),
    );
    expect(s.total_seconds).toBe(0);
  });
});
