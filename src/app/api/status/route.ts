import { authed, json } from '@/lib/server/http';
import { getSettingsRow } from '@/lib/server/settings';
import { computeStatus } from '@/lib/server/status';

export const dynamic = 'force-dynamic';

export const GET = authed(async ({ supabase, user }) => json(await computeStatus(user.id, await getSettingsRow(supabase, user.id))));
