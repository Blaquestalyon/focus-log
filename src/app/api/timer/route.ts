import { authed, json } from '@/lib/server/http';
import { timerView } from '@/lib/server/timer';

export const dynamic = 'force-dynamic';

export const GET = authed(async ({ supabase }) => json(await timerView(supabase)));
