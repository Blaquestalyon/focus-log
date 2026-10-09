import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell } from '@/lib/server/csv';

describe('CSV export (§6, T-S6, T-H7)', () => {
  it('guards formulas and quotes per RFC 4180', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@x')).toBe("'@x");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
  it('has the BOM, exact columns, CRLF and local times', () => {
    const csv = buildCsv(
      [
        { id: 'abc', started_at: '2026-10-08T03:40:00Z', ended_at: '2026-10-08T04:25:00Z', duration_seconds: 2700, task_name: 'Sponsor', project_name: null, source: 'timer', edited_at: null },
      ],
      'America/New_York',
    );
    expect(csv.startsWith('﻿date,start,end,duration_minutes,duration_hours,task,project,source,edited,session_id\r\n')).toBe(true);
    expect(csv).toContain('2026-10-07,23:40,2026-10-08 00:25,45,0.75,Sponsor,,timer,no,abc\r\n');
  });
});
