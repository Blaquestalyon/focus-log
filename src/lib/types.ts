/** Shapes shared by the API and the screens (blueprint §7 "Shared shapes"). */

export const PROJECT_COLORS = ['azure', 'violet', 'rose', 'coral', 'lime', 'teal', 'sand', 'slate'] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export interface TaskRef { id: string; name: string; archived: boolean }
export interface ProjectRef { id: string; name: string; color: ProjectColor; archived: boolean }

export interface ClosedSession {
  id: string;
  seconds: number;
  run_seconds: number;
  dropped: boolean;
  end_reason: 'pause' | 'stop' | 'switch';
  from: 'running' | 'paused';
}

export interface TimerView {
  status: 'idle' | 'running' | 'paused';
  server_now: string;
  task: TaskRef | null;
  project: ProjectRef | null;
  session: { id: string; started_at: string } | null;
  run: { started_at: string | null; closed_seconds: number } | null;
  paused_at: string | null;
  nudge: { after_minutes: number; due_at: string; acknowledged: boolean; active: boolean } | null;
  closed_session?: ClosedSession;
  already_running?: true;
  resumed?: true;
  /** Present when starting by name unarchived an archived task (F3 toast "Unarchived …"). */
  unarchived?: true;
}

export interface SessionRow {
  id: string;
  task: TaskRef;
  project: ProjectRef | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  live_seconds: number | null;
  day_seconds?: number;
  source: 'timer' | 'manual';
  end_reason: 'pause' | 'stop' | 'switch' | null;
  edited: boolean;
  is_example: boolean;
}

export interface TodayResponse {
  date: string;
  time_zone: string;
  total_seconds: number;
  server_now: string;
  sessions: SessionRow[];
}

export interface SessionsResponse {
  rows: SessionRow[];
  next_cursor: string | null;
  total_count: number;
  total_seconds: number;
  day_totals: { date: string; seconds: number }[];
}

export interface ProjectItem {
  id: string;
  name: string;
  color: ProjectColor;
  archived: boolean;
  task_count: number;
  total_seconds: number;
  last_used_at: string | null;
  is_example: boolean;
}

export interface TaskItem {
  id: string;
  name: string;
  project: ProjectRef | null;
  archived: boolean;
  session_count: number;
  total_seconds: number;
  last_used_at: string | null;
  is_example: boolean;
}

export interface Settings {
  email: string;
  time_zone: string;
  time_zone_confirmed: boolean;
  nudge_after_minutes: number;
  nudge_email_enabled: boolean;
  nudge_browser_enabled: boolean;
  weekly_email_enabled: boolean;
  last_project_id: string | null;
  example_notice_dismissed_at: string | null;
}

export interface ReportResponse {
  range: { start: string; end: string; label: string };
  total_seconds: number;
  previous_total_seconds: number;
  includes_running: boolean;
  days: { date: string; total_seconds: number; by_project: { project_id: string | null; seconds: number }[] }[];
  projects: {
    id: string | null;
    name: string;
    color: ProjectColor | null;
    archived: boolean;
    seconds: number;
    share: number;
    tasks: { id: string; name: string; seconds: number }[];
  }[];
}

export interface StatusProblem { key: string; level: 'warning' | 'problem'; message: string }

export interface StatusResponse {
  email: { configured: boolean; key_rejected: boolean; last_sent_at: string | null; failed_7d: number; sent_this_month: number; monthly_cap: number };
  scheduler: { enabled: boolean; last_tick_at: string | null; healthy: boolean; last_error: string | null };
  push: { configured: boolean; enabled: boolean; key_rejected: boolean; browsers: number; failing_browsers: string[]; last_sent_at: string | null };
  problems: StatusProblem[];
  version: string;
}

export interface PushBrowser {
  id: string;
  label: string;
  is_this_browser: boolean;
  last_seen_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  error_human: string | null;
}

export interface PushSubscriptionsResponse { configured: boolean; public_key: string | null; browsers: PushBrowser[] }

export interface EmailLogRow {
  id: string;
  kind: 'nudge' | 'weekly_summary' | 'test' | 'password_link';
  status: 'sending' | 'sent' | 'failed' | 'skipped_empty' | 'skipped_acknowledged';
  subject: string;
  error_human: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
  is_example: boolean;
}

export interface DataSummary {
  example_counts: { projects: number; tasks: number; sessions: number; emails: number };
  kept: { projects: { id: string; name: string }[]; tasks: { id: string; name: string }[] };
  totals: { sessions: number; seconds: number };
}
