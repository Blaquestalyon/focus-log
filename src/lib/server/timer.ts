import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError, dbFail } from './http';
import { formatTime } from '@/lib/format';
import type { TimerView } from '@/lib/types';
import { getTimeZone } from './settings';

/** §6 "Error messages for the timer functions". */
export const TIMER_ERRORS: Record<string, { status: number; message: string }> = {
  FL_TASK_NOT_FOUND: { status: 404, message: 'That task no longer exists. Pick another or type a new one.' },
  FL_TASK_ARCHIVED: { status: 409, message: 'That task is archived. Unarchive it in Your data, or type a new one.' },
  FL_NOT_RUNNING: { status: 409, message: "The timer isn't running — it may have changed on another device." },
  FL_NOT_PAUSED: { status: 409, message: "The timer isn't paused — it may have changed on another device." },
  FL_STOP_IN_FUTURE: { status: 400, message: "The stop time can't be later than now." },
  FL_STOP_BEFORE_START: { status: 400, message: 'The stop time has to be after the start time.' },
  FL_STOP_TOO_LONG: { status: 409, message: 'A single session can be at most 24 hours. Pick an earlier stop time.' },
  FL_UNDO_EXPIRED: { status: 409, message: 'Too late to undo — add the time back in History if you need it.' },
};

/** Call a timer function and turn its raised codes into §6 copy. */
export async function timerRpc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown> = {},
  opts: { userId?: string } = {},
): Promise<TimerView> {
  const { data, error } = await supabase.rpc(fn, args);
  if (!error) return data as TimerView;
  const code = (error.message || '').trim();
  const known = TIMER_ERRORS[code];
  if (known) {
    let message = known.message;
    if (code === 'FL_STOP_BEFORE_START') {
      const view = await timerView(supabase).catch(() => null);
      if (view?.session && opts.userId) {
        const tz = await getTimeZone(supabase, opts.userId);
        message = `The stop time has to be after the start time (${formatTime(view.session.started_at, tz)}).`;
      }
    }
    throw new HttpError(known.status, code, message, code.startsWith('FL_STOP_') ? 'stop_at' : undefined);
  }
  if (error.code === '23514' && /sessions_max_24h/.test(error.message || '')) {
    throw new HttpError(409, 'FL_STOP_TOO_LONG', TIMER_ERRORS.FL_STOP_TOO_LONG.message);
  }
  if (error.code === '23P01' || error.code === '23505' || (error.code === '23514' && /sessions_end_after_start/.test(error.message || ''))) {
    // A concurrent action from another device won the race (a waiting call closing the winner's
    // brand-new session at its own earlier transaction time trips sessions_end_after_start); the caller refetches.
    throw new HttpError(409, 'FL_NOT_RUNNING', TIMER_ERRORS.FL_NOT_RUNNING.message);
  }
  dbFail(error, fn);
}

export async function timerView(supabase: SupabaseClient): Promise<TimerView> {
  const { data, error } = await supabase.rpc('fl_timer_view');
  if (error) dbFail(error, 'fl_timer_view');
  return data as TimerView;
}
