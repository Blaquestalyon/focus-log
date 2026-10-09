/**
 * `npm run seed` — creates the owner's account and the example data (blueprint §3 Seed-data plan).
 * Idempotent: the owner is looked up by email and never duplicated, and example rows are only
 * added to a fresh account (no projects, sessions or email records yet).
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never writes a password.
 */
import { createClient } from '@supabase/supabase-js';
import { addDays, localDateTimeToInstant, mondayOf, todayStr } from '../src/lib/time';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.OWNER_EMAIL || 'jdavis@power-in-numbers.net').toLowerCase();
const TZ = 'America/New_York';

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findOwner(): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

function at(dayOffset: number, hhmm: string): string {
  return localDateTimeToInstant(addDays(todayStr(TZ), dayOffset), hhmm, TZ).toISOString();
}

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${JSON.stringify(error)}`);
  return data as T;
}

async function main() {
  let uid = await findOwner();
  if (!uid) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) throw error ?? new Error('createUser returned no user');
    uid = data.user.id;
    console.log(`Created the owner account ${email} (no password; set it through the emailed link).`);
  } else {
    console.log(`Owner account ${email} already exists.`);
  }

  const counts = await Promise.all(
    ['projects', 'sessions', 'email_log'].map(async (t) => {
      const { count } = await db.from(t).select('id', { count: 'exact', head: true }).eq('user_id', uid);
      return count ?? 0;
    }),
  );
  if (counts.some((c) => c > 0)) {
    console.log('The account already has data; example rows were not added.');
    return;
  }

  const projects = await must(
    db
      .from('projects')
      .insert([
        { user_id: uid, name: 'Sample: Podcast Pilot', color: 'violet', is_example: true },
        { user_id: uid, name: 'Sample: Admin & Billing', color: 'azure', is_example: true },
        { user_id: uid, name: 'Sample: Acme Co', color: 'coral', is_example: true },
        { user_id: uid, name: 'Sample: Reading', color: 'lime', is_example: true },
      ])
      .select('id,name'),
    'projects',
  );
  const pid = (n: string) => projects.find((p) => p.name === n)!.id;
  const tasks = await must(
    db
      .from('tasks')
      .insert([
        { user_id: uid, project_id: pid('Sample: Podcast Pilot'), name: 'Episode outline', is_example: true, last_used_at: at(-3, '09:00') },
        { user_id: uid, project_id: pid('Sample: Podcast Pilot'), name: 'Sponsor outreach emails', is_example: true, last_used_at: at(-2, '23:40') },
        { user_id: uid, project_id: pid('Sample: Admin & Billing'), name: 'Invoice prep', is_example: true, last_used_at: at(-3, '13:05') },
        { user_id: uid, project_id: pid('Sample: Acme Co'), name: 'Website copy review', is_example: true },
        { user_id: uid, project_id: pid('Sample: Reading'), name: 'Read: The Effective Executive', is_example: true },
      ])
      .select('id,name'),
    'tasks',
  );
  const tid = (n: string) => tasks.find((t) => t.name === n)!.id;
  const runR = crypto.randomUUID();
  await must(
    db.from('sessions').insert([
      { user_id: uid, task_id: tid('Episode outline'), started_at: at(-3, '09:00'), ended_at: at(-3, '10:30'), source: 'timer', run_id: crypto.randomUUID(), end_reason: 'stop', is_example: true },
      { user_id: uid, task_id: tid('Invoice prep'), started_at: at(-3, '10:45'), ended_at: at(-3, '11:20'), source: 'timer', run_id: runR, end_reason: 'pause', is_example: true },
      { user_id: uid, task_id: tid('Invoice prep'), started_at: at(-3, '13:05'), ended_at: at(-3, '13:40'), source: 'timer', run_id: runR, end_reason: 'stop', is_example: true },
      { user_id: uid, task_id: tid('Sponsor outreach emails'), started_at: at(-2, '23:40'), ended_at: at(-1, '00:25'), source: 'timer', run_id: crypto.randomUUID(), end_reason: 'stop', is_example: true },
      { user_id: uid, task_id: tid('Website copy review'), started_at: at(-1, '14:00'), ended_at: at(-1, '15:15'), source: 'manual', edited_at: new Date().toISOString(), is_example: true },
    ]),
    'sessions',
  );
  const monday = mondayOf(todayStr(TZ));
  const lastMonday8 = localDateTimeToInstant(monday, '08:00', TZ);
  const sentAt = new Date(Math.min(Date.now(), lastMonday8.getTime())).toISOString();
  const fourDaysAgo = new Date(Date.now() - 4 * 86400_000).toISOString();
  await must(
    db.from('email_log').insert([
      { user_id: uid, kind: 'test', ref_key: `test:${fourDaysAgo}`, status: 'sent', to_email: email, subject: 'Focus Log test email', provider_message_id: 'example-message-1', attempts: 1, is_example: true, created_at: fourDaysAgo, sent_at: fourDaysAgo },
      { user_id: uid, kind: 'weekly_summary', ref_key: `week:${addDays(monday, -14)}`, status: 'skipped_empty', to_email: email, subject: 'Your week', attempts: 0, is_example: true, created_at: localDateTimeToInstant(addDays(monday, -7), '08:00', TZ).toISOString() },
      { user_id: uid, kind: 'weekly_summary', ref_key: `week:${addDays(monday, -7)}`, status: 'sent', to_email: email, subject: 'Your week: 6h 40m across 3 projects', provider_message_id: 'example-message-2', attempts: 1, is_example: true, created_at: sentAt, sent_at: sentAt },
    ]),
    'email_log',
  );
  console.log('Example data added: 4 projects, 5 tasks, 5 sessions, 3 email records.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
