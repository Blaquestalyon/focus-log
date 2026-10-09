-- Focus Log — seed (blueprint §3 Seed-data plan). Safe to run more than once.
--
-- 1. The owner's own account: jdavis@power-in-numbers.net, email confirmed, NO password.
--    The owner sets a password through "First time here? Set your password".
--    Creating the auth user fires fl_handle_new_user, which adds the owner's
--    user_settings row (America/New_York, nudge 240 min, all toggles on) and an
--    idle timer_state row.
-- 2. Example rows (is_example = true), only on a fresh account with no projects
--    or sessions yet, so a re-run never duplicates or re-adds removed examples.
--    Times are relative to the seed day in America/New_York.

do $seed$
declare
  v_email   text := 'jdavis@power-in-numbers.net';
  v_uid     uuid;
  v_tz      text := 'America/New_York';
  v_today   timestamp;          -- local midnight today (no zone)
  v_p_pod   uuid; v_p_admin uuid; v_p_acme uuid; v_p_read uuid;
  v_t_outline uuid; v_t_sponsor uuid; v_t_invoice uuid; v_t_web uuid; v_t_read uuid;
  v_run_r   uuid := gen_random_uuid();
  v_mon_this date;
begin
  -- ---- 1. owner account -------------------------------------------------
  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email, '',
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(),
      '', '', '', '');

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
    values (
      gen_random_uuid(), v_uid, v_uid::text, 'email',
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      now(), now());
  end if;

  -- safety net if the user existed before the trigger did
  insert into public.user_settings (user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.timer_state (user_id) values (v_uid) on conflict (user_id) do nothing;

  -- ---- 2. example rows (fresh account only) -----------------------------
  if exists (select 1 from public.projects where user_id = v_uid)
     or exists (select 1 from public.sessions where user_id = v_uid)
     or exists (select 1 from public.email_log where user_id = v_uid) then
    return;
  end if;

  v_today := date_trunc('day', now() at time zone v_tz);
  v_mon_this := date_trunc('week', now() at time zone v_tz)::date;

  insert into public.projects (user_id, name, color, is_example) values
    (v_uid, 'Sample: Podcast Pilot', 'violet', true) returning id into v_p_pod;
  insert into public.projects (user_id, name, color, is_example) values
    (v_uid, 'Sample: Admin & Billing', 'azure', true) returning id into v_p_admin;
  insert into public.projects (user_id, name, color, is_example) values
    (v_uid, 'Sample: Acme Co', 'coral', true) returning id into v_p_acme;
  insert into public.projects (user_id, name, color, is_example) values
    (v_uid, 'Sample: Reading', 'lime', true) returning id into v_p_read;

  insert into public.tasks (user_id, project_id, name, is_example, last_used_at) values
    (v_uid, v_p_pod, 'Episode outline', true,
     ((v_today - interval '3 days' + time '09:00') at time zone v_tz)) returning id into v_t_outline;
  insert into public.tasks (user_id, project_id, name, is_example, last_used_at) values
    (v_uid, v_p_pod, 'Sponsor outreach emails', true,
     ((v_today - interval '2 days' + time '23:40') at time zone v_tz)) returning id into v_t_sponsor;
  insert into public.tasks (user_id, project_id, name, is_example, last_used_at) values
    (v_uid, v_p_admin, 'Invoice prep', true,
     ((v_today - interval '3 days' + time '13:05') at time zone v_tz)) returning id into v_t_invoice;
  insert into public.tasks (user_id, project_id, name, is_example, last_used_at) values
    (v_uid, v_p_acme, 'Website copy review', true, null) returning id into v_t_web;
  insert into public.tasks (user_id, project_id, name, is_example, last_used_at) values
    (v_uid, v_p_read, 'Read: The Effective Executive', true, null) returning id into v_t_read;

  insert into public.sessions (user_id, task_id, started_at, ended_at, source, run_id, end_reason, edited_at, is_example) values
    -- 1. Episode outline, 3 days ago 9:00–10:30 AM, its own run
    (v_uid, v_t_outline,
     (v_today - interval '3 days' + time '09:00') at time zone v_tz,
     (v_today - interval '3 days' + time '10:30') at time zone v_tz,
     'timer', gen_random_uuid(), 'stop', null, true),
    -- 2. Invoice prep, 3 days ago 10:45–11:20 AM, paused, run R
    (v_uid, v_t_invoice,
     (v_today - interval '3 days' + time '10:45') at time zone v_tz,
     (v_today - interval '3 days' + time '11:20') at time zone v_tz,
     'timer', v_run_r, 'pause', null, true),
    -- 3. Invoice prep, 3 days ago 1:05–1:40 PM, stopped, same run R
    (v_uid, v_t_invoice,
     (v_today - interval '3 days' + time '13:05') at time zone v_tz,
     (v_today - interval '3 days' + time '13:40') at time zone v_tz,
     'timer', v_run_r, 'stop', null, true),
    -- 4. Sponsor outreach emails, 2 days ago 11:40 PM to yesterday 12:25 AM (crosses midnight)
    (v_uid, v_t_sponsor,
     (v_today - interval '2 days' + time '23:40') at time zone v_tz,
     (v_today - interval '1 day' + time '00:25') at time zone v_tz,
     'timer', gen_random_uuid(), 'stop', null, true),
    -- 5. Website copy review, yesterday 2:00–3:15 PM, manual, edited
    (v_uid, v_t_web,
     (v_today - interval '1 day' + time '14:00') at time zone v_tz,
     (v_today - interval '1 day' + time '15:15') at time zone v_tz,
     'manual', null, null, now(), true);

  insert into public.email_log (user_id, kind, ref_key, status, to_email, subject, provider_message_id,
                                attempts, is_example, created_at, sent_at) values
    (v_uid, 'test', 'test:' || to_char((now() - interval '4 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
     'sent', v_email, 'Focus Log test email', 'example-message-1', 1, true,
     now() - interval '4 days', now() - interval '4 days'),
    (v_uid, 'weekly_summary', 'week:' || to_char(v_mon_this - 14, 'YYYY-MM-DD'),
     'skipped_empty', v_email, 'Your week', null, 0, true,
     ((v_mon_this - 7)::timestamp + time '08:00') at time zone v_tz, null),
    (v_uid, 'weekly_summary', 'week:' || to_char(v_mon_this - 7, 'YYYY-MM-DD'),
     'sent', v_email, 'Your week: 6h 40m across 3 projects', 'example-message-2', 1, true,
     least(now(), (v_mon_this::timestamp + time '08:00') at time zone v_tz),
     least(now(), (v_mon_this::timestamp + time '08:00') at time zone v_tz));
end
$seed$;
