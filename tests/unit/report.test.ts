import { describe, expect, it } from 'vitest';
import { computeReport, validatePeriodStart, type ReportRow } from '@/lib/report-core';
import { localDateTimeToInstant } from '@/lib/time';

const NY = 'America/New_York';
const at = (d: string, t: string) => localDateTimeToInstant(d, t, NY).toISOString();
let n = 0;
const row = (p: Partial<ReportRow> & { started_at: string; ended_at: string | null }): ReportRow => ({
  id: `s${++n}`, task_id: p.task_id ?? 't1', task_name: p.task_name ?? 'Invoice prep', project_id: p.project_id === undefined ? 'p1' : p.project_id,
  project_name: p.project_name ?? 'Admin', project_color: p.project_color ?? 'azure', project_archived_at: null, ...p,
});

describe('reports (§6, T-R1–T-R3, T-R6)', () => {
  const NOW = Date.parse(at('2026-10-09', '12:00'));
  it('splits a Sunday→Monday session between weeks and sorts No project last', () => {
    const rows = [
      row({ started_at: at('2026-10-04', '23:00'), ended_at: at('2026-10-05', '01:00') }),
      row({ started_at: at('2026-10-06', '09:00'), ended_at: at('2026-10-06', '10:00'), project_id: null, project_name: null, project_color: null }),
      row({ started_at: at('2026-10-07', '09:00'), ended_at: at('2026-10-07', '09:30'), project_id: 'p2', project_name: 'Acme', task_id: 't2' }),
    ];
    const r = computeReport(rows, 'week', '2026-10-05', NY, NOW);
    expect(r.total_seconds).toBe(3600 + 3600 + 1800);
    expect(r.previous_total_seconds).toBe(3600);
    expect(r.projects.map((p) => p.name)).toEqual(['Admin', 'Acme', 'No project']);
    expect(r.days).toHaveLength(7);
    expect(r.days[0].total_seconds).toBe(3600);
  });
  it('includes the running timer up to now', () => {
    const r = computeReport([row({ started_at: at('2026-10-09', '11:00'), ended_at: null })], 'week', '2026-10-05', NY, NOW);
    expect(r.total_seconds).toBe(3600);
    expect(r.includes_running).toBe(true);
  });
  it('month has one bar per day', () => {
    expect(computeReport([], 'month', '2026-02-01', NY, NOW).days).toHaveLength(28);
    expect(computeReport([], 'month', '2026-10-01', NY, NOW).days).toHaveLength(31);
  });
  it('rejects a Wednesday, a future period and nonsense', () => {
    expect(validatePeriodStart('week', '2026-10-07', NY, NOW)).toBe('not-monday');
    expect(validatePeriodStart('week', '2026-10-12', NY, NOW)).toBe('future');
    expect(validatePeriodStart('week', 'nonsense', NY, NOW)).toBe('invalid');
    expect(validatePeriodStart('month', '2026-10-02', NY, NOW)).toBe('not-first');
    expect(validatePeriodStart('week', '2026-10-05', NY, NOW)).toBeNull();
  });
});
