import { authed, json } from '@/lib/server/http';
import { timerRpc } from '@/lib/server/timer';

export const POST = authed(async ({ supabase, user }) => json(await timerRpc(supabase, 'fl_timer_pause', {}, { userId: user.id })));
