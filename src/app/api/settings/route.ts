import { z } from 'zod';
import { authed, body, json, dbFail, uuid } from '@/lib/server/http';
import { getSettingsRow } from '@/lib/server/settings';
import { isValidTimeZone } from '@/lib/time';
import type { Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function load(ctx: { supabase: Parameters<typeof getSettingsRow>[0]; userId: string; email: string }): Promise<Settings> {
  const s = await getSettingsRow(ctx.supabase, ctx.userId);
  return {
    email: ctx.email,
    time_zone: s.time_zone,
    time_zone_confirmed: s.time_zone_confirmed,
    nudge_after_minutes: s.nudge_after_minutes,
    nudge_email_enabled: s.nudge_email_enabled,
    nudge_browser_enabled: s.nudge_browser_enabled,
    weekly_email_enabled: s.weekly_email_enabled,
    last_project_id: s.last_project_id,
    example_notice_dismissed_at: s.example_notice_dismissed_at,
  };
}

export const GET = authed(async ({ supabase, user }) => json(await load({ supabase, userId: user.id, email: user.email ?? '' })));

const NUDGE_RANGE = 'Pick a time between 30 minutes and 12 hours.';

const Patch = z.strictObject({
  time_zone: z.string().refine(isValidTimeZone, 'Pick a time zone from the list.').optional(),
  time_zone_confirmed: z.boolean().optional(),
  nudge_after_minutes: z
    .number({ message: NUDGE_RANGE })
    .int(NUDGE_RANGE)
    .min(30, NUDGE_RANGE)
    .max(720, NUDGE_RANGE)
    .optional(),
  nudge_email_enabled: z.boolean().optional(),
  nudge_browser_enabled: z.boolean().optional(),
  weekly_email_enabled: z.boolean().optional(),
  last_project_id: uuid.nullable().optional(),
  example_notice_dismissed: z.literal(true).optional(),
});

export const PATCH = authed(async ({ req, supabase, user }) => {
  const b = await body(req, Patch);
  const { example_notice_dismissed, ...rest } = b;
  const update: Record<string, unknown> = { ...rest };
  if (example_notice_dismissed) update.example_notice_dismissed_at = new Date().toISOString();
  if (Object.keys(update).length) {
    const { error } = await supabase.from('user_settings').update(update).eq('user_id', user.id);
    if (error) dbFail(error, 'settings.update');
  }
  return json(await load({ supabase, userId: user.id, email: user.email ?? '' }));
});
