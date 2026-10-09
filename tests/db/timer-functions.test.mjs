import assert from 'node:assert/strict';
export default async function (c) {
  const q = (s, p) => c.query(s, p);
  const owner = (await q(`select id from auth.users where email='jdavis@power-in-numbers.net'`)).rows;
  assert.equal(owner.length, 1, 'one owner after two seeds');
  const U = owner[0].id;
  async function as(uid, sql, params = [], role = 'authenticated') {
    await q('begin');
    try {
      await q(`set local role ${role}`);
      if (uid) await q(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
      const r = await q(sql, params);
      await q('commit'); return r;
    } catch (e) { await q('rollback'); throw e; }
  }
  const fn = async (sql, params) => (await as(U, `select ${sql} as v`, params)).rows[0].v;
  const err = async (p, code) => { try { await p; } catch (e) { assert.match(e.message, new RegExp(code)); return e; } assert.fail('expected ' + code); };
  const age = async (mins, uid = U) => {
    await q(`update public.sessions set started_at = started_at - $2::interval, ended_at = ended_at - $2::interval where user_id=$1`, [uid, `${mins} minutes`]);
    await q(`update public.timer_state set paused_at = paused_at - $2::interval, stopped_at = stopped_at - $2::interval where user_id=$1`, [uid, `${mins} minutes`]);
  };

  // --- seed
  const cnt = async (t, w = 'true') => +(await q(`select count(*) from public.${t} where user_id=$1 and ${w}`, [U])).rows[0].count;
  assert.equal(await cnt('projects', "is_example and name like 'Sample: %'"), 4);
  assert.equal(await cnt('tasks', 'is_example'), 5);
  assert.equal(await cnt('sessions', 'is_example'), 5);
  assert.equal(await cnt('email_log', 'is_example'), 3);
  assert.equal(await cnt('user_settings'), 1); assert.equal(await cnt('timer_state', "status='idle'"), 1);
  const runs = (await q(`select s.run_id from public.sessions s join public.tasks t on t.id=s.task_id where t.name='Invoice prep' and s.user_id=$1`, [U])).rows;
  assert.equal(runs.length, 2); assert.equal(runs[0].run_id, runs[1].run_id);
  const st = (await q(`select time_zone, nudge_after_minutes, nudge_email_enabled, nudge_browser_enabled, weekly_email_enabled, time_zone_confirmed from public.user_settings where user_id=$1`, [U])).rows[0];
  assert.deepEqual(st, { time_zone: 'America/New_York', nudge_after_minutes: 240, nudge_email_enabled: true, nudge_browser_enabled: true, weekly_email_enabled: true, time_zone_confirmed: false });
  const midnight = (await q(`select s.started_at, s.ended_at, s.duration_seconds from public.sessions s join public.tasks t on t.id=s.task_id where t.name='Sponsor outreach emails'`)).rows[0];
  assert.equal(midnight.duration_seconds, 45 * 60);
  console.log('seed ok');

  // --- idle view
  let v = await fn('public.fl_timer_view()');
  assert.equal(v.status, 'idle'); assert.equal(v.run, null);
  await err(fn('public.fl_timer_pause()'), 'FL_NOT_RUNNING');
  await err(fn('public.fl_timer_resume()'), 'FL_NOT_PAUSED');
  await err(fn('public.fl_timer_stop()'), 'FL_NOT_RUNNING');
  await err(fn('public.fl_timer_discard()'), 'FL_NOT_RUNNING');

  // --- own project + task via RLS
  const P = (await as(U, `insert into public.projects(name,color) values ('  Power in Numbers — Admin ','teal') returning id, name`)).rows[0];
  assert.equal(P.name, 'Power in Numbers — Admin');
  const A = (await as(U, `insert into public.tasks(project_id,name) values ($1,'Client call') returning id`, [P.id])).rows[0].id;
  const B = (await as(U, `insert into public.tasks(project_id,name) values ($1,'Bookkeeping') returning id`, [P.id])).rows[0].id;
  await err(as(U, `insert into public.tasks(project_id,name) values ($1,'client CALL')`, [P.id]), 'tasks_user_project_name_uq');
  await err(as(U, `insert into public.projects(name) values ('power in numbers — admin')`), 'projects_user_name_uq');

  // --- start
  v = await fn('public.fl_timer_start($1)', [A]);
  assert.equal(v.status, 'running'); assert.equal(v.task.name, 'Client call'); assert.equal(v.project.color, 'teal');
  assert.equal(v.run.closed_seconds, 0); assert.ok(v.nudge && v.nudge.after_minutes === 240 && v.nudge.active === false);
  let ts = (await q(`select * from public.timer_state where user_id=$1`, [U])).rows[0];
  let open = (await q(`select * from public.sessions where id=$1`, [ts.session_id])).rows[0];
  assert.equal(open.run_id, ts.run_id); assert.ok(Math.abs(new Date(open.started_at) - Date.now()) < 2000);
  assert.equal((await q(`select last_project_id from public.user_settings where user_id=$1`, [U])).rows[0].last_project_id, P.id);
  const run1 = ts.run_id;
  v = await fn('public.fl_timer_start($1)', [A]); assert.equal(v.already_running, true);

  // pause after 10 min
  await age(10);
  v = await fn('public.fl_timer_pause()');
  assert.equal(v.status, 'paused'); assert.equal(v.closed_session.seconds, 600); assert.equal(v.closed_session.run_seconds, 600);
  assert.equal(v.closed_session.dropped, false); assert.equal(v.run.closed_seconds, 600);
  // resume, 5 min, view
  v = await fn('public.fl_timer_resume()'); assert.equal(v.status, 'running');
  await age(5);
  v = await fn('public.fl_timer_view()'); assert.equal(v.run.closed_seconds, 600);
  ts = (await q(`select * from public.timer_state where user_id=$1`, [U])).rows[0]; assert.equal(ts.run_id, run1);
  v = await fn('public.fl_timer_pause()'); assert.equal(v.run.closed_seconds, 900);
  // resume then pause within 5s -> dropped
  await fn('public.fl_timer_resume()');
  v = await fn('public.fl_timer_pause()'); assert.equal(v.closed_session.dropped, true); assert.equal(v.run.closed_seconds, 900);
  // start same task while paused -> resumed
  await age(1);
  v = await fn('public.fl_timer_start($1)', [A]); assert.equal(v.resumed, true); assert.equal(v.closed_session, undefined);
  assert.equal((await q(`select run_id from public.timer_state where user_id=$1`, [U])).rows[0].run_id, run1);
  await age(2);
  // switch to B
  v = await fn('public.fl_timer_start($1)', [B]);
  assert.equal(v.task.name, 'Bookkeeping'); assert.equal(v.closed_session.end_reason, 'switch');
  assert.equal(v.closed_session.seconds, 120); assert.equal(v.closed_session.run_seconds, 1020); assert.equal(v.run.closed_seconds, 0);
  const sw = (await q(`select ended_at from public.sessions where id=$1`, [v.closed_session.id])).rows[0];
  const nw = (await q(`select started_at from public.sessions where id=$1`, [v.session.id])).rows[0];
  assert.equal(+sw.ended_at, +nw.started_at, 'no gap on switch');
  // switch within 5s -> dropped
  v = await fn('public.fl_timer_start($1)', [A]); assert.equal(v.closed_session.dropped, true);
  assert.equal((await q(`select count(*) from public.sessions where id=$1`, [v.closed_session.id])).rows[0].count, '0');
  // stop within 5s -> dropped, idle
  v = await fn('public.fl_timer_stop()'); assert.equal(v.status, 'idle'); assert.equal(v.closed_session.dropped, true);
  console.log('start/pause/resume/switch ok');

  // stop + undo running
  v = await fn('public.fl_timer_start($1)', [A]); assert.equal(v.run.closed_seconds, 0);
  await age(3);
  v = await fn('public.fl_timer_stop()'); const cs = v.closed_session;
  assert.equal(cs.from, 'running'); assert.equal(cs.seconds, 180);
  v = await fn(`public.fl_timer_undo_stop($1,'running')`, [cs.id]); assert.equal(v.status, 'running'); assert.equal(v.session.id, cs.id);
  // pause then stop from paused, then undo paused
  await age(1);
  v = await fn('public.fl_timer_pause()');
  const before = (await q(`select count(*) from public.sessions where user_id=$1`, [U])).rows[0].count;
  v = await fn('public.fl_timer_stop()'); assert.equal(v.closed_session.from, 'paused'); assert.equal(v.closed_session.end_reason, 'pause');
  assert.equal(v.closed_session.run_seconds, 240);
  assert.equal((await q(`select count(*) from public.sessions where user_id=$1`, [U])).rows[0].count, before);
  v = await fn(`public.fl_timer_undo_stop($1,'paused')`, [v.closed_session.id]); assert.equal(v.status, 'paused'); assert.equal(v.run.closed_seconds, 240);
  await err(fn(`public.fl_timer_stop(now() - interval '1 minute')`), 'FL_NOT_RUNNING');
  v = await fn('public.fl_timer_stop()');
  await age(1);
  await err(fn(`public.fl_timer_undo_stop($1,'paused')`, [v.closed_session.id]), 'FL_UNDO_EXPIRED');
  // stop from paused with nothing logged -> no closed_session
  await fn('public.fl_timer_start($1)', [B]); v = await fn('public.fl_timer_pause()'); assert.equal(v.run.started_at, null);
  v = await fn('public.fl_timer_stop()'); assert.equal(v.closed_session, undefined);
  console.log('stop/undo ok');

  // stop_at validations
  await fn('public.fl_timer_start($1)', [A]); await age(60);
  await err(fn(`public.fl_timer_stop(now() + interval '1 minute')`), 'FL_STOP_IN_FUTURE');
  await err(fn(`public.fl_timer_stop(now() - interval '2 hours')`), 'FL_STOP_BEFORE_START');
  v = await fn(`public.fl_timer_stop(now() - interval '20 minutes')`); assert.equal(v.closed_session.seconds, 2400);
  // 24h rule
  await fn('public.fl_timer_start($1)', [A]); await age(25 * 60);
  await err(fn('public.fl_timer_pause()'), 'FL_STOP_TOO_LONG');
  await err(fn('public.fl_timer_start($1)', [B]), 'FL_STOP_TOO_LONG');
  await err(fn('public.fl_timer_stop()'), 'FL_STOP_TOO_LONG');
  v = await fn('public.fl_timer_view()'); assert.equal(v.nudge.active, true);
  v = await fn(`public.fl_timer_stop(now() - interval '2 hours')`); assert.equal(v.closed_session.seconds, 23 * 3600);
  // discard running keeps earlier sessions; discard paused
  await fn('public.fl_timer_start($1)', [A]); await age(2); await fn('public.fl_timer_pause()'); await fn('public.fl_timer_resume()'); await age(1);
  const nBefore = +(await q(`select count(*) from public.sessions where user_id=$1`, [U])).rows[0].count;
  v = await fn('public.fl_timer_discard()'); assert.equal(v.status, 'idle');
  assert.equal(+(await q(`select count(*) from public.sessions where user_id=$1`, [U])).rows[0].count, nBefore - 1);
  await fn('public.fl_timer_start($1)', [A]); await age(1); await fn('public.fl_timer_pause()');
  v = await fn('public.fl_timer_discard()'); assert.equal(v.status, 'idle');
  // paused A then start A again after stop -> 0
  console.log('stop_at/24h/discard ok');

  // overlap + single running at the database
  await fn('public.fl_timer_start($1)', [A]);
  await err(as(U, `insert into public.sessions(task_id, started_at) values ($1, now() - interval '1 hour')`, [B]), 'sessions_one_running|sessions_no_overlap');
  const ov = await err(as(U, `insert into public.sessions(task_id, started_at, ended_at, source) values ($1, now() - interval '30 seconds', now() - interval '10 seconds','manual')`, [B]), 'sessions_no_overlap');
  assert.equal(ov.code, '23P01');
  const lng = await err(as(U, `insert into public.sessions(task_id, started_at, ended_at, source) values ($1, now() - interval '300 days', now() - interval '298 days','manual')`, [B]), 'sessions_max_24h');
  assert.equal(lng.code, '23514');
  // edit running start time → view recalculates; moved session detaches from run
  await age(30);
  await fn('public.fl_timer_pause()'); await fn('public.fl_timer_resume()'); await age(5);
  v = await fn('public.fl_timer_view()'); assert.equal(v.run.closed_seconds, 1800);
  const closedId = (await q(`select id from public.sessions where user_id=$1 and run_id=$2 and ended_at is not null`, [U, (await q(`select run_id from public.timer_state where user_id=$1`, [U])).rows[0].run_id])).rows[0].id;
  await as(U, `update public.sessions set task_id=$2 where id=$1`, [closedId, B]);
  assert.equal((await q(`select run_id from public.sessions where id=$1`, [closedId])).rows[0].run_id, null);
  v = await fn('public.fl_timer_view()'); assert.equal(v.run.closed_seconds, 0);
  await fn('public.fl_timer_stop()');
  console.log('constraints/move ok');

  // claims: start sample Invoice prep claims task and its project
  const inv = (await q(`select id from public.tasks where name='Invoice prep' and user_id=$1`, [U])).rows[0].id;
  await fn('public.fl_timer_start($1)', [inv]);
  const claimed = (await q(`select t.is_example te, t.claimed_from_example_at tc, p.is_example pe, p.claimed_from_example_at pc from public.tasks t join public.projects p on p.id=t.project_id where t.id=$1`, [inv])).rows[0];
  assert.equal(claimed.te, false); assert.ok(claimed.tc); assert.equal(claimed.pe, false); assert.ok(claimed.pc);
  await age(1); await fn('public.fl_timer_stop()');
  // creating a task under a sample project claims the project
  const acme = (await q(`select id from public.projects where name='Sample: Acme Co'`)).rows[0].id;
  await as(U, `insert into public.tasks(project_id,name) values ($1,'Brief')`, [acme]);
  assert.equal((await q(`select is_example from public.projects where id=$1`, [acme])).rows[0].is_example, false);
  // authenticated can't call admin fn; service role can
  await err(as(U, `select public.fl_admin_delete_user_data($1, true)`, [U]), 'permission denied');
  const rm = (await as(null, `select public.fl_admin_delete_user_data($1, true) v`, [U], 'service_role')).rows[0].v;
  assert.deepEqual(rm.removed, { projects: 2, tasks: 4, sessions: 5, emails: 3 });
  assert.deepEqual(rm.kept.projects.map(x => x.name).sort(), ['Sample: Acme Co', 'Sample: Admin & Billing']);
  assert.deepEqual(rm.kept.tasks.map(x => x.name), ['Invoice prep']);
  assert.equal(await cnt('projects', 'is_example'), 0);
  console.log('examples ok');

  // security: second user + anon
  const U2 = '11111111-1111-1111-1111-111111111111';
  await q(`insert into auth.users(id,email) values ($1,'other@example.com')`, [U2]);
  assert.equal(+(await q(`select count(*) from public.timer_state where user_id=$1`, [U2])).rows[0].count, 1);
  for (const t of ['projects', 'tasks', 'sessions', 'email_log', 'user_settings', 'timer_state', 'push_subscriptions']) {
    const r = await as(U2, `select count(*) from public.${t} where user_id=$1`, [U]); assert.equal(r.rows[0].count, '0', t);
    await err(as(null, `select * from public.${t}`, [], 'anon'), 'permission denied');
  }
  assert.equal((await as(U2, `update public.projects set name='x' where user_id=$1`, [U])).rowCount, 0);
  assert.equal((await as(U2, `delete from public.sessions where user_id=$1`, [U])).rowCount, 0);
  await err(as(U2, `insert into public.sessions(task_id, started_at, ended_at) values ($1, now()-interval '3 hours', now()-interval '2 hours')`, [A]), 'row-level security');
  await err(as(U, `insert into public.email_log(user_id,kind,ref_key,status,to_email,subject) values ($1,'test','x','sent','a','b')`, [U]), 'permission denied');
  await err(as(null, `select public.fl_timer_view()`, [], 'anon'), 'permission denied');
  await err(as(null, `select public.fl_timer_start($1)`, [A], 'anon'), 'permission denied');
  // push endpoint of another user can't be overwritten
  await as(U2, `insert into public.push_subscriptions(endpoint,p256dh,auth_secret,label) values ('https://push.example/abc','k','a','Chrome on Windows')`);
  await err(as(U, `insert into public.push_subscriptions(endpoint,p256dh,auth_secret,label) values ('https://push.example/abc','k2','a2','Mine') on conflict (endpoint) do update set p256dh=excluded.p256dh`), '.');
  assert.equal((await q(`select p256dh from public.push_subscriptions where endpoint='https://push.example/abc'`)).rows[0].p256dh, 'k');
  // email once-only index ignores examples
  await q(`insert into public.email_log(user_id,kind,ref_key,status,to_email,subject,is_example) values ($1,'weekly_summary','week:2026-09-28','sent','a','b',true)`, [U]);
  const ins = await q(`insert into public.email_log(user_id,kind,ref_key,status,to_email,subject) values ($1,'weekly_summary','week:2026-09-28','sending','a','b') on conflict (user_id,kind,ref_key) where is_example = false do nothing returning id`, [U]);
  assert.equal(ins.rowCount, 1);
  const ins2 = await q(`insert into public.email_log(user_id,kind,ref_key,status,to_email,subject) values ($1,'weekly_summary','week:2026-09-28','sending','a','b') on conflict (user_id,kind,ref_key) where is_example = false do nothing returning id`, [U]);
  assert.equal(ins2.rowCount, 0);
  // session_rows view respects RLS; the email claim is service-role only and once-only
  assert.equal(+(await as(U2, `select count(*) from public.session_rows where user_id=$1`, [U])).rows[0].count, 0);
  await err(as(null, `select * from public.session_rows`, [], 'anon'), 'permission denied');
  await err(as(U, `select public.fl_email_log_claim($1,'test','test:x','sending','a','b')`, [U]), 'permission denied');
  const c1 = (await as(null, `select public.fl_email_log_claim($1,'nudge','session:abc','sending','a','b') v`, [U], 'service_role')).rows[0].v;
  const c2 = (await as(null, `select public.fl_email_log_claim($1,'nudge','session:abc','sending','a','b') v`, [U], 'service_role')).rows[0].v;
  assert.ok(c1); assert.equal(c2, null);
  console.log('security ok');

  // delete all tracked data while running
  await fn('public.fl_timer_start($1)', [A]);
  const del = (await as(null, `select public.fl_admin_delete_user_data($1, false) v`, [U], 'service_role')).rows[0].v;
  assert.ok(del.deleted.sessions > 0);
  for (const t of ['projects', 'tasks', 'sessions', 'email_log']) assert.equal(await cnt(t), 0, t);
  assert.equal(await cnt('timer_state', "status='idle'"), 1); assert.equal(await cnt('user_settings'), 1);
  // user deletion with data (second user)
  const p2 = (await as(U2, `insert into public.projects(name) values ('X') returning id`)).rows[0].id;
  const t2 = (await as(U2, `insert into public.tasks(project_id,name) values ($1,'Y') returning id`, [p2])).rows[0].id;
  await as(U2, `select public.fl_timer_start($1)`, [t2]);
  try { await q(`delete from auth.users where id=$1`, [U2]); console.log('user delete with data: ok'); }
  catch (e) { console.log('user delete with data: BLOCKED ->', e.message); }
  const prof = (await q(`select prosecdef, proconfig from pg_proc where proname='fl_handle_new_user'`)).rows[0];
  assert.equal(prof.prosecdef, true); assert.deepEqual(prof.proconfig, ['search_path=public']);
  console.log('delete-all ok');
}
