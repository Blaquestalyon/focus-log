import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dbFail } from './http';

export interface SettingsRow {
  user_id: string;
  time_zone: string;
  time_zone_confirmed: boolean;
  nudge_after_minutes: number;
  nudge_email_enabled: boolean;
  nudge_browser_enabled: boolean;
  weekly_email_enabled: boolean;
  last_project_id: string | null;
  example_notice_dismissed_at: string | null;
}

export async function getSettingsRow(supabase: SupabaseClient, userId: string): Promise<SettingsRow> {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) dbFail(error, 'user_settings');
  if (!data) {
    return {
      user_id: userId, time_zone: 'America/New_York', time_zone_confirmed: false, nudge_after_minutes: 240,
      nudge_email_enabled: true, nudge_browser_enabled: true, weekly_email_enabled: true, last_project_id: null,
      example_notice_dismissed_at: null,
    };
  }
  return data as SettingsRow;
}

export async function getTimeZone(supabase: SupabaseClient, userId: string): Promise<string> {
  return (await getSettingsRow(supabase, userId)).time_zone;
}
